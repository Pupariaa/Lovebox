<?php

declare(strict_types=1);

namespace Bac\Repositories;

use PDO;

final class UserRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function findByEmail(string $email): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => strtolower(trim($email))]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function create(string $email, string $passwordHash, string $verifyToken): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO users (email, password_hash, email_verify_token) VALUES (:email, :hash, :token)'
        );
        $stmt->execute([
            'email' => strtolower(trim($email)),
            'hash' => $passwordHash,
            'token' => $verifyToken,
        ]);
        return (int) $this->pdo->lastInsertId();
    }

    public function verifyEmail(string $token): bool
    {
        $stmt = $this->pdo->prepare(
            'UPDATE users SET email_verified_at = NOW(), email_verify_token = NULL WHERE email_verify_token = :token'
        );
        $stmt->execute(['token' => $token]);
        return $stmt->rowCount() > 0;
    }

    public function storeRefreshToken(int $userId, string $tokenHash, string $expiresAt): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (:uid, :hash, :exp)'
        );
        $stmt->execute(['uid' => $userId, 'hash' => $tokenHash, 'exp' => $expiresAt]);
    }

    public function findRefreshToken(string $tokenHash): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM refresh_tokens WHERE token_hash = :hash AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1'
        );
        $stmt->execute(['hash' => $tokenHash]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function revokeRefreshToken(string $tokenHash): void
    {
        $stmt = $this->pdo->prepare('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = :hash');
        $stmt->execute(['hash' => $tokenHash]);
    }
}
