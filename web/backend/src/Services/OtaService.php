<?php

declare(strict_types=1);

namespace Bac\Services;

use Bac\Repositories\DeviceCommandRepository;
use Bac\Repositories\DeviceRepository;
use Bac\Repositories\FirmwareReleaseRepository;

final class OtaService
{
    public function __construct(
        private FirmwareReleaseRepository $releases,
        private DeviceRepository $devices,
        private DeviceCommandRepository $commands,
        private array $settings
    ) {
    }

    public static function isNewer(string $available, ?string $current): bool
    {
        $available = trim($available);
        $current = trim((string) $current);
        if ($available === '') {
            return false;
        }
        if ($current === '') {
            return true;
        }
        return version_compare($available, $current, '>');
    }

    public function listReleases(): array
    {
        return array_map(fn ($r) => $this->formatRelease($r), $this->releases->listAll());
    }

    public function buildPayload(array $release): array
    {
        $base = rtrim((string) ($this->settings['ota']['public_url'] ?? ''), '/');
        $backups = $this->settings['ota']['backup_urls'] ?? [];
        $verPath = rawurlencode($release['version']);
        $payload = [
            'version' => $release['version'],
            'url' => $base . '/updates/' . $verPath . '/firmware.bin',
            'sha256' => $release['firmware_sha256'],
            'size' => (int) $release['firmware_size'],
        ];
        foreach ($backups as $index => $backupBase) {
            $backupBase = rtrim((string) $backupBase, '/');
            if ($backupBase === '') {
                continue;
            }
            $suffix = $index === 0 ? '_b1' : '_b2';
            $payload['url' . $suffix] = $backupBase . '/updates/' . $verPath . '/firmware.bin';
        }
        if (!empty($release['assets_file'])) {
            $payload['assets_url'] = $base . '/updates/' . $verPath . '/assets.bacassets';
            $payload['assets_sha256'] = $release['assets_sha256'];
            $payload['assets_size'] = (int) $release['assets_size'];
            $payload['assets_manifest_url'] = $base . '/updates/' . $verPath . '/assets.manifest';
            foreach ($backups as $index => $backupBase) {
                $backupBase = rtrim((string) $backupBase, '/');
                if ($backupBase === '') {
                    continue;
                }
                $suffix = $index === 0 ? '_b1' : '_b2';
                $payload['assets_url' . $suffix] = $backupBase . '/updates/' . $verPath . '/assets.bacassets';
                $payload['assets_manifest_url' . $suffix] = $backupBase . '/updates/' . $verPath . '/assets.manifest';
            }
        }
        return $payload;
    }

    public function offerUpdate(int $deviceId, ?string $currentFw): ?array
    {
        if (!$this->devices->isClaimed($deviceId)) {
            return null;
        }
        $release = $this->getEligibleRelease($currentFw);
        if (!$release) {
            return null;
        }
        if (!$this->commands->hasOpenType($deviceId, 'ota')) {
            $this->commands->enqueue($deviceId, 'ota', $this->buildPayload($release));
        }
        return $this->buildPayload($release);
    }

    public function enqueueForDevice(int $deviceId): bool
    {
        if (!$this->devices->isClaimed($deviceId)) {
            return false;
        }
        $device = $this->devices->findById($deviceId);
        if (!$device) {
            return false;
        }
        $current = isset($device['firmware_version']) ? (string) $device['firmware_version'] : null;
        $release = $this->getEligibleRelease($current);
        if (!$release) {
            return false;
        }
        if ($this->commands->hasOpenType($deviceId, 'ota')) {
            return false;
        }
        $this->commands->enqueue($deviceId, 'ota', $this->buildPayload($release));
        return true;
    }

