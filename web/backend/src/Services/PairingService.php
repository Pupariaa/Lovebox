<?php

declare(strict_types=1);

namespace Bac\Services;

use Bac\Repositories\DeviceRepository;
use Bac\Repositories\PairingRepository;
use PDO;

final class PairingService
{
    private const CODE_TTL_SEC = 900;
    private const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    public function __construct(
        private PairingRepository $pairings,
        private DeviceRepository $devices,
        private PDO $pdo
    ) {
    }

    public function generateCode(int $userId, ?int $deviceId = null): array
    {
        $owned = $deviceId
            ? $this->devices->findOwnedByUser($userId, $deviceId)
            : $this->devices->findByOwner($userId);
        if (!$owned) {
            throw new \InvalidArgumentException('claim your device first');
        }
        $this->pairings->invalidateCodesForUser($userId);
        $code = $this->randomCode();
        $expiresAt = date('Y-m-d H:i:s', time() + self::CODE_TTL_SEC);
        $this->pairings->createPairingCode($code, $userId, (int) $owned['id'], $expiresAt);
        return [
            'code' => $code,
            'expires_at' => $expiresAt,
            'device_id' => (int) $owned['id'],
        ];
    }

    public function acceptCode(int $userId, string $rawCode, ?int $fromDeviceId = null): array
    {
        $code = $this->normalizeCode($rawCode);
        if ($code === '') {
            throw new \InvalidArgumentException('invalid code');
        }
        $entry = $this->pairings->findValidCode($code);
        if (!$entry) {
            throw new \InvalidArgumentException('invalid or expired code');
        }
        $ownerId = (int) $entry['owner_user_id'];
        if ($ownerId === $userId) {
            throw new \InvalidArgumentException('cannot link to yourself');
        }
        $targetDevice = $this->devices->findById((int) $entry['device_id']);
        if (!$targetDevice) {
            throw new \InvalidArgumentException('device not found');
        }
        $accepterDevice = $fromDeviceId
            ? $this->devices->findOwnedByUser($userId, $fromDeviceId)
            : $this->devices->findByOwner($userId);
        if (!$accepterDevice) {
            throw new \InvalidArgumentException('claim your device first');
        }
        if ((int) $accepterDevice['id'] === (int) $targetDevice['id']) {
            throw new \InvalidArgumentException('cannot link to your own device');
        }

        $this->pdo->beginTransaction();
        try {
            $this->pairings->consumeCode($code);
            $this->pairings->createReciprocalPairing($userId, (int) $targetDevice['id']);
            $this->pairings->createReciprocalPairing($ownerId, (int) $accepterDevice['id']);
            $this->pdo->commit();
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }

        return $this->getState($userId);
    }

    public function unlink(int $userId, int $pairingId): void
    {
        if (!$this->pairings->unlink($pairingId, $userId)) {
            throw new \InvalidArgumentException('pairing not found');
        }
    }

    public function getState(int $userId): array
    {
        $ownedList = $this->devices->listByOwner($userId);
        $owned = $ownedList[0] ?? null;
        if ($owned) {
            $this->repairReciprocalPairings($userId, (int) $owned['id']);
        }
        $active = $this->pairings->listActiveBySender($userId);
        return [
            'owned_devices' => array_map(static fn ($d) => [
                'id' => (int) $d['id'],
                'device_name' => $d['device_name'],
                'display_name' => trim((string) ($d['display_name'] ?? '')) ?: $d['device_name'],
                'uuid' => $d['uuid'],
                'serial_number' => $d['serial_number'],
                'last_seen_at' => $d['last_seen_at'],
            ], $ownedList),
            'owned_device' => $owned ? [
                'id' => (int) $owned['id'],
                'device_name' => $owned['device_name'],
                'display_name' => trim((string) ($owned['display_name'] ?? '')) ?: $owned['device_name'],
                'uuid' => $owned['uuid'],
            ] : null,
            'linked_targets' => array_map(fn ($row) => $this->formatTarget($row), $active),
            'linked_target' => isset($active[0]) ? $this->formatTarget($active[0]) : null,
            'pending_requests' => [],
        ];
    }

    public function hasActivePairingTo(int $userId, int $targetDeviceId): bool
    {
        return $this->pairings->findActiveBySenderAndTarget($userId, $targetDeviceId) !== null;
    }

    private function repairReciprocalPairings(int $userId, int $ownedDeviceId): void
    {
        $incoming = $this->pairings->findActiveByTargetDevice($ownedDeviceId);
        foreach ($incoming as $row) {
            $partnerDevice = $this->devices->findByOwner((int) $row['sender_user_id']);
            if (!$partnerDevice) {
                continue;
            }
            $this->pairings->createReciprocalPairing($userId, (int) $partnerDevice['id']);
        }
    }

    private function formatTarget(array $row): array
    {
        $display = trim((string) ($row['display_name'] ?? ''));
        if ($display === '') {
            $display = $row['device_name'];
        }
        $lastSeen = $row['last_seen_at'] ?? null;
        $online = false;
        $ago = null;
        if ($lastSeen) {
            $ago = time() - strtotime($lastSeen);
            $online = $ago < 120;
        }
        return [
            'pairing_id' => (int) $row['id'],
            'device_id' => (int) $row['target_device_id'],
            'device_name' => $row['device_name'],
            'display_name' => $display,
            'uuid' => $row['target_uuid'],
            'serial_number' => $row['serial_number'] ?? '',
            'relationship_type' => $row['relationship_type'] ?? 'contact',
            'last_seen_at' => $lastSeen,
            'last_seen_seconds_ago' => $ago,
            'online' => $online,
        ];
    }

    private function randomCode(): string
    {
        $len = strlen(self::CODE_ALPHABET);
        $out = 'LOVE-';
        for ($i = 0; $i < 4; $i++) {
            $out .= self::CODE_ALPHABET[random_int(0, $len - 1)];
        }
        return $out;
    }

    private function normalizeCode(string $raw): string
    {
        $raw = strtoupper(trim($raw));
        $raw = str_replace(' ', '', $raw);
        if (str_starts_with($raw, 'LOVE')) {
            return $raw;
        }
        if (strlen($raw) === 4) {
            return 'LOVE-' . $raw;
        }
        return $raw;
    }
}
