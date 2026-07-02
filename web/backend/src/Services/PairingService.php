<?php

declare(strict_types=1);

namespace Bac\Services;

use Bac\Repositories\DeviceRepository;
use Bac\Repositories\PairingRepository;
use Bac\Support\TokenUtil;

final class PairingService
{
    private string $appUrl;
    private int $inviteTtl;

    public function __construct(
        private PairingRepository $pairings,
        private DeviceRepository $devices
    ) {
        $settings = require dirname(__DIR__, 2) . '/config/settings.php';
        $this->appUrl = rtrim($settings['app']['url'], '/');
        $this->inviteTtl = $settings['invite_token_ttl'];
    }

    public function createInvite(int $userId): array
    {
        $owned = $this->devices->findByOwner($userId);
        if (!$owned) {
            throw new \InvalidArgumentException('claim your device first');
        }
        $token = TokenUtil::randomUrlSafe(24);
        $expiresAt = date('Y-m-d H:i:s', time() + $this->inviteTtl);
        $this->pairings->createInvite($token, (int) $owned['id'], $userId, $expiresAt);
        return [
            'token' => $token,
            'url' => $this->appUrl . '/invite/' . $token,
            'deep_link' => 'boiteacoeur://invite/' . $token,
            'expires_at' => $expiresAt,
        ];
    }

    public function acceptInvite(int $userId, string $token): array
    {
        if ($this->pairings->findActiveBySender($userId)) {
            throw new \InvalidArgumentException('already linked to a device');
        }
        $invite = $this->pairings->findInvite($token);
        if (!$invite) {
            throw new \InvalidArgumentException('invalid or expired invite');
        }
        $targetDeviceId = (int) $invite['device_id'];
        $owned = $this->devices->findByOwner($userId);
        if ($owned && (int) $owned['id'] === $targetDeviceId) {
            throw new \InvalidArgumentException('cannot link to your own device');
        }
        $this->pairings->consumeInvite($token);
        $pairingId = $this->pairings->createPairing($userId, $targetDeviceId, 'active');
        $this->ensureReciprocalPairing(
            (int) $invite['created_by_user_id'],
            $userId
        );
        return $this->formatPairing($pairingId, $userId);
    }

    public function requestPairing(int $userId, ?string $deviceName, ?string $uuid): array
    {
        if ($this->pairings->findActiveBySender($userId)) {
            throw new \InvalidArgumentException('already linked to a device');
        }
        $target = null;
        if ($uuid) {
            $target = $this->devices->findByUuid(trim($uuid));
        } elseif ($deviceName) {
            $target = $this->devices->findByDeviceName(trim($deviceName));
        }
        if (!$target) {
            throw new \InvalidArgumentException('target device not found');
        }
        $owned = $this->devices->findByOwner($userId);
        if ($owned && (int) $owned['id'] === (int) $target['id']) {
            throw new \InvalidArgumentException('cannot link to your own device');
        }
        $requestId = $this->pairings->createRequest($userId, (int) $target['id']);
        $pairingId = $this->pairings->createPairing($userId, (int) $target['id'], 'pending');
        return [
            'request_id' => $requestId,
            'pairing_id' => $pairingId,
            'status' => 'pending',
            'target_device_name' => $target['device_name'],
        ];
    }

    public function acceptPairing(int $userId, int $pairingId): array
    {
        $owned = $this->devices->findByOwner($userId);
        if (!$owned) {
            throw new \InvalidArgumentException('no owned device');
        }
        $pairing = $this->pairings->findPendingById($pairingId);
        if (!$pairing || (int) $pairing['target_device_id'] !== (int) $owned['id']) {
            throw new \InvalidArgumentException('pairing not found');
        }
        if (!$this->pairings->updateStatus($pairingId, 'active')) {
            throw new \InvalidArgumentException('accept failed');
        }
        $this->ensureReciprocalPairing(
            $userId,
            (int) $pairing['sender_user_id']
        );
        return $this->formatPairing($pairingId, (int) $pairing['sender_user_id']);
    }

    public function rejectPairing(int $userId, int $pairingId): void
    {
        $owned = $this->devices->findByOwner($userId);
        if (!$owned) {
            throw new \InvalidArgumentException('no owned device');
        }
        $pairing = $this->pairings->findPendingById($pairingId);
        if (!$pairing || (int) $pairing['target_device_id'] !== (int) $owned['id']) {
            throw new \InvalidArgumentException('pairing not found');
        }
        $this->pairings->updateStatus($pairingId, 'rejected');
    }

    public function getState(int $userId): array
    {
        $owned = $this->devices->findByOwner($userId);
        if ($owned) {
            $this->repairReciprocalPairing($userId, (int) $owned['id']);
        }
        $active = $this->pairings->findActiveBySender($userId);
        $pendingIncoming = [];
        if ($owned) {
            $pendingIncoming = $this->pairings->listPendingRequestsForDevice((int) $owned['id']);
        }
        return [
            'owned_device' => $owned ? [
                'id' => (int) $owned['id'],
                'device_name' => $owned['device_name'],
                'uuid' => $owned['uuid'],
            ] : null,
            'linked_target' => $active ? [
                'pairing_id' => (int) $active['id'],
                'device_id' => (int) $active['target_device_id'],
                'device_name' => $active['device_name'],
                'uuid' => $active['target_uuid'],
            ] : null,
            'pending_requests' => array_map(static fn ($r) => [
                'request_id' => (int) $r['id'],
                'pairing_id' => (int) $r['pairing_id'],
                'from_email' => $r['from_email'],
                'created_at' => $r['created_at'],
            ], $pendingIncoming),
        ];
    }

    private function ensureReciprocalPairing(int $ownerUserId, int $partnerUserId): void
    {
        if ($ownerUserId === $partnerUserId) {
            return;
        }
        $partnerDevice = $this->devices->findByOwner($partnerUserId);
        if (!$partnerDevice) {
            return;
        }
        $this->pairings->createReciprocalPairing($ownerUserId, (int) $partnerDevice['id']);
    }

    private function repairReciprocalPairing(int $userId, int $ownedDeviceId): void
    {
        if ($this->pairings->findActiveBySender($userId)) {
            return;
        }
        $incoming = $this->pairings->findActiveByTargetDevice($ownedDeviceId);
        if (!$incoming) {
            return;
        }
        $partnerDevice = $this->devices->findByOwner((int) $incoming['sender_user_id']);
        if (!$partnerDevice) {
            return;
        }
        $this->pairings->createReciprocalPairing($userId, (int) $partnerDevice['id']);
    }

    private function formatPairing(int $pairingId, int $senderUserId): array
    {
        $active = $this->pairings->findActiveBySender($senderUserId);
        if (!$active || (int) $active['id'] !== $pairingId) {
            $device = $this->devices->findById((int) ($active['target_device_id'] ?? 0));
            return ['pairing_id' => $pairingId, 'status' => 'active'];
        }
        return [
            'pairing_id' => $pairingId,
            'status' => 'active',
            'target_device_name' => $active['device_name'],
            'target_uuid' => $active['target_uuid'],
        ];
    }
}
