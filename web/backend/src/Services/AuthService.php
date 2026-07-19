<?php

declare(strict_types=1);

namespace Bac\Services;

use Bac\Repositories\UserRepository;
use Bac\Support\TokenUtil;

final class AuthService
{
    private bool $requireEmailVerification;

    public function __construct(
        private UserRepository $users,
        private JwtService $jwt,
        private EmailService $email
    ) {
        $settings = require dirname(__DIR__, 2) . '/config/settings.php';
        $this->requireEmailVerification = (bool) ($settings['auth']['require_email_verification'] ?? false);
    }

    public function register(string $email, string $password, string $firstName = ''): array
    {
        $email = strtolower(trim($email));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException('invalid email');
        }
        if (strlen($password) < 8) {
            throw new \InvalidArgumentException('password too short');
        }
        $firstName = trim($firstName);
        if ($firstName === '') {
            throw new \InvalidArgumentException('first_name required');
        }
        $firstName = mb_substr($firstName, 0, 64);
        if ($this->users->findByEmail($email)) {
            throw new \InvalidArgumentException('email already registered');
        }
        $verifyToken = TokenUtil::randomHex(16);
        $userId = $this->users->create(
            $email,
            password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]),
            $verifyToken,
            $firstName
        );
        $this->email->sendVerification($email, $verifyToken);
        return $this->issueTokens($userId, $email, $firstName, false);
    }

    public function login(string $email, string $password): array
    {
        $email = strtolower(trim($email));
        $user = $this->users->findByEmail($email);
        if (!$user || !password_verify($password, $user['password_hash'])) {
            throw new \InvalidArgumentException('invalid credentials');
        }
        $emailVerified = !empty($user['email_verified_at']);
        if ($this->requireEmailVerification && !$emailVerified) {
            throw new \InvalidArgumentException('email_not_verified');
        }
        return $this->issueTokens((int) $user['id'], $user['email'], $user['first_name'] ?? null, $emailVerified);
    }

    public function refresh(string $refreshToken): array
    {
        $hash = TokenUtil::hashToken($refreshToken);
        $row = $this->users->findRefreshToken($hash);
        if (!$row) {
            throw new \InvalidArgumentException('invalid refresh token');
        }
        $user = $this->users->findById((int) $row['user_id']);
        if (!$user) {
            throw new \InvalidArgumentException('user not found');
        }
        $this->users->revokeRefreshToken($hash);
        return $this->issueTokens((int) $user['id'], $user['email'], $user['first_name'] ?? null, !empty($user['email_verified_at']));
    }

    public function logout(string $refreshToken): void
    {
        $this->users->revokeRefreshToken(TokenUtil::hashToken($refreshToken));
    }

    public function verifyEmail(string $token): bool
    {
        return $this->users->verifyEmail($token);
    }

    public function requestPasswordReset(string $email): void
    {
        $email = strtolower(trim($email));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return;
        }
        $user = $this->users->findByEmail($email);
        if (!$user) {
            return;
        }
        $token = TokenUtil::randomHex(24);
        $expiresAt = date('Y-m-d H:i:s', time() + 3600);
        $this->users->setPasswordResetToken((int) $user['id'], $token, $expiresAt);
        $this->email->sendPasswordReset($user['email'], $token);
    }

    public function resetPassword(string $token, string $password): bool
    {
        if (strlen($password) < 8) {
            throw new \InvalidArgumentException('password too short');
        }
        $user = $this->users->findByPasswordResetToken($token);
        if (!$user) {
            return false;
        }
        $userId = (int) $user['id'];
        $this->users->updatePassword($userId, password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]));
        $this->users->revokeAllRefreshTokens($userId);
        return true;
    }

    private function issueTokens(int $userId, string $email, ?string $firstName = null, bool $emailVerified = false): array
    {
        $refresh = TokenUtil::randomHex(32);
        $expiresAt = date('Y-m-d H:i:s', time() + $this->jwt->refreshTtl());
        $this->users->storeRefreshToken($userId, TokenUtil::hashToken($refresh), $expiresAt);
        return [
            'access_token' => $this->jwt->issueAccessToken($userId, $email),
            'refresh_token' => $refresh,
            'expires_in' => $this->jwt->accessTtl(),
            'user' => [
                'id' => $userId,
                'email' => $email,
                'first_name' => $firstName,
                'email_verified' => $emailVerified,
            ],
        ];
    }
}
