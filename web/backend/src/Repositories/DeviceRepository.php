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
        $stmt = $this->pdo->prepare('SELECT * FROM devices WHERE owner_user_id = :uid LIMIT 1');
        $stmt->execute(['uid' => $userId]);
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
        $stmt = $this->pdo->prepare(
            'INSERT INTO devices (uuid, serial_number, device_name, secret_hash, region, firmware_version, last_seen_at)
             VALUES (:uuid, :serial, :name, :secret, :region, :fw, NOW())'
        );
        $stmt->execute([
            'uuid' => $data['uuid'],
            'serial' => $data['serial_number'] ?? '',
            'name' => $data['device_name'] ?? 'BoiteACoeur',
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
}
