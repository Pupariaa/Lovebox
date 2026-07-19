<?php

declare(strict_types=1);

namespace Bac\Services;

use Bac\Repositories\UserRepository;
use Bac\Support\TokenUtil;

final class OAuthService
{
    private array $settings;

    public function __construct(
        private UserRepository $users,
        private JwtService $jwt,
        private AppleClientSecret $appleSecret
    ) {
        $this->settings = require dirname(__DIR__, 2) . '/config/settings.php';
    }

    public function availableProviders(): array
    {
        $providers = [];
        foreach (['google', 'apple', 'facebook'] as $provider) {
            try {
                $this->providerConfig($provider);
                $providers[] = $provider;
            } catch (\InvalidArgumentException) {
            }
        }
        return $providers;
    }

    public function startUrl(string $provider, array $query = []): string
    {
        $provider = strtolower($provider);
        $cfg = $this->providerConfig($provider);
        $intent = self::normalizeIntent((string) ($query['intent'] ?? 'register'));
        $state = self::buildOAuthState($query, $intent);
        $params = [
            'client_id' => $cfg['client_id'],
            'redirect_uri' => $cfg['redirect_uri'],
            'response_type' => 'code',
            'scope' => $cfg['scope'],
            'state' => $state,
        ];
        if ($provider === 'apple') {
            $params['response_mode'] = 'query';
        }
        return $cfg['auth_url'] . '?' . http_build_query($params);
    }

    public static function decodeNativeRedirect(string $state): ?string
    {
        return self::parseOAuthState($state)['redirect'];
    }

    public static function decodeOAuthIntent(string $state): string
    {
        return self::parseOAuthState($state)['intent'];
    }

    private static function buildOAuthState(array $query, string $intent): string
    {
        $state = TokenUtil::randomHex(16);
        $nativeRedirect = self::sanitizeNativeRedirect((string) ($query['redirect_uri'] ?? ''));
        if (($query['app'] ?? '') === 'native' && $nativeRedirect !== null) {
            $encoded = rtrim(strtr(base64_encode($nativeRedirect), '+/', '-_'), '=');
            $state .= '.' . $encoded;
        }
        if ($intent === 'login') {
            $state .= '@login';
        }
        return $state;
    }

    /** @return array{redirect: ?string, intent: string} */
    private static function parseOAuthState(string $state): array
    {
        $intent = 'register';
        if (str_ends_with($state, '@login')) {
            $intent = 'login';
            $state = substr($state, 0, -6);
        }
        $dot = strpos($state, '.');
        if ($dot === false) {
            return ['redirect' => null, 'intent' => $intent];
        }
        $encoded = substr($state, $dot + 1);
        $decoded = base64_decode(strtr($encoded, '-_', '+/'), true);
        if ($decoded === false) {
            return ['redirect' => null, 'intent' => $intent];
        }
        return ['redirect' => self::sanitizeNativeRedirect($decoded), 'intent' => $intent];
    }

    private static function normalizeIntent(string $intent): string
    {
        return $intent === 'login' ? 'login' : 'register';
    }

    public function handleCallback(string $provider, array $params): array
    {
        $provider = strtolower($provider);
        if (!empty($params['error'])) {
            throw new \InvalidArgumentException((string) $params['error_description'] ?: (string) $params['error']);
        }
        if (empty($params['code'])) {
            throw new \InvalidArgumentException('missing oauth code');
        }
        $cfg = $this->providerConfig($provider);
        $profile = $this->exchangeCode($provider, $cfg, (string) $params['code']);
        $intent = self::decodeOAuthIntent((string) ($params['state'] ?? ''));
        return $this->loginFromProfile($provider, $profile, null, $intent);
    }

