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

    private const UPDATABLE_COLUMNS = [
        'uuid',
        'serial_number',
        'device_name',
        'display_name',
        'region',
        'region_override',
        'locale',
        'firmware_version',
        'secret_hash',
    ];

    public function update(int $id, array $fields): void
    {
        $sets = [];
        $params = ['id' => $id];
        foreach ($fields as $key => $value) {
            if (!in_array($key, self::UPDATABLE_COLUMNS, true)) {
                throw new \InvalidArgumentException('column not updatable: ' . $key);
            }
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

    public function revokeSecret(int $deviceId): void
    {
        $stmt = $this->pdo->prepare('UPDATE devices SET secret_hash = NULL WHERE id = :id');
        $stmt->execute(['id' => $deviceId]);
    }

    public function deleteOwned(int $deviceId, int $userId): bool
    {
        $stmt = $this->pdo->prepare(
            'DELETE FROM devices WHERE id = :id AND owner_user_id = :uid'
        );
        $stmt->execute(['id' => $deviceId, 'uid' => $userId]);
        return $stmt->rowCount() > 0;
    }

    public function deleteById(int $deviceId): bool
    {
        $stmt = $this->pdo->prepare('DELETE FROM devices WHERE id = :id');
        $stmt->execute(['id' => $deviceId]);
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

    public function updateTelemetry(int $id, array $t): void
    {
        $sets = ['last_seen_at = NOW()', 'telemetry_at = NOW()'];
        $params = ['id' => $id];
        $allowed = [
            'firmware_version' => 'firmware_version',
            'rssi' => 'rssi',
            'free_heap' => 'free_heap',
            'uptime_s' => 'uptime_s',
            'ip_addr' => 'ip_addr',
            'mac_addr' => 'mac_addr',
        ];
        foreach ($allowed as $key => $column) {
            if (array_key_exists($key, $t) && $t[$key] !== null) {
                $sets[] = "$column = :$key";
                $params[$key] = $t[$key];
            }
        }
        $sql = 'UPDATE devices SET ' . implode(', ', $sets) . ' WHERE id = :id';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
    }

    public function listAll(array $filters = []): array
    {
        $where = [];
        $params = [];
        if (!empty($filters['q'])) {
            $where[] = '(serial_number LIKE :q OR device_name LIKE :q OR display_name LIKE :q OR uuid LIKE :q)';
            $params['q'] = '%' . $filters['q'] . '%';
        }
        if (!empty($filters['version'])) {
            $where[] = 'firmware_version = :version';
            $params['version'] = $filters['version'];
        }
        if (isset($filters['region']) && $filters['region'] !== '') {
            $where[] = 'COALESCE(region_override, region) = :region';
            $params['region'] = $filters['region'];
        }
        if (isset($filters['claimed']) && $filters['claimed'] !== null) {
            $where[] = $filters['claimed']
                ? 'owner_user_id IS NOT NULL'
                : 'owner_user_id IS NULL';
        }
        $sql = 'SELECT id, uuid, serial_number, device_name, display_name, owner_user_id,
                       region, region_override, firmware_version, rssi, free_heap, uptime_s,
                       ip_addr, mac_addr, telemetry_at, last_seen_at, created_at
                FROM devices';
        if ($where !== []) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY last_seen_at IS NULL, last_seen_at DESC, id DESC';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function distinctVersions(): array
    {
        $stmt = $this->pdo->query(
            "SELECT firmware_version AS version, COUNT(*) AS total
             FROM devices
             WHERE firmware_version IS NOT NULL AND firmware_version <> ''
             GROUP BY firmware_version
             ORDER BY total DESC, firmware_version DESC"
        );
        return $stmt->fetchAll();
    }

    public function distinctRegions(): array
    {
        $stmt = $this->pdo->query(
            "SELECT COALESCE(region_override, region) AS region, COUNT(*) AS total
             FROM devices
             WHERE COALESCE(region_override, region) IS NOT NULL
               AND COALESCE(region_override, region) <> ''
             GROUP BY COALESCE(region_override, region)
             ORDER BY total DESC"
        );
        return $stmt->fetchAll();
    }

    public function fleetCounts(int $onlineThresholdSeconds = 120): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT
                COUNT(*) AS total,
                SUM(secret_hash IS NOT NULL) AS registered,
                SUM(owner_user_id IS NOT NULL) AS claimed,
                SUM(owner_user_id IS NULL) AS unclaimed,
                SUM(last_seen_at IS NOT NULL AND last_seen_at >= DATE_SUB(NOW(), INTERVAL :sec SECOND)) AS online
             FROM devices"
        );
        $stmt->execute(['sec' => $onlineThresholdSeconds]);
        $row = $stmt->fetch() ?: [];
        $total = (int) ($row['total'] ?? 0);
        $online = (int) ($row['online'] ?? 0);
        return [
            'total' => $total,
            'registered' => (int) ($row['registered'] ?? 0),
            'claimed' => (int) ($row['claimed'] ?? 0),
            'unclaimed' => (int) ($row['unclaimed'] ?? 0),
            'online' => $online,
            'offline' => max(0, $total - $online),
        ];
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
