<?php

declare(strict_types=1);

namespace Bac\Services;

use Bac\Repositories\MessageRepository;
use Bac\Repositories\PairingRepository;

final class MessageService
{
    private int $longPollMax;

    public function __construct(
        private MessageRepository $messages,
        private PairingRepository $pairings,
        private BacmValidator $bacm
    ) {
        $settings = require dirname(__DIR__, 2) . '/config/settings.php';
        $this->longPollMax = $settings['long_poll_max_seconds'];
    }

    public function send(int $userId, int $targetDeviceId, string $bacmData): array
    {
        $active = $this->pairings->findActiveBySender($userId);
        if (!$active || (int) $active['target_device_id'] !== $targetDeviceId) {
            throw new \InvalidArgumentException('no active pairing to this device');
        }
        $err = $this->bacm->validate($bacmData);
        if ($err !== null) {
            throw new \InvalidArgumentException($err);
        }
        $preview = $this->bacm->extractPreviewBase64($bacmData);
        $messageId = $this->messages->create($userId, $targetDeviceId, $bacmData, $preview);
        return ['ok' => true, 'message_id' => $messageId];
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
