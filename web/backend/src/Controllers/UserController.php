<?php

declare(strict_types=1);

namespace Bac\Controllers;

use Bac\Repositories\UserRepository;
use Bac\Services\EmailService;
use Bac\Support\JsonResponse;
use Bac\Support\TokenUtil;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class UserController
{
    public function __construct(
        private UserRepository $users,
        private EmailService $email
    ) {
    }

    public function me(Request $request, Response $response): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $user = $this->users->findById($userId);
        if (!$user) {
            return JsonResponse::error($response, 'not found', 404);
        }
        return JsonResponse::ok($response, ['ok' => true, 'user' => $this->formatUser($user)]);
    }

    public function updateMe(Request $request, Response $response): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $body = (array) $request->getParsedBody();
        $user = $this->users->findById($userId);
        if (!$user) {
            return JsonResponse::error($response, 'not found', 404);
        }
        $meta = $this->userMeta($user);
        $fields = [];
        if (isset($body['first_name'])) {
            $fields['first_name'] = substr(trim((string) $body['first_name']), 0, 64);
        }
        if (isset($body['last_name'])) {
            $fields['last_name'] = substr(trim((string) $body['last_name']), 0, 64);
        }
        if (isset($body['locale'])) {
            $fields['locale'] = substr(trim((string) $body['locale']), 0, 8);
        }
        if (isset($body['password'])) {
            if (!$meta['can_set_password']) {
                return JsonResponse::error($response, 'password not allowed', 403);
            }
            $password = (string) $body['password'];
            if (strlen($password) < 8) {
                return JsonResponse::error($response, 'password too short', 400);
            }
            $fields['password_hash'] = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
            $fields['password_set_at'] = date('Y-m-d H:i:s');
        }
        if ($fields !== []) {
            $this->users->update($userId, $fields);
            $user = $this->users->findById($userId);
        }
        return JsonResponse::ok($response, ['ok' => true, 'user' => $this->formatUser($user)]);
    }

    public function migrateEmail(Request $request, Response $response): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $body = (array) ($request->getParsedBody() ?? []);
        $contactEmail = strtolower(trim((string) ($body['contact_email'] ?? '')));
        if (!filter_var($contactEmail, FILTER_VALIDATE_EMAIL)) {
            return JsonResponse::error($response, 'invalid email', 400);
        }
        if (str_contains($contactEmail, '@privaterelay.appleid.com')) {
            return JsonResponse::error($response, 'private relay email not allowed', 400);
        }
        $user = $this->users->findById($userId);
        if (!$user) {
            return JsonResponse::error($response, 'not found', 404);
        }
        $existing = $this->users->findByEmail($contactEmail);
        if ($existing && (int) $existing['id'] !== $userId) {
            return JsonResponse::error($response, 'email already registered', 409);
        }
        $token = TokenUtil::randomHex(16);
        $this->users->setContactEmail($userId, $contactEmail, $token);
        $this->email->sendContactEmailVerification($contactEmail, $token);
        return JsonResponse::ok($response, ['ok' => true]);
    }

    public function verifyContactEmail(Request $request, Response $response): Response
    {
        $token = trim((string) (($request->getQueryParams()['token'] ?? '')));
        if ($token === '' || !$this->users->verifyContactEmail($token)) {
            return JsonResponse::error($response, 'invalid token', 400);
        }
        return JsonResponse::ok($response, ['ok' => true]);
    }

    public function setPassword(Request $request, Response $response): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $body = (array) ($request->getParsedBody() ?? []);
        $password = (string) ($body['password'] ?? '');
        if (strlen($password) < 8) {
            return JsonResponse::error($response, 'password too short', 400);
        }
        $user = $this->users->findById($userId);
        if (!$user) {
            return JsonResponse::error($response, 'not found', 404);
        }
        $meta = $this->userMeta($user);
        if (!$meta['can_set_password']) {
            return JsonResponse::error($response, 'contact email not verified', 403);
        }
        $this->users->update($userId, [
            'password_hash' => password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]),
            'password_set_at' => date('Y-m-d H:i:s'),
        ]);
        $user = $this->users->findById($userId);
        return JsonResponse::ok($response, ['ok' => true, 'user' => $this->formatUser($user)]);
    }

    private function formatUser(array $user): array
    {
        $meta = $this->userMeta($user);
        return [
            'id' => (int) $user['id'],
            'email' => $user['email'],
            'first_name' => $user['first_name'] ?? null,
            'last_name' => $user['last_name'] ?? null,
            'locale' => $user['locale'] ?? 'fr',
            'email_verified' => $user['email_verified_at'] !== null,
            'oauth_providers' => $meta['oauth_providers'],
            'has_password' => $meta['has_password'],
            'email_is_private_relay' => $meta['email_is_private_relay'],
            'can_set_password' => $meta['can_set_password'],
            'profile_complete' => $meta['profile_complete'],
            'contact_email' => $user['contact_email'] ?? null,
            'contact_email_verified' => !empty($user['contact_email_verified_at']),
        ];
    }

    /** @return array{oauth_providers: list<string>, has_password: bool, email_is_private_relay: bool, can_set_password: bool, profile_complete: bool} */
    private function userMeta(array $user): array
    {
        $userId = (int) $user['id'];
        $oauthProviders = $this->users->listOAuthProviders($userId);
        $email = strtolower((string) ($user['email'] ?? ''));
        $emailIsRelay = str_contains($email, '@privaterelay.appleid.com');
        $hasPassword = $oauthProviders === [] || !empty($user['password_set_at']);
        $contactVerified = !empty($user['contact_email_verified_at']);
        $canSetPassword = $oauthProviders === [] || $contactVerified;
        $firstName = trim((string) ($user['first_name'] ?? ''));
        return [
            'oauth_providers' => $oauthProviders,
            'has_password' => $hasPassword,
            'email_is_private_relay' => $emailIsRelay,
            'can_set_password' => $canSetPassword,
            'profile_complete' => $firstName !== '',
        ];
    }
}
