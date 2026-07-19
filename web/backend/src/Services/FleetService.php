<?php

declare(strict_types=1);

namespace Bac\Services;

use Bac\Repositories\DeviceCommandRepository;
use Bac\Repositories\DeviceRepository;
use Bac\Repositories\FirmwareReleaseRepository;

final class FleetService
{
    private const ONLINE_THRESHOLD_SECONDS = 120;

    public function __construct(
        private DeviceRepository $devices,
        private DeviceCommandRepository $commands,
        private FirmwareReleaseRepository $releases,
        private OtaService $ota
    ) {
    }

    public function stats(): array
    {
        $counts = $this->devices->fleetCounts(self::ONLINE_THRESHOLD_SECONDS);
        $versions = array_map(
            fn ($v) => ['version' => (string) $v['version'], 'total' => (int) $v['total']],
            $this->devices->distinctVersions()
        );
        $regions = array_map(
            fn ($r) => ['region' => (string) $r['region'], 'total' => (int) $r['total']],
            $this->devices->distinctRegions()
        );

        $active = $this->releases->getActivePublished();
        $activeAdoption = null;
        if ($active) {
            $onTarget = 0;
            foreach ($versions as $v) {
                if ($v['version'] === (string) $active['version']) {
                    $onTarget = $v['total'];
                    break;
                }
            }
            $total = (int) $counts['total'];
            $activeAdoption = [
                'version' => (string) $active['version'],
                'release_id' => (int) $active['id'],
                'devices_on_target' => $onTarget,
                'total' => $total,
                'percent' => $total > 0 ? round($onTarget * 100 / $total, 1) : 0.0,
            ];
        }

        return [
            'counts' => $counts,
            'versions' => $versions,
            'regions' => $regions,
            'active_release' => $activeAdoption,
            'ota' => $this->commands->otaStats(24),
        ];
    }

    public function listDevices(array $filters): array
    {
        $rows = $this->devices->listAll($filters);
        $now = time();
        return array_map(function (array $d) use ($now): array {
            $lastSeen = $d['last_seen_at'] ?? null;
            $online = false;
            if ($lastSeen) {
                $online = ($now - strtotime((string) $lastSeen)) < self::ONLINE_THRESHOLD_SECONDS;
            }
            $id = (int) $d['id'];
            return [
                'id' => $id,
                'serial_number' => $d['serial_number'],
                'device_name' => $d['device_name'],
                'display_name' => $d['display_name'],
                'uuid' => $d['uuid'],
                'firmware_version' => $d['firmware_version'],
                'region' => $d['region_override'] ?: $d['region'],
                'claimed' => $d['owner_user_id'] !== null,
                'rssi' => $d['rssi'] !== null ? (int) $d['rssi'] : null,
                'free_heap' => $d['free_heap'] !== null ? (int) $d['free_heap'] : null,
                'uptime_s' => $d['uptime_s'] !== null ? (int) $d['uptime_s'] : null,
                'ip' => $d['ip_addr'],
                'mac' => $d['mac_addr'],
                'telemetry_at' => $d['telemetry_at'],
                'last_seen_at' => $lastSeen,
                'online' => $online,
                'has_open_ota_command' => $this->commands->hasOpenType($id, 'ota'),
            ];
        }, $rows);
    }

    public function deviceDetail(int $deviceId): ?array
    {
        $d = $this->devices->findById($deviceId);
        if (!$d) {
            return null;
        }
        $lastSeen = $d['last_seen_at'] ?? null;
        $online = false;
        if ($lastSeen) {
            $online = (time() - strtotime((string) $lastSeen)) < self::ONLINE_THRESHOLD_SECONDS;
        }
        return [
            'id' => (int) $d['id'],
            'serial_number' => $d['serial_number'],
            'device_name' => $d['device_name'],
            'display_name' => $d['display_name'] ?? null,
            'uuid' => $d['uuid'],
            'firmware_version' => $d['firmware_version'],
            'region' => ($d['region_override'] ?? null) ?: ($d['region'] ?? null),
            'claimed' => $d['owner_user_id'] !== null,
            'owner_user_id' => $d['owner_user_id'] !== null ? (int) $d['owner_user_id'] : null,
            'rssi' => isset($d['rssi']) && $d['rssi'] !== null ? (int) $d['rssi'] : null,
            'free_heap' => isset($d['free_heap']) && $d['free_heap'] !== null ? (int) $d['free_heap'] : null,
            'uptime_s' => isset($d['uptime_s']) && $d['uptime_s'] !== null ? (int) $d['uptime_s'] : null,
            'ip' => $d['ip_addr'] ?? null,
            'mac' => $d['mac_addr'] ?? null,
            'telemetry_at' => $d['telemetry_at'] ?? null,
            'last_seen_at' => $lastSeen,
            'created_at' => $d['created_at'] ?? null,
            'online' => $online,
            'has_open_ota_command' => $this->commands->hasOpenType((int) $d['id'], 'ota'),
            'commands' => $this->commands->listRecentForDevice((int) $d['id'], 10),
        ];
    }

    public function sendCommand(array $deviceIds, string $command, array $options = []): array
    {
        $allowed = ['reboot', 'factory_reset', 'config'];
        if (!in_array($command, $allowed, true)) {
            throw new \InvalidArgumentException('unknown command');
        }
        $payload = [];
        if ($command === 'config') {
            if (isset($options['display_name']) && $options['display_name'] !== '') {
                $payload['display_name'] = substr((string) $options['display_name'], 0, 64);
            }
            if (isset($options['region']) && $options['region'] !== '') {
                $payload['region'] = substr((string) $options['region'], 0, 16);
            }
            if ($payload === []) {
                throw new \InvalidArgumentException('config command needs display_name or region');
            }
        }

        $results = [];
        $enqueued = 0;
        foreach ($deviceIds as $rawId) {
            $deviceId = (int) $rawId;
            if ($deviceId <= 0) {
                continue;
            }
            $device = $this->devices->findById($deviceId);
            if (!$device) {
                $results[] = ['device_id' => $deviceId, 'enqueued' => false, 'reason' => 'not found'];
                continue;
            }
            if ($this->commands->hasPendingType($deviceId, $command)) {
                $results[] = ['device_id' => $deviceId, 'enqueued' => false, 'reason' => 'already pending'];
                continue;
            }
            $commandId = $this->commands->enqueue($deviceId, $command, $payload);
            $enqueued++;
            $results[] = ['device_id' => $deviceId, 'enqueued' => true, 'command_id' => $commandId];
        }
        return [
            'command' => $command,
            'requested' => count($deviceIds),
            'enqueued' => $enqueued,
            'results' => $results,
        ];
    }

    public function notifyBatch(array $deviceIds, ?int $releaseId, bool $force): array
    {
        $results = [];
        $enqueued = 0;
        foreach ($deviceIds as $rawId) {
            $deviceId = (int) $rawId;
            if ($deviceId <= 0) {
                continue;
            }
            try {
                $data = $this->ota->notifyDevice(['device_id' => $deviceId], $releaseId, $force);
                if (!empty($data['enqueued'])) {
                    $enqueued++;
                }
                $results[] = ['device_id' => $deviceId] + $data;
            } catch (\InvalidArgumentException $e) {
                $results[] = [
                    'device_id' => $deviceId,
                    'enqueued' => false,
                    'reason' => $e->getMessage(),
                ];
            }
        }
        return [
            'requested' => count($deviceIds),
            'enqueued' => $enqueued,
            'results' => $results,
        ];
    }
}
