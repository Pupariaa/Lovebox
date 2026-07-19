<?php

declare(strict_types=1);

namespace Bac\Services;

use Bac\Repositories\DeviceCommandRepository;
use Bac\Repositories\DeviceRepository;
use Bac\Support\TokenUtil;

final class DeviceService
{
    private const DEVICE_LOCALES = ['fr', 'en', 'it', 'de', 'pt', 'es'];

    public function __construct(
        private DeviceRepository $devices,
        private DeviceCommandRepository $commands,
        private OtaService $ota
    ) {
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
        $serial = trim((string) ($payload['serial_number'] ?? ''));
        if ($serial === '') {
            throw new \InvalidArgumentException('serial_number required');
        }
        $region = $this->detectRegion($clientIp, $payload['region'] ?? null);
        $existing = $this->devices->findByUuid($uuid);
        if (!$existing) {
            $bySerial = $this->devices->findBySerialNumber($serial);
            if ($bySerial) {
                $existing = $bySerial;
            }
        }
        $newSecretPlain = null;

        if ($existing) {
            if (!empty($existing['secret_hash']) && $existing['uuid'] === $uuid) {
                if ($secret && password_verify($secret, $existing['secret_hash'])) {
                } elseif ($secret) {
                    throw new \InvalidArgumentException('invalid device secret');
                } elseif (strcasecmp((string) $existing['serial_number'], $serial) === 0) {
                    $newSecretPlain = TokenUtil::randomHex(32);
                } else {
                    throw new \InvalidArgumentException('invalid device secret');
                }
            } elseif (empty($existing['secret_hash']) && strcasecmp((string) $existing['serial_number'], $serial) === 0) {
                // Secret was revoked (e.g. after unclaim); re-issue a fresh one for this box.
                $newSecretPlain = TokenUtil::randomHex(32);
            }
            $update = [
                'uuid' => $uuid,
                'serial_number' => $serial,
                'device_name' => $payload['device_name'] ?? $existing['device_name'],
                'region' => $region,
                'firmware_version' => $payload['firmware_version'] ?? $existing['firmware_version'],
            ];
            if (!empty($payload['display_name'])) {
                $update['display_name'] = substr(trim((string) $payload['display_name']), 0, 64);
            }
            if ($newSecretPlain !== null) {
                $update['secret_hash'] = password_hash($newSecretPlain, PASSWORD_BCRYPT, ['cost' => 10]);
            }
            $this->devices->update((int) $existing['id'], $update);
            $this->devices->touchHeartbeat((int) $existing['id']);
            $deviceId = (int) $existing['id'];
        } else {
            $newSecretPlain = TokenUtil::randomHex(32);
            $factoryName = $payload['device_name'] ?? 'BoiteACoeur';
            $deviceId = $this->devices->create([
                'uuid' => $uuid,
                'serial_number' => $serial,
                'device_name' => $factoryName,
                'display_name' => $payload['display_name'] ?? $factoryName,
                'secret_hash' => password_hash($newSecretPlain, PASSWORD_BCRYPT, ['cost' => 10]),
                'region' => $region,
                'firmware_version' => $payload['firmware_version'] ?? null,
            ]);
        }

        $deviceRow = $this->devices->findById($deviceId);
        $claimed = $deviceRow !== null && $deviceRow['owner_user_id'] !== null;

        $result = [
            'ok' => true,
            'device_id' => $deviceId,
            'uuid' => $uuid,
            'region' => $region,
            'claimed' => $claimed,
        ];
        if ($newSecretPlain !== null) {
            $result['device_secret'] = $newSecretPlain;
        }
        $fw = isset($payload['firmware_version']) ? (string) $payload['firmware_version'] : null;
        if ($claimed) {
            $update = $this->ota->offerUpdate($deviceId, $fw);
            if ($update) {
                $result['firmware_update'] = $update;
            }
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

    public function claim(int $userId, string $uuid, string $serialNumber): array
    {
        $uuid = trim($uuid);
        $serialNumber = trim($serialNumber);
        if (strlen($uuid) !== 128 || !ctype_digit($uuid)) {
            throw new \InvalidArgumentException('invalid uuid');
        }
        if ($serialNumber === '' || strlen($serialNumber) > 64) {
            throw new \InvalidArgumentException('invalid serial_number');
        }
        $device = $this->devices->findByUuid($uuid);
        if (!$device) {
            $device = $this->devices->findBySerialNumber($serialNumber);
        }
        if (!$device) {
            throw new \InvalidArgumentException('device not found');
        }
        if (strcasecmp($device['serial_number'], $serialNumber) !== 0) {
            throw new \InvalidArgumentException('serial_number mismatch');
        }
        if ($device['uuid'] !== $uuid && $device['owner_user_id'] === null) {
            $this->devices->update((int) $device['id'], ['uuid' => $uuid]);
            $device = $this->devices->findById((int) $device['id']);
        }
        if ($device['owner_user_id'] !== null && (int) $device['owner_user_id'] !== $userId) {
            throw new \InvalidArgumentException('device already claimed');
        }
        if ($device['owner_user_id'] === null) {
            if (!$this->devices->claim((int) $device['id'], $userId)) {
                throw new \InvalidArgumentException('claim failed');
            }
            $this->ota->enqueueForDevice((int) $device['id']);
        }
        return $this->formatDevice($this->devices->findById((int) $device['id']));
    }

    public function listOwned(int $userId): array
    {
        return array_map(
            fn ($d) => $this->formatDevice($d),
            $this->devices->listByOwner($userId)
        );
    }

    public function updateOwned(int $userId, int $deviceId, array $fields): array
    {
        $device = $this->devices->findOwnedByUser($userId, $deviceId);
        if (!$device) {
            throw new \InvalidArgumentException('no owned device');
        }
        $update = [];
        if (isset($fields['display_name'])) {
            $update['display_name'] = substr(trim((string) $fields['display_name']), 0, 64);
        }
        if (isset($fields['region_override'])) {
            $update['region_override'] = substr(trim((string) $fields['region_override']), 0, 16);
        }
        if (isset($fields['locale'])) {
            $update['locale'] = $this->normalizeDeviceLocale((string) $fields['locale']);
        }
        $configPayload = [];
        if (isset($fields['backlight_level'])) {
            $configPayload['backlight_level'] = max(0, min(100, (int) $fields['backlight_level']));
        }
        if (isset($fields['sleep_timeout_s'])) {
            $configPayload['sleep_timeout_s'] = max(5, min(600, (int) $fields['sleep_timeout_s']));
        }
        if (array_key_exists('display_sleep_enabled', $fields)) {
            $configPayload['display_sleep_enabled'] = filter_var($fields['display_sleep_enabled'], FILTER_VALIDATE_BOOLEAN);
        }
        if ($update !== []) {
            $this->devices->update((int) $device['id'], $update);
            if (isset($update['display_name'])) {
                $configPayload['display_name'] = $update['display_name'];
            }
            if (isset($update['region_override'])) {
                $configPayload['region'] = $update['region_override'];
            }
            if (isset($update['locale'])) {
                $configPayload['locale'] = $update['locale'];
            }
        }
        if ($configPayload !== []) {
            $this->commands->cancelOpenType((int) $device['id'], 'config');
            $this->commands->enqueue((int) $device['id'], 'config', $configPayload);
        }
        return $this->formatDevice($this->devices->findById((int) $device['id']));
    }

    public function unclaimOwned(int $userId, int $deviceId): void
    {
        $device = $this->devices->findOwnedByUser($userId, $deviceId);
        if (!$device) {
            throw new \InvalidArgumentException('no owned device');
        }
        if (!$this->devices->unclaim($deviceId, $userId)) {
            throw new \InvalidArgumentException('unclaim failed');
        }
        // Rotate the device credential so a captured secret cannot keep authenticating after
        // the box leaves this owner. The box re-registers and receives a fresh secret.
        $this->devices->revokeSecret($deviceId);
    }

    // Full deletion of an owned device row. Cascades remove pairings, messages, logs and commands.
    // A factory_reset command is enqueued first so the physical box wipes itself when it next polls.
    public function deleteOwned(int $userId, int $deviceId): void
    {
        $device = $this->devices->findOwnedByUser($userId, $deviceId);
        if (!$device) {
            throw new \InvalidArgumentException('no owned device');
        }
        if (!$this->commands->hasPendingType($deviceId, 'factory_reset')) {
            $this->commands->enqueue($deviceId, 'factory_reset', []);
        }
        if (!$this->devices->deleteOwned($deviceId, $userId)) {
            throw new \InvalidArgumentException('delete failed');
        }
    }

    // Device-initiated self-deletion (called by firmware at the end of an on-device factory reset).
    public function deregister(array $device): void
    {
        $this->devices->deleteById((int) $device['id']);
    }

    public function formatDevice(?array $device): array
    {
        if (!$device) {
            return [];
        }
        $lastSeen = $device['last_seen_at'] ?? null;
        $online = false;
        $lastSeenSeconds = null;
        if ($lastSeen) {
            $lastSeenSeconds = time() - strtotime($lastSeen);
            $online = $lastSeenSeconds < 120;
        }
        $displayName = trim((string) ($device['display_name'] ?? ''));
        if ($displayName === '') {
            $displayName = $device['device_name'];
        }
        return [
            'id' => (int) $device['id'],
            'uuid' => $device['uuid'],
            'device_name' => $device['device_name'],
            'display_name' => $displayName,
            'serial_number' => $device['serial_number'],
            'region' => $device['region_override'] ?: $device['region'],
            'region_override' => $device['region_override'] ?? '',
            'locale' => $this->deviceLocale($device),
            'firmware_version' => $device['firmware_version'],
            'last_seen_at' => $lastSeen,
            'last_seen_seconds_ago' => $lastSeenSeconds,
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

    private function normalizeDeviceLocale(string $raw): string
    {
        $locale = strtolower(substr(trim($raw), 0, 8));
        if (!in_array($locale, self::DEVICE_LOCALES, true)) {
            throw new \InvalidArgumentException('invalid locale');
        }
        return $locale;
    }

    private function deviceLocale(array $device): string
    {
        $locale = strtolower(trim((string) ($device['locale'] ?? '')));
        if ($locale !== '' && in_array($locale, self::DEVICE_LOCALES, true)) {
            return $locale;
        }
        return 'fr';
    }
}
