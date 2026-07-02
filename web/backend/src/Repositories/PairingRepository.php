<?php

declare(strict_types=1);

namespace Bac\Repositories;

use PDO;

final class PairingRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function findActiveBySender(int $userId): ?array
    {
        $stmt = $this->pdo->prepare(
            "SELECT p.*, d.device_name, d.uuid AS target_uuid
             FROM pairings p
             JOIN devices d ON d.id = p.target_device_id
             WHERE p.sender_user_id = :uid AND p.status = 'active'
             LIMIT 1"
        );
        $stmt->execute(['uid' => $userId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findActiveByTargetDevice(int $deviceId): ?array
    {
        $stmt = $this->pdo->prepare(
            "SELECT p.*, u.email AS sender_email
             FROM pairings p
             JOIN users u ON u.id = p.sender_user_id
             WHERE p.target_device_id = :did AND p.status = 'active'
             LIMIT 1"
        );
        $stmt->execute(['did' => $deviceId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function createReciprocalPairing(int $senderUserId, int $targetDeviceId): ?int
    {
        if ($this->findActiveBySender($senderUserId)) {
            return null;
        }
        return $this->createPairing($senderUserId, $targetDeviceId, 'active');
    }

    public function findPendingById(int $id): ?array
    {
        $stmt = $this->pdo->prepare("SELECT * FROM pairings WHERE id = :id AND status = 'pending' LIMIT 1");
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function createPairing(int $senderUserId, int $targetDeviceId, string $status = 'active'): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO pairings (sender_user_id, target_device_id, status, responded_at)
             VALUES (:sender, :target, :status, CASE WHEN :status2 = \'active\' THEN NOW() ELSE NULL END)'
        );
        $stmt->execute([
            'sender' => $senderUserId,
            'target' => $targetDeviceId,
            'status' => $status,
            'status2' => $status,
        ]);
        return (int) $this->pdo->lastInsertId();
    }

    public function updateStatus(int $id, string $status): bool
    {
        $stmt = $this->pdo->prepare(
            "UPDATE pairings SET status = :status, responded_at = NOW() WHERE id = :id AND status = 'pending'"
        );
        $stmt->execute(['status' => $status, 'id' => $id]);
        return $stmt->rowCount() > 0;
    }

    public function createInvite(string $token, int $deviceId, int $createdBy, string $expiresAt): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO invite_tokens (token, device_id, created_by_user_id, expires_at) VALUES (:token, :did, :uid, :exp)'
        );
        $stmt->execute(['token' => $token, 'did' => $deviceId, 'uid' => $createdBy, 'exp' => $expiresAt]);
    }

    public function findInvite(string $token): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM invite_tokens WHERE token = :token AND consumed_at IS NULL AND expires_at > NOW() LIMIT 1'
        );
        $stmt->execute(['token' => $token]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function consumeInvite(string $token): void
    {
        $stmt = $this->pdo->prepare('UPDATE invite_tokens SET consumed_at = NOW() WHERE token = :token');
        $stmt->execute(['token' => $token]);
    }

    public function createRequest(int $fromUserId, int $toDeviceId): int
    {
        $stmt = $this->pdo->prepare(
            "INSERT INTO pairing_requests (from_user_id, to_device_id, status) VALUES (:from, :to, 'pending')"
        );
        $stmt->execute(['from' => $fromUserId, 'to' => $toDeviceId]);
        return (int) $this->pdo->lastInsertId();
    }

    public function findPendingRequest(int $id): ?array
    {
        $stmt = $this->pdo->prepare("SELECT * FROM pairing_requests WHERE id = :id AND status = 'pending' LIMIT 1");
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function updateRequestStatus(int $id, string $status): bool
    {
        $stmt = $this->pdo->prepare(
            "UPDATE pairing_requests SET status = :status, responded_at = NOW() WHERE id = :id AND status = 'pending'"
        );
        $stmt->execute(['status' => $status, 'id' => $id]);
        return $stmt->rowCount() > 0;
    }

    public function listPendingRequestsForDevice(int $deviceId): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT pr.*, u.email AS from_email, p.id AS pairing_id
             FROM pairing_requests pr
             JOIN users u ON u.id = pr.from_user_id
             JOIN pairings p ON p.sender_user_id = pr.from_user_id
                 AND p.target_device_id = pr.to_device_id AND p.status = 'pending'
             WHERE pr.to_device_id = :did AND pr.status = 'pending'
             ORDER BY pr.created_at DESC"
        );
        $stmt->execute(['did' => $deviceId]);
        return $stmt->fetchAll();
    }
}
