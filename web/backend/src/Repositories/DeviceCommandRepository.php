<?php

declare(strict_types=1);

namespace Bac\Repositories;

use PDO;

final class DeviceCommandRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function enqueue(int $deviceId, string $type, array $payload): int
    {
        $stmt = $this->pdo->prepare(
            "INSERT INTO device_commands (device_id, command_type, payload_json, status)
             VALUES (:did, :type, :payload, 'pending')"
        );
        $stmt->execute([
            'did' => $deviceId,
            'type' => $type,
            'payload' => json_encode($payload, JSON_THROW_ON_ERROR),
        ]);
        return (int) $this->pdo->lastInsertId();
    }

    public function claimNext(int $deviceId): ?array
    {
        $this->failStaleDelivered();
        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare(
                "SELECT id, command_type, payload_json FROM device_commands
                 WHERE device_id = :did AND status = 'pending'
                 ORDER BY created_at ASC LIMIT 1 FOR UPDATE"
            );
            $stmt->execute(['did' => $deviceId]);
            $row = $stmt->fetch();
            if (!$row) {
                $this->pdo->commit();
                return null;
            }
            $upd = $this->pdo->prepare(
                "UPDATE device_commands SET status = 'delivered', delivered_at = NOW() WHERE id = :id"
            );
            $upd->execute(['id' => $row['id']]);
            $this->pdo->commit();
            $row['payload'] = json_decode((string) $row['payload_json'], true) ?: [];
            return $row;
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    public function ack(int $commandId, int $deviceId): bool
    {
        $stmt = $this->pdo->prepare(
            "UPDATE device_commands SET status = 'acked', acked_at = NOW()
             WHERE id = :id AND device_id = :did AND status = 'delivered'"
        );
        $stmt->execute(['id' => $commandId, 'did' => $deviceId]);
        return $stmt->rowCount() > 0;
    }

    public function fail(int $commandId, int $deviceId): bool
    {
        $stmt = $this->pdo->prepare(
            "UPDATE device_commands SET status = 'failed'
             WHERE id = :id AND device_id = :did AND status = 'delivered'"
        );
        $stmt->execute(['id' => $commandId, 'did' => $deviceId]);
        return $stmt->rowCount() > 0;
    }

    public function failStaleDelivered(int $olderThanSeconds = 600): int
    {
        $stmt = $this->pdo->prepare(
            "UPDATE device_commands SET status = 'failed'
             WHERE status = 'delivered'
               AND delivered_at IS NOT NULL
               AND delivered_at < DATE_SUB(NOW(), INTERVAL :sec SECOND)"
        );
        $stmt->execute(['sec' => $olderThanSeconds]);
        return $stmt->rowCount();
    }

    public function hasPendingType(int $deviceId, string $type): bool
    {
        $stmt = $this->pdo->prepare(
            "SELECT 1 FROM device_commands
             WHERE device_id = :did AND command_type = :type AND status = 'pending'
             LIMIT 1"
        );
        $stmt->execute(['did' => $deviceId, 'type' => $type]);
        return (bool) $stmt->fetchColumn();
    }

    public function hasOpenType(int $deviceId, string $type): bool
    {
        $stmt = $this->pdo->prepare(
            "SELECT 1 FROM device_commands
             WHERE device_id = :did AND command_type = :type AND status IN ('pending', 'delivered')
             LIMIT 1"
        );
        $stmt->execute(['did' => $deviceId, 'type' => $type]);
        return (bool) $stmt->fetchColumn();
    }

    public function cancelOpenType(int $deviceId, string $type): int
    {
        $stmt = $this->pdo->prepare(
            "UPDATE device_commands SET status = 'failed'
             WHERE device_id = :did AND command_type = :type AND status IN ('pending', 'delivered')"
        );
        $stmt->execute(['did' => $deviceId, 'type' => $type]);
        return $stmt->rowCount();
    }
}
