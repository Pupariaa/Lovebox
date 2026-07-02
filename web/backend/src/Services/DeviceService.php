<?php

declare(strict_types=1);

namespace Bac\Services;

use Bac\Repositories\DeviceRepository;
use Bac\Support\TokenUtil;

final class DeviceService
{
    public function __construct(private DeviceRepository $devices)
    {
    }

    public function register(
        string $uuid,
        ?string $secret,
        array $payload,
        ?string $clientIp
    ): array {
        $uuid = trim($uuid);
        if (strlen($uuid) !== 128 || !ctype_digit($uuid)) {
            throw new \InvalidArgumentException('invalid uuid');
        }
        $region = $this->detectRegion($clientIp, $payload['region'] ?? null);
        $existing = $this->devices->findByUuid($uuid);
        $newSecretPlain = null;

        if ($existing) {
            if (!empty($existing['secret_hash'])) {
                if (!$secret || !password_verify($secret, $existing['secret_hash'])) {
                    throw new \InvalidArgumentException('invalid device secret');
                }
            }
            $this->devices->update((int) $existing['id'], [
                'device_name' => $payload['device_name'] ?? $existing['device_name'],
                'serial_number' => $payload['serial_number'] ?? $existing['serial_number'],
                'region' => $region,
                'firmware_version' => $payload['firmware_version'] ?? $existing['firmware_version'],
            ]);
            $this->devices->touchHeartbeat((int) $existing['id']);
            $deviceId = (int) $existing['id'];
        } else {
            $newSecretPlain = TokenUtil::randomHex(32);
            $deviceId = $this->devices->create([
                'uuid' => $uuid,
                'serial_number' => $payload['serial_number'] ?? '',
                'device_name' => $payload['device_name'] ?? 'BoiteACoeur',
                'secret_hash' => password_hash($newSecretPlain, PASSWORD_BCRYPT, ['cost' => 10]),
                'region' => $region,
                'firmware_version' => $payload['firmware_version'] ?? null,
            ]);
        }

        $device = $this->devices->findById($deviceId);
        $result = [
            'ok' => true,
            'device_id' => $deviceId,
            'uuid' => $uuid,
            'region' => $region,
        ];
        if ($newSecretPlain !== null) {
            $result['device_secret'] = $newSecretPlain;
        }
        return $result;
    }

    public function authenticate(string $uuid, string $secret): array
    {
        $device = $this->devices->findByUuid($uuid);
        if (!$device || empty($device['secret_hash']) || !password_verify($secret, $device['secret_hash'])) {
            throw new \InvalidArgumentException('unauthorized device');
        }
        return $device;
    }

    public function claim(int $userId, string $deviceName, ?string $serialNumber = null): array
    {
        $deviceName = trim($deviceName);
        $serialNumber = $serialNumber !== null ? trim($serialNumber) : null;
        if ($deviceName === '' || strlen($deviceName) > 64) {
            throw new \InvalidArgumentException('invalid device name');
        }
        if ($this->devices->findByOwner($userId)) {
            throw new \InvalidArgumentException('user already owns a device');
        }
        $device = $this->devices->findByDeviceName($deviceName);
        if (!$device && $serialNumber !== null && $serialNumber !== '') {
            $device = $this->devices->findBySerialNumber($serialNumber);
        }
        if (!$device) {
            throw new \InvalidArgumentException('device not found');
        }
        if ($device['owner_user_id'] !== null && (int) $device['owner_user_id'] !== $userId) {
            throw new \InvalidArgumentException('device already claimed');
        }
        if ($device['owner_user_id'] === null) {
            if (!$this->devices->claim((int) $device['id'], $userId)) {
                throw new \InvalidArgumentException('claim failed');
            }
        }
        return $this->formatDevice($this->devices->findById((int) $device['id']));
    }

    public function updateOwned(int $userId, array $fields): array
    {
        $device = $this->devices->findByOwner($userId);
        if (!$device) {
            throw new \InvalidArgumentException('no owned device');
        }
        $update = [];
        if (isset($fields['device_name'])) {
            $update['device_name'] = substr(trim((string) $fields['device_name']), 0, 64);
        }
        if (isset($fields['region_override'])) {
            $update['region_override'] = substr(trim((string) $fields['region_override']), 0, 16);
        }
        if ($update !== []) {
            $this->devices->update((int) $device['id'], $update);
        }
        return $this->formatDevice($this->devices->findById((int) $device['id']));
    }

    public function formatDevice(?array $device): array
    {
        if (!$device) {
            return [];
        }
        $online = false;
        if (!empty($device['last_seen_at'])) {
            $online = (time() - strtotime($device['last_seen_at'])) < 60;
        }
        return [
            'id' => (int) $device['id'],
            'uuid' => $device['uuid'],
            'device_name' => $device['device_name'],
            'serial_number' => $device['serial_number'],
            'region' => $device['region_override'] ?: $device['region'],
            'firmware_version' => $device['firmware_version'],
            'last_seen_at' => $device['last_seen_at'],
            'online' => $online,
        ];
    }

    private function detectRegion(?string $ip, ?string $deviceRegion): string
    {
        if ($deviceRegion && preg_match('/^[A-Z]{2,16}$/', $deviceRegion)) {
            return strtoupper($deviceRegion);
        }
        if ($ip && filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            $json = @file_get_contents('http://ip-api.com/json/' . urlencode($ip) . '?fields=status,countryCode');
            if ($json) {
                $data = json_decode($json, true);
                if (($data['status'] ?? '') === 'success' && !empty($data['countryCode'])) {
                    return strtoupper($data['countryCode']);
                }
            }
        }
        return 'XX';
    }
}