    public function lookupDevice(?string $serial, ?string $uuid, ?int $deviceId): ?array
    {
        $device = null;
        if ($deviceId !== null && $deviceId > 0) {
            $device = $this->devices->findById($deviceId);
        } elseif ($uuid !== null && $uuid !== '') {
            $device = $this->devices->findByUuid(trim($uuid));
        } elseif ($serial !== null && $serial !== '') {
            $device = $this->devices->findBySerialNumber(trim($serial));
        }
        if (!$device) {
            return null;
        }
        $id = (int) $device['id'];
        $lastSeen = $device['last_seen_at'] ?? null;
        $online = false;
        if ($lastSeen) {
            $online = (time() - strtotime((string) $lastSeen)) < 120;
        }
        return [
            'id' => $id,
            'serial_number' => $device['serial_number'],
            'uuid' => $device['uuid'],
            'device_name' => $device['device_name'],
            'firmware_version' => $device['firmware_version'],
            'claimed' => $device['owner_user_id'] !== null,
            'last_seen_at' => $lastSeen,
            'online' => $online,
            'has_open_ota_command' => $this->commands->hasOpenType($id, 'ota'),
        ];
    }

    public function notifyDevice(array $identifiers, ?int $releaseId = null, bool $force = false): array
    {
        $device = null;
        if (!empty($identifiers['device_id'])) {
            $device = $this->devices->findById((int) $identifiers['device_id']);
        } elseif (!empty($identifiers['uuid'])) {
            $device = $this->devices->findByUuid((string) $identifiers['uuid']);
        } elseif (!empty($identifiers['serial_number'])) {
            $device = $this->devices->findBySerialNumber((string) $identifiers['serial_number']);
        }
        if (!$device) {
            throw new \InvalidArgumentException('device not found');
        }
        $deviceId = (int) $device['id'];
        if (!$force && !$this->devices->isClaimed($deviceId)) {
            throw new \InvalidArgumentException('device not claimed');
        }
        $release = null;
        if ($releaseId !== null && $releaseId > 0) {
            $release = $this->releases->findById($releaseId);
            if (!$release || empty($release['published'])) {
                throw new \InvalidArgumentException('release not found or not published');
            }
        } else {
            $release = $this->releases->getActivePublished();
        }
        if (!$release) {
            throw new \InvalidArgumentException('no published release');
        }
        $current = isset($device['firmware_version']) ? (string) $device['firmware_version'] : '';
        if (!$force) {
            if ($current !== '' && !self::isNewer((string) $release['version'], $current)) {
                return [
                    'enqueued' => false,
                    'reason' => 'already up to date',
                    'device_id' => $deviceId,
                ];
            }
            if (!empty($release['min_version']) && $current !== '') {
                if (version_compare($current, (string) $release['min_version'], '<')) {
                    return [
                        'enqueued' => false,
                        'reason' => 'below min_version',
                        'device_id' => $deviceId,
                    ];
                }
            }
        }
        if ($force) {
            $this->commands->cancelOpenType($deviceId, 'ota');
        } elseif ($this->commands->hasOpenType($deviceId, 'ota')) {
            return [
                'enqueued' => false,
                'reason' => 'open ota command exists',
                'device_id' => $deviceId,
            ];
        }
        $commandId = $this->commands->enqueue($deviceId, 'ota', $this->buildPayload($release));
        return [
            'enqueued' => true,
            'device_id' => $deviceId,
            'command_id' => $commandId,
            'release_version' => $release['version'],
        ];
    }

    public function checkForDevice(?string $currentFw): ?array
    {
        $release = $this->getEligibleRelease($currentFw);
        if (!$release) {
            return null;
        }
        return $this->buildPayload($release);
    }

    public function publish(int $releaseId, bool $notifyFleet = true): array
    {
        $release = $this->releases->findById($releaseId);
        if (!$release) {
            throw new \InvalidArgumentException('release not found');
        }
        if (!$this->releases->publish($releaseId)) {
            throw new \InvalidArgumentException('publish failed');
        }
        $release = $this->releases->findById($releaseId);
        $enqueued = $notifyFleet ? $this->notifyEligibleDevices($release) : 0;
        return [
            'release' => $this->formatRelease($release),
            'devices_notified' => $enqueued,
        ];
    }

