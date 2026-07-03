<?php

declare(strict_types=1);

namespace Bac\Repositories;

use PDO;

final class PairingRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function listActiveBySender(int $userId): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT p.*, d.device_name, d.display_name, d.uuid AS target_uuid, d.serial_number,
                    d.last_seen_at, d.firmware_version
             FROM pairings p
             JOIN devices d ON d.id = p.target_device_id
             WHERE p.sender_user_id = :uid AND p.status = 'active'
             ORDER BY p.created_at ASC"
        );
        $stmt->execute(['uid' => $userId]);
        return $stmt->fetchAll();
    }

    public function findActiveBySenderAndTarget(int $userId, int $targetDeviceId): ?array
    {
        $stmt = $this->pdo->prepare(
            "SELECT p.*, d.device_name, d.display_name, d.uuid AS target_uuid
             FROM pairings p
             JOIN devices d ON d.id = p.target_device_id
             WHERE p.sender_user_id = :uid AND p.target_device_id = :tid AND p.status = 'active'
             LIMIT 1"
        );
        $stmt->execute(['uid' => $userId, 'tid' => $targetDeviceId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findActiveByTargetDevice(int $deviceId): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT p.*, u.email AS sender_email, u.first_name, u.last_name
             FROM pairings p
             JOIN users u ON u.id = p.sender_user_id
             WHERE p.target_device_id = :did AND p.status = 'active'
             ORDER BY p.created_at ASC"
        );
        $stmt->execute(['did' => $deviceId]);
        return $stmt->fetchAll();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM pairings WHERE id = :id LIMIT 1');
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

    public function createReciprocalPairing(int $senderUserId, int $targetDeviceId): ?int
    {
        $check = $this->pdo->prepare(
            "SELECT id FROM pairings WHERE sender_user_id = :s AND target_device_id = :t LIMIT 1"
        );
        $check->execute(['s' => $senderUserId, 't' => $targetDeviceId]);
        if ($check->fetch()) {
            return null;
        }
        return $this->createPairing($senderUserId, $targetDeviceId, 'active');
    }

    public function unlink(int $pairingId, int $userId): bool
    {
        $stmt = $this->pdo->prepare(
            "UPDATE pairings SET status = 'rejected', responded_at = NOW()
             WHERE id = :id AND sender_user_id = :uid AND status = 'active'"
        );
        $stmt->execute(['id' => $pairingId, 'uid' => $userId]);
        return $stmt->rowCount() > 0;
    }

    public function createPairingCode(string $code, int $userId, int $deviceId, string $expiresAt): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO pairing_codes (code, owner_user_id, device_id, expires_at)
             VALUES (:code, :uid, :did, :exp)'
        );
        $stmt->execute(['code' => $code, 'uid' => $userId, 'did' => $deviceId, 'exp' => $expiresAt]);
    }

    public function invalidateCodesForUser(int $userId): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE pairing_codes SET consumed_at = NOW()
             WHERE owner_user_id = :uid AND consumed_at IS NULL'
        );
        $stmt->execute(['uid' => $userId]);
    }

    public function findValidCode(string $code): ?array
    {
        $code = strtoupper(trim($code));
        $stmt = $this->pdo->prepare(
            'SELECT * FROM pairing_codes
             WHERE code = :code AND consumed_at IS NULL AND expires_at > NOW()
             LIMIT 1'
        );
        $stmt->execute(['code' => $code]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function consumeCode(string $code): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE pairing_codes SET consumed_at = NOW() WHERE code = :code'
        );
        $stmt->execute(['code' => strtoupper(trim($code))]);
    }
}
