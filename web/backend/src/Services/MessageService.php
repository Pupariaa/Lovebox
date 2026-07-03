<?php

declare(strict_types=1);

namespace Bac\Services;

use Bac\Repositories\DeviceRepository;
use Bac\Repositories\MessageRepository;
use Bac\Repositories\PairingRepository;

final class MessageService
{
    private int $longPollMax;

    public function __construct(
        private MessageRepository $messages,
        private PairingRepository $pairings,
        private DeviceRepository $devices,
        private BacmValidator $bacm
    ) {
        $settings = require dirname(__DIR__, 2) . '/config/settings.php';
        $this->longPollMax = $settings['long_poll_max_seconds'];
    }

    public function send(
        int $userId,
        int $targetDeviceId,
        string $bacmData,
        ?string $scheduledAt = null,
        ?int $displayDurationSec = null
    ): array {
        $deliveryDeviceId = $this->devices->resolveDeliveryDeviceId($targetDeviceId);
        $pairing = $this->pairings->findActiveBySenderAndTarget($userId, $targetDeviceId)
            ?? $this->pairings->findActiveBySenderAndTarget($userId, $deliveryDeviceId)
            ?? $this->pairings->findActiveBySenderAndPartnerOwner($userId, $targetDeviceId);
        if (!$pairing) {
            throw new \InvalidArgumentException('no active pairing to this device');
        }
        $err = $this->bacm->validate($bacmData);
        if ($err !== null) {
            throw new \InvalidArgumentException($err);
        }
        $preview = $this->bacm->extractPreviewBase64($bacmData);
        $messageId = $this->messages->create(
            $userId,
            $deliveryDeviceId,
            $bacmData,
            $preview,
            $scheduledAt,
            $displayDurationSec
        );
        return ['ok' => true, 'message_id' => $messageId];
    }

    public function consolidateDeliveryForDevice(int $deviceId, ?int $ownerUserId): void
    {
        if (!$ownerUserId) {
            return;
        }
        $this->messages->retargetQueuedForOwner($ownerUserId, $deviceId);
    }

    public function longPoll(int $deviceId, int $timeoutSeconds): ?array
    {
        $timeoutSeconds = max(1, min($timeoutSeconds, $this->longPollMax));
        $deadline = microtime(true) + $timeoutSeconds;
        while (microtime(true) < $deadline) {
            $msg = $this->messages->claimNextQueued($deviceId);
            if ($msg) {
                return $msg;
            }
            usleep(250000);
        }
        return null;
    }

    public function ack(int $deviceId, int $messageId): bool
    {
        return $this->messages->ack($messageId, $deviceId);
    }

    public function opened(int $deviceId, int $messageId): bool
    {
        return $this->messages->opened($messageId, $deviceId);
    }

    public function seen(int $deviceId, int $messageId): bool
    {
        return $this->messages->seen($messageId, $deviceId);
    }

    public function nack(int $deviceId, int $messageId): bool
    {
        return $this->messages->nack($messageId, $deviceId);
    }

    public function listSent(int $userId, int $page, int $perPage): array
    {
        $offset = max(0, ($page - 1) * $perPage);
        $rows = $this->messages->listSent($userId, $perPage, $offset);
        return array_map(static fn ($r) => [
            'id' => (int) $r['id'],
            'message_id' => (int) $r['message_id'],
            'target_device_name' => $r['target_device_name'],
            'preview_base64' => $r['preview_base64'],
            'created_at' => $r['created_at'],
            'status' => (string) ($r['status'] ?? 'queued'),
            'received_at' => $r['acked_at'] ?? null,
            'opened_at' => $r['opened_at'] ?? null,
            'seen_at' => $r['seen_at'] ?? null,
            'ephemeral' => !empty($r['display_duration_sec']),
        ], $rows);
    }

    public function getPreview(int $userId, int $logId): ?string
    {
        $log = $this->messages->findSentLog($userId, $logId);
        if (!$log) {
            return null;
        }
        if (!empty($log['preview_base64'])) {
            return $log['preview_base64'];
        }
        return $this->messages->getMessageBacm($logId, $userId);
    }
}
