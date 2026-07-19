<?php

declare(strict_types=1);

namespace Bac\Repositories;

use PDO;

final class OAuthCodeRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function store(
        string $codeHash,
        string $accessToken,
        string $refreshToken,
        int $expiresIn,
        int $ttlSeconds
    ): void {
        $stmt = $this->pdo->prepare(
            'INSERT INTO oauth_exchange_codes (code_hash, access_token, refresh_token, expires_in, expires_at)
             VALUES (:hash, :access, :refresh, :expires_in, DATE_ADD(NOW(), INTERVAL :ttl SECOND))'
        );
        $stmt->execute([
            'hash' => $codeHash,
            'access' => $accessToken,
            'refresh' => $refreshToken,
            'expires_in' => $expiresIn,
            'ttl' => $ttlSeconds,
        ]);
    }

    public function consume(string $codeHash): ?array
    {
        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare(
                'SELECT * FROM oauth_exchange_codes
                 WHERE code_hash = :hash AND expires_at > NOW()
                 LIMIT 1 FOR UPDATE'
            );
            $stmt->execute(['hash' => $codeHash]);
            $row = $stmt->fetch();
            if (!$row) {
                $this->pdo->commit();
                return null;
            }
            if ($row['consumed_at'] === null) {
                $update = $this->pdo->prepare(
                    'UPDATE oauth_exchange_codes SET consumed_at = NOW() WHERE id = :id'
                );
                $update->execute(['id' => (int) $row['id']]);
                $this->pdo->commit();
                return $row;
            }
            $consumedAt = strtotime((string) $row['consumed_at']);
            if ($consumedAt === false || $consumedAt < time() - 120) {
                $this->pdo->commit();
                return null;
            }
            $this->pdo->commit();
            return $row;
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    public function purgeExpired(): void
    {
        $this->pdo->prepare(
            'DELETE FROM oauth_exchange_codes WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)'
        )->execute();
    }
}