    public function notifyEligibleDevices(?array $release = null): int
    {
        $release ??= $this->releases->getActivePublished();
        if (!$release) {
            return 0;
        }
        $payload = $this->buildPayload($release);
        $count = 0;
        foreach ($this->devices->listAllWithSecret() as $device) {
            if (empty($device['owner_user_id'])) {
                continue;
            }
            $deviceId = (int) $device['id'];
            $current = $device['firmware_version'] ?? null;
            if (!self::isNewer($release['version'], is_string($current) ? $current : null)) {
                continue;
            }
            if (!empty($release['min_version']) && $current !== null && $current !== '') {
                if (version_compare($current, (string) $release['min_version'], '<')) {
                    continue;
                }
            }
            if ($this->commands->hasOpenType($deviceId, 'ota')) {
                continue;
            }
            $this->commands->enqueue($deviceId, 'ota', $payload);
            $count++;
        }
        return $count;
    }

    public function notifyPublishedRelease(int $releaseId): array
    {
        $release = $this->releases->findById($releaseId);
        if (!$release) {
            throw new \InvalidArgumentException('release not found');
        }
        if (empty($release['published'])) {
            throw new \InvalidArgumentException('release not published');
        }
        $payload = $this->buildPayload($release);
        $count = 0;
        foreach ($this->devices->listAllWithSecret() as $device) {
            if (empty($device['owner_user_id'])) {
                continue;
            }
            $deviceId = (int) $device['id'];
            $current = $device['firmware_version'] ?? null;
            $current = is_string($current) ? $current : '';
            if ($current !== '' && version_compare($current, (string) $release['version'], '>')) {
                continue;
            }
            if (!empty($release['min_version']) && $current !== '') {
                if (version_compare($current, (string) $release['min_version'], '<')) {
                    continue;
                }
            }
            $this->commands->cancelOpenType($deviceId, 'ota');
            $this->commands->enqueue($deviceId, 'ota', $payload);
            $count++;
        }
        return ['devices_notified' => $count];
    }

    public function storageRoot(): string
    {
        $root = trim((string) ($this->settings['ota']['storage_path'] ?? ''));
        if ($root === '') {
            throw new \RuntimeException('OTA storage path not configured');
        }
        return $root;
    }

    public function versionDir(string $version): string
    {
        $root = rtrim($this->storageRoot(), '/\\');
        if ($root === '') {
            throw new \RuntimeException('OTA storage path not configured');
        }
        return $root . DIRECTORY_SEPARATOR . $version;
    }

    public function formatRelease(?array $release): array
    {
        if (!$release) {
            return [];
        }
        return [
            'id' => (int) $release['id'],
            'version' => $release['version'],
            'channel' => $release['channel'],
            'firmware_size' => (int) $release['firmware_size'],
            'firmware_sha256' => $release['firmware_sha256'],
            'assets_size' => $release['assets_size'] !== null ? (int) $release['assets_size'] : null,
            'assets_sha256' => $release['assets_sha256'],
            'min_version' => $release['min_version'],
            'notes' => $release['notes'],
            'published' => (bool) $release['published'],
            'published_at' => $release['published_at'],
            'created_at' => $release['created_at'],
            'firmware_url' => $this->buildPayload($release)['url'],
            'assets_url' => !empty($release['assets_file'])
                ? $this->buildPayload($release)['assets_url'] ?? null
                : null,
        ];
    }

    private function getEligibleRelease(?string $currentFw): ?array
    {
        $release = $this->releases->getActivePublished();
        if (!$release) {
            return null;
        }
        if (!self::isNewer($release['version'], $currentFw)) {
            return null;
        }
        if (!empty($release['min_version']) && $currentFw !== null && $currentFw !== '') {
            if (version_compare($currentFw, (string) $release['min_version'], '<')) {
                return null;
            }
        }
        return $release;
    }
}
