<?php

declare(strict_types=1);

namespace Bac\Repositories;

use Bac\Support\TokenUtil;
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

    public function setPasswordResetToken(int $userId, string $token, string $expiresAt): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE users SET password_reset_token = :token, password_reset_expires_at = :exp WHERE id = :id'
        );
        $stmt->execute(['token' => $token, 'exp' => $expiresAt, 'id' => $userId]);
    }

    public function findByPasswordResetToken(string $token): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM users WHERE password_reset_token = :token AND password_reset_expires_at > NOW() LIMIT 1'
        );
        $stmt->execute(['token' => $token]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function updatePassword(int $userId, string $passwordHash): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE users SET password_hash = :hash, password_reset_token = NULL, password_reset_expires_at = NULL WHERE id = :id'
        );
        $stmt->execute(['hash' => $passwordHash, 'id' => $userId]);
    }

    public function revokeAllRefreshTokens(int $userId): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = :id AND revoked_at IS NULL'
        );
        $stmt->execute(['id' => $userId]);
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

    public function update(int $userId, array $fields): void
    {
        $sets = [];
        $params = ['id' => $userId];
        foreach ($fields as $key => $value) {
            $sets[] = "$key = :$key";
            $params[$key] = $value;
        }
        if ($sets === []) {
            return;
        }
        $sql = 'UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = :id';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
    }

    public function findByOAuth(string $provider, string $providerUserId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT u.* FROM users u
             JOIN oauth_identities o ON o.user_id = u.id
             WHERE o.provider = :p AND o.provider_user_id = :pid LIMIT 1'
        );
        $stmt->execute(['p' => $provider, 'pid' => $providerUserId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function linkOAuth(int $userId, string $provider, string $providerUserId): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT IGNORE INTO oauth_identities (provider, provider_user_id, user_id)
             VALUES (:p, :pid, :uid)'
        );
        $stmt->execute(['p' => $provider, 'pid' => $providerUserId, 'uid' => $userId]);
    }

    public function createOAuthUser(string $email, string $provider, string $providerUserId): int
    {
        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare(
                'INSERT INTO users (email, password_hash, email_verified_at) VALUES (:email, :hash, NOW())'
            );
            $stmt->execute([
                'email' => strtolower(trim($email)),
                'hash' => password_hash(TokenUtil::randomHex(24), PASSWORD_BCRYPT, ['cost' => 12]),
            ]);
            $userId = (int) $this->pdo->lastInsertId();
            $this->linkOAuth($userId, $provider, $providerUserId);
            $this->pdo->commit();
            return $userId;
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }
}