    public function handleNativeApple(array $body): array
    {
        $code = trim((string) ($body['code'] ?? ''));
        $idToken = trim((string) ($body['id_token'] ?? ''));
        if ($code === '' && $idToken === '') {
            throw new \InvalidArgumentException('missing apple credentials');
        }
        $cfg = $this->nativeAppleConfig();
        if ($code !== '') {
            $profile = $this->exchangeCode('apple', $cfg, $code);
        } else {
            $profile = $this->decodeIdToken($idToken);
        }
        $email = strtolower(trim((string) ($profile['email'] ?? '')));
        if ($email === '' && !empty($body['user']['email'])) {
            $email = strtolower(trim((string) $body['user']['email']));
            $profile['email'] = $email;
        }
        $firstName = trim((string) ($body['user']['name']['firstName'] ?? ''));
        $intent = self::normalizeIntent((string) ($body['intent'] ?? 'register'));
        return $this->loginFromProfile(
            'apple',
            $profile,
            $firstName !== '' ? $firstName : null,
            $intent
        );
    }

    private function loginFromProfile(
        string $provider,
        array $profile,
        ?string $firstName = null,
        string $intent = 'register'
    ): array {
        $email = strtolower(trim((string) ($profile['email'] ?? '')));
        if ($email === '') {
            throw new \InvalidArgumentException('email not provided by provider');
        }
        $oauthId = (string) ($profile['sub'] ?? $profile['id'] ?? '');
        if ($oauthId === '') {
            throw new \InvalidArgumentException('provider user id missing');
        }
        $user = $this->users->findByOAuth($provider, $oauthId);
        if (!$user) {
            $existing = $this->users->findByEmail($email);
            if ($existing) {
                $this->users->linkOAuth((int) $existing['id'], $provider, $oauthId);
                $user = $existing;
            } elseif ($intent === 'login') {
                throw new \InvalidArgumentException('account_not_found');
            } else {
                $userId = $this->users->createOAuthUser($email, $provider, $oauthId, $firstName);
                $user = $this->users->findById($userId);
            }
        }
        $refresh = TokenUtil::randomHex(32);
        $expiresAt = date('Y-m-d H:i:s', time() + $this->jwt->refreshTtl());
        $this->users->storeRefreshToken((int) $user['id'], TokenUtil::hashToken($refresh), $expiresAt);
        return [
            'access_token' => $this->jwt->issueAccessToken((int) $user['id'], $user['email']),
            'refresh_token' => $refresh,
            'expires_in' => (string) $this->jwt->accessTtl(),
        ];
    }

