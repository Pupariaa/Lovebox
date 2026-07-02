<?php

declare(strict_types=1);

namespace Bac\Services;

use Bac\Repositories\UserRepository;
use Bac\Support\TokenUtil;

final class AuthService
{
    public function __construct(
        private UserRepository $users,
        private JwtService $jwt,
        private EmailService $email
    ) {
    }

    public function register(string $email, string $password): array
    {
        $email = strtolower(trim($email));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException('invalid email');
        }
        if (strlen($password) < 8) {
            throw new \InvalidArgumentException('password too short');
        }
        if ($this->users->findByEmail($email)) {
            throw new \InvalidArgumentException('email already registered');
        }
        $verifyToken = TokenUtil::randomHex(16);
        $userId = $this->users->create($email, password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]), $verifyToken);
        $this->email->sendVerification($email, $verifyToken);
        return $this->issueTokens($userId, $email);
    }

    public function login(string $email, string $password): array
    {
        $email = strtolower(trim($email));
        $user = $this->users->findByEmail($email);
        if (!$user || !password_verify($password, $user['password_hash'])) {
            throw new \InvalidArgumentException('invalid credentials');
        }
        return $this->issueTokens((int) $user['id'], $user['email']);
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
        return $this->issueTokens((int) $user['id'], $user['email']);
    }

    public function logout(string $refreshToken): void
    {
        $this->users->revokeRefreshToken(TokenUtil::hashToken($refreshToken));
    }

    public function verifyEmail(string $token): bool
    {
        return $this->users->verifyEmail($token);
    }

    private function issueTokens(int $userId, string $email): array
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
            ],
        ];
    }
}
