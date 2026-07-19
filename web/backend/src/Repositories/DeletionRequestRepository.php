<?php

declare(strict_types=1);

namespace Bac\Repositories;

use PDO;

final class DeletionRequestRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function create(?int $userId, string $email, string $tokenHash, string $expiresAt, string $action = 'account_delete'): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO deletion_requests (user_id, email, token_hash, expires_at, action)
             VALUES (:uid, :email, :hash, :exp, :action)'
        );
        $stmt->execute([
            'uid' => $userId,
            'email' => strtolower(trim($email)),
            'hash' => $tokenHash,
            'exp' => $expiresAt,
            'action' => $action,
        ]);
        return (int) $this->pdo->lastInsertId();
    }

    public function findPendingByTokenHash(string $tokenHash): ?array
    {
        $stmt = $this->pdo->prepare(
            "SELECT * FROM deletion_requests
             WHERE token_hash = :hash AND status = 'pending' AND expires_at > NOW()
             LIMIT 1"
        );
        $stmt->execute(['hash' => $tokenHash]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function markCompleted(int $id): void
    {
        $stmt = $this->pdo->prepare(
            "UPDATE deletion_requests SET status = 'completed', completed_at = NOW() WHERE id = :id"
        );
        $stmt->execute(['id' => $id]);
    }

    public function cancelPendingForUser(int $userId): void
    {
        $stmt = $this->pdo->prepare(
            "UPDATE deletion_requests SET status = 'cancelled'
             WHERE user_id = :uid AND status = 'pending'"
        );
        $stmt->execute(['uid' => $userId]);
    }
}