    private function exchangeCode(string $provider, array $cfg, string $code): array
    {
        $clientSecret = $cfg['client_secret'];
        if ($provider === 'apple') {
            $clientSecret = $this->appleSecret->forClientId((string) $cfg['client_id']);
        }
        $payload = [
            'client_id' => $cfg['client_id'],
            'client_secret' => $clientSecret,
            'code' => $code,
            'grant_type' => 'authorization_code',
        ];
        if (($cfg['redirect_uri'] ?? '') !== '') {
            $payload['redirect_uri'] = $cfg['redirect_uri'];
        }
        $body = http_build_query($payload);
        $ctx = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
                'content' => $body,
                'timeout' => 12,
            ],
        ]);
        $tokenJson = @file_get_contents($cfg['token_url'], false, $ctx);
        if (!$tokenJson) {
            throw new \InvalidArgumentException('oauth token exchange failed');
        }
        $token = json_decode($tokenJson, true);
        if (!is_array($token) || empty($token['access_token'])) {
            $detail = is_array($token) ? (string) ($token['error_description'] ?? $token['error'] ?? '') : '';
            throw new \InvalidArgumentException($detail !== '' ? $detail : 'oauth token missing');
        }
        if ($provider === 'apple' && !empty($token['id_token'])) {
            return $this->decodeIdToken((string) $token['id_token']);
        }
        if ($provider === 'google' && !empty($token['id_token'])) {
            $decoded = $this->decodeIdToken((string) $token['id_token']);
            if (!empty($decoded['email'])) {
                return $decoded;
            }
        }
        $profileUrl = $cfg['profile_url'];
        if ($profileUrl === '') {
            return [];
        }
        if ($provider === 'facebook' || $provider === 'instagram') {
            $profileUrl .= '?fields=id,email,name&access_token=' . urlencode((string) $token['access_token']);
        } elseif ($provider === 'google') {
            $profileUrl .= '?access_token=' . urlencode((string) $token['access_token']);
        }
        $profileCtx = stream_context_create(['http' => ['timeout' => 12]]);
        $profileJson = @file_get_contents($profileUrl, false, $profileCtx);
        $profile = json_decode((string) $profileJson, true);
        return is_array($profile) ? $profile : [];
    }

    private function decodeIdToken(string $idToken): array
    {
        $parts = explode('.', $idToken);
        if (!isset($parts[1])) {
            return [];
        }
        $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/'), true) ?: '', true);
        return is_array($payload) ? $payload : [];
    }

    private function nativeAppleConfig(): array
    {
        $oauth = $this->settings['oauth'] ?? [];
        $clientId = trim((string) ($oauth['apple_native_client_id'] ?? ''));
        if ($clientId === '') {
            $clientId = trim((string) ($oauth['apple_client_id'] ?? ''));
        }
        if ($clientId === '' || !$this->appleSecret->isConfigured()) {
            throw new \InvalidArgumentException('apple oauth not configured');
        }
        return [
            'client_id' => $clientId,
            'client_secret' => '',
            'auth_url' => 'https://appleid.apple.com/auth/authorize',
            'token_url' => 'https://appleid.apple.com/auth/token',
            'profile_url' => '',
            'scope' => 'name email',
            'redirect_uri' => '',
        ];
    }

    private function providerConfig(string $provider): array
    {
        $base = rtrim($this->settings['app']['url'], '/');
        $redirect = $base . '/api/v1/auth/oauth/' . $provider . '/callback';
        $oauth = $this->settings['oauth'] ?? [];
        $map = [
            'google' => [
                'client_id' => $oauth['google_client_id'] ?? '',
                'client_secret' => $oauth['google_client_secret'] ?? '',
                'auth_url' => 'https://accounts.google.com/o/oauth2/v2/auth',
                'token_url' => 'https://oauth2.googleapis.com/token',
                'profile_url' => 'https://www.googleapis.com/oauth2/v2/userinfo',
                'scope' => 'openid email profile',
                'redirect_uri' => $redirect,
            ],
            'apple' => [
                'client_id' => $oauth['apple_client_id'] ?? '',
                'client_secret' => $oauth['apple_client_secret'] ?? '',
                'auth_url' => 'https://appleid.apple.com/auth/authorize',
                'token_url' => 'https://appleid.apple.com/auth/token',
                'profile_url' => '',
                'scope' => 'name email',
                'redirect_uri' => $redirect,
            ],
            'facebook' => [
                'client_id' => $oauth['facebook_client_id'] ?? '',
                'client_secret' => $oauth['facebook_client_secret'] ?? '',
                'auth_url' => 'https://www.facebook.com/v19.0/dialog/oauth',
                'token_url' => 'https://graph.facebook.com/v19.0/oauth/access_token',
                'profile_url' => 'https://graph.facebook.com/me',
                'scope' => 'email,public_profile',
                'redirect_uri' => $redirect,
            ],
            'instagram' => [
                'client_id' => $oauth['instagram_client_id'] ?? ($oauth['facebook_client_id'] ?? ''),
                'client_secret' => $oauth['instagram_client_secret'] ?? ($oauth['facebook_client_secret'] ?? ''),
                'auth_url' => 'https://api.instagram.com/oauth/authorize',
                'token_url' => 'https://api.instagram.com/oauth/access_token',
                'profile_url' => 'https://graph.instagram.com/me',
                'scope' => 'user_profile,user_media',
                'redirect_uri' => $redirect,
            ],
        ];
        if (!isset($map[$provider])) {
            throw new \InvalidArgumentException('oauth provider unknown');
        }
        $cfg = $map[$provider];
        if ($provider === 'apple') {
            if ($cfg['client_id'] === '' || !$this->appleSecret->isConfigured()) {
                throw new \InvalidArgumentException('oauth provider not configured');
            }
            return $cfg;
        }
        if ($cfg['client_id'] === '' || $cfg['client_secret'] === '') {
            throw new \InvalidArgumentException('oauth provider not configured');
        }
        return $cfg;
    }

    private static function sanitizeNativeRedirect(string $redirect): ?string
    {
        $redirect = trim($redirect);
        if ($redirect === '') {
            return null;
        }
        return str_starts_with($redirect, 'boiteacoeur://') ? $redirect : null;
    }
}
