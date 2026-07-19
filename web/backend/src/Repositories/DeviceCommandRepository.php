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

    public function listRecentForDevice(int $deviceId, int $limit = 10): array
    {
        $limit = max(1, min(50, $limit));
        $stmt = $this->pdo->prepare(
            "SELECT id, command_type, status, payload_json, created_at, delivered_at, acked_at
             FROM device_commands
             WHERE device_id = :did
             ORDER BY created_at DESC
             LIMIT $limit"
        );
        $stmt->execute(['did' => $deviceId]);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $decoded = json_decode((string) ($row['payload_json'] ?? ''), true);
            $row['payload'] = is_array($decoded) ? $decoded : [];
            unset($row['payload_json']);
        }
        return $rows;
    }

    public function otaStats(int $recentHours = 24): array
    {
        $open = $this->pdo->query(
            "SELECT status, COUNT(*) AS total
             FROM device_commands
             WHERE command_type = 'ota' AND status IN ('pending', 'delivered')
             GROUP BY status"
        )->fetchAll();
        $pending = 0;
        $delivered = 0;
        foreach ($open as $row) {
            if ($row['status'] === 'pending') {
                $pending = (int) $row['total'];
            } elseif ($row['status'] === 'delivered') {
                $delivered = (int) $row['total'];
            }
        }
        $recent = $this->pdo->prepare(
            "SELECT status, COUNT(*) AS total
             FROM device_commands
             WHERE command_type = 'ota'
               AND status IN ('acked', 'failed')
               AND COALESCE(acked_at, delivered_at, created_at) >= DATE_SUB(NOW(), INTERVAL :h HOUR)
             GROUP BY status"
        );
        $recent->execute(['h' => $recentHours]);
        $acked = 0;
        $failed = 0;
        foreach ($recent->fetchAll() as $row) {
            if ($row['status'] === 'acked') {
                $acked = (int) $row['total'];
            } elseif ($row['status'] === 'failed') {
                $failed = (int) $row['total'];
            }
        }
        return [
            'pending' => $pending,
            'delivered' => $delivered,
            'in_flight' => $pending + $delivered,
            'acked_recent' => $acked,
            'failed_recent' => $failed,
            'recent_hours' => $recentHours,
        ];
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
