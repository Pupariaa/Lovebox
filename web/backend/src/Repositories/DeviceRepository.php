<?php

declare(strict_types=1);

namespace Bac\Repositories;

use PDO;

final class DeviceRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function findByUuid(string $uuid): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM devices WHERE uuid = :uuid LIMIT 1');
        $stmt->execute(['uuid' => $uuid]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM devices WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findByOwner(int $userId): ?array
    {
        $rows = $this->listByOwner($userId);
        return $rows[0] ?? null;
    }

    public function resolveDeliveryDeviceId(int $targetDeviceId): int
    {
        $device = $this->findById($targetDeviceId);
        if (!$device || $device['owner_user_id'] === null) {
            return $targetDeviceId;
        }
        $primary = $this->findByOwner((int) $device['owner_user_id']);
        if (!$primary) {
            return $targetDeviceId;
        }
        return (int) $primary['id'];
    }

    public function listByOwner(int $userId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM devices WHERE owner_user_id = :uid
             ORDER BY last_seen_at IS NULL, last_seen_at DESC, id DESC'
        );
        $stmt->execute(['uid' => $userId]);
        return $stmt->fetchAll();
    }

    public function findOwnedByUser(int $userId, int $deviceId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM devices WHERE id = :id AND owner_user_id = :uid LIMIT 1'
        );
        $stmt->execute(['id' => $deviceId, 'uid' => $userId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findByDeviceName(string $name): ?array
    {
        $name = trim($name);
        if ($name === '') {
            return null;
        }
        $stmt = $this->pdo->prepare(
            'SELECT * FROM devices WHERE LOWER(device_name) = LOWER(:name) LIMIT 1'
        );
        $stmt->execute(['name' => $name]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findBySerialNumber(string $serial): ?array
    {
        $serial = trim($serial);
        if ($serial === '') {
            return null;
        }
        $stmt = $this->pdo->prepare(
            'SELECT * FROM devices WHERE LOWER(serial_number) = LOWER(:serial) LIMIT 1'
        );
        $stmt->execute(['serial' => $serial]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function create(array $data): int
    {
        $displayName = $data['display_name'] ?? $data['device_name'] ?? 'BoiteACoeur';
        $stmt = $this->pdo->prepare(
            'INSERT INTO devices (uuid, serial_number, device_name, display_name, secret_hash, region, firmware_version, last_seen_at)
             VALUES (:uuid, :serial, :name, :display, :secret, :region, :fw, NOW())'
        );
        $stmt->execute([
            'uuid' => $data['uuid'],
            'serial' => $data['serial_number'] ?? '',
            'name' => $data['device_name'] ?? 'BoiteACoeur',
            'display' => $displayName,
            'secret' => $data['secret_hash'] ?? null,
            'region' => $data['region'] ?? null,
            'fw' => $data['firmware_version'] ?? null,
        ]);
        return (int) $this->pdo->lastInsertId();
    }

    public function update(int $id, array $fields): void
    {
        $sets = [];
        $params = ['id' => $id];
        foreach ($fields as $key => $value) {
            $sets[] = "$key = :$key";
            $params[$key] = $value;
        }
        if ($sets === []) {
            return;
        }
        $sql = 'UPDATE devices SET ' . implode(', ', $sets) . ' WHERE id = :id';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
    }

    public function claim(int $deviceId, int $userId): bool
    {
        $stmt = $this->pdo->prepare(
            'UPDATE devices SET owner_user_id = :uid WHERE id = :id AND owner_user_id IS NULL'
        );
        $stmt->execute(['uid' => $userId, 'id' => $deviceId]);
        return $stmt->rowCount() > 0;
    }

    public function unclaim(int $deviceId, int $userId): bool
    {
        $stmt = $this->pdo->prepare(
            'UPDATE devices SET owner_user_id = NULL WHERE id = :id AND owner_user_id = :uid'
        );
        $stmt->execute(['uid' => $userId, 'id' => $deviceId]);
        return $stmt->rowCount() > 0;
    }

    public function touchHeartbeat(int $id, ?string $firmwareVersion = null): void
    {
        if ($firmwareVersion !== null) {
            $stmt = $this->pdo->prepare(
                'UPDATE devices SET last_seen_at = NOW(), firmware_version = :fw WHERE id = :id'
            );
            $stmt->execute(['fw' => $firmwareVersion, 'id' => $id]);
            return;
        }
        $stmt = $this->pdo->prepare('UPDATE devices SET last_seen_at = NOW() WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }

    public function listAllWithSecret(): array
    {
        $stmt = $this->pdo->query(
            'SELECT id, uuid, serial_number, firmware_version, last_seen_at, owner_user_id
             FROM devices
             WHERE secret_hash IS NOT NULL
             ORDER BY id ASC'
        );
        return $stmt->fetchAll();
    }

    public function isClaimed(int $deviceId): bool
    {
        $stmt = $this->pdo->prepare('SELECT owner_user_id FROM devices WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $deviceId]);
        $owner = $stmt->fetchColumn();
        return $owner !== false && $owner !== null;
    }
}
