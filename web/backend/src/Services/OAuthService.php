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
        private JwtService $jwt
    ) {
        $this->settings = require dirname(__DIR__, 2) . '/config/settings.php';
    }

    public function startUrl(string $provider): string
    {
        $provider = strtolower($provider);
        $cfg = $this->providerConfig($provider);
        $state = TokenUtil::randomHex(16);
        $params = [
            'client_id' => $cfg['client_id'],
            'redirect_uri' => $cfg['redirect_uri'],
            'response_type' => 'code',
            'scope' => $cfg['scope'],
            'state' => $state,
        ];
        return $cfg['auth_url'] . '?' . http_build_query($params);
    }

    public function handleCallback(string $provider, array $params): array
    {
        $provider = strtolower($provider);
        if (empty($params['code'])) {
            throw new \InvalidArgumentException('missing oauth code');
        }
        $cfg = $this->providerConfig($provider);
        $profile = $this->exchangeCode($provider, $cfg, (string) $params['code']);
        $email = strtolower(trim((string) ($profile['email'] ?? '')));
        if ($email === '') {
            throw new \InvalidArgumentException('email not provided by provider');
        }
        $oauthId = (string) ($profile['id'] ?? '');
        $user = $this->users->findByOAuth($provider, $oauthId);
        if (!$user) {
            $existing = $this->users->findByEmail($email);
            if ($existing) {
                $this->users->linkOAuth((int) $existing['id'], $provider, $oauthId);
                $user = $existing;
            } else {
                $userId = $this->users->createOAuthUser($email, $provider, $oauthId);
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
        $body = http_build_query([
            'client_id' => $cfg['client_id'],
            'client_secret' => $cfg['client_secret'],
            'code' => $code,
            'grant_type' => 'authorization_code',
            'redirect_uri' => $cfg['redirect_uri'],
        ]);
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
        if (empty($token['access_token'])) {
            throw new \InvalidArgumentException('oauth token missing');
        }
        $profileUrl = $cfg['profile_url'];
        if ($provider === 'facebook' || $provider === 'instagram') {
            $profileUrl .= '?fields=id,email,name&access_token=' . urlencode($token['access_token']);
        }
        $profileCtx = stream_context_create(['http' => ['timeout' => 12]]);
        $profileJson = @file_get_contents($profileUrl, false, $profileCtx);
        if (!$profileJson && !empty($token['id_token']) && $provider === 'google') {
            $parts = explode('.', (string) $token['id_token']);
            if (isset($parts[1])) {
                $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);
                return is_array($payload) ? $payload : [];
            }
        }
        $profile = json_decode((string) $profileJson, true);
        return is_array($profile) ? $profile : [];
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
        if (!isset($map[$provider]) || $map[$provider]['client_id'] === '') {
            throw new \InvalidArgumentException('oauth provider not configured');
        }
        return $map[$provider];
    }
}
