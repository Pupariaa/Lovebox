<?php

declare(strict_types=1);

namespace Bac\Repositories;

use PDO;

final class MessageRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function create(int $senderUserId, int $targetDeviceId, string $bacmData, ?string $previewBase64): int
    {
        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare(
                "INSERT INTO messages (sender_user_id, target_device_id, bacm_data, status)
                 VALUES (:sender, :target, :data, 'queued')"
            );
            $stmt->bindValue('sender', $senderUserId, PDO::PARAM_INT);
            $stmt->bindValue('target', $targetDeviceId, PDO::PARAM_INT);
            $stmt->bindValue('data', $bacmData, PDO::PARAM_LOB);
            $stmt->execute();
            $messageId = (int) $this->pdo->lastInsertId();

            $deviceStmt = $this->pdo->prepare('SELECT device_name FROM devices WHERE id = :id');
            $deviceStmt->execute(['id' => $targetDeviceId]);
            $deviceName = (string) ($deviceStmt->fetchColumn() ?: '');

            $logStmt = $this->pdo->prepare(
                'INSERT INTO sent_message_log (message_id, sender_user_id, target_device_id, target_device_name, preview_base64)
                 VALUES (:mid, :sender, :target, :name, :preview)'
            );
            $logStmt->execute([
                'mid' => $messageId,
                'sender' => $senderUserId,
                'target' => $targetDeviceId,
                'name' => $deviceName,
                'preview' => $previewBase64,
            ]);

            $this->pdo->commit();
            return $messageId;
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    public function claimNextQueued(int $deviceId): ?array
    {
        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare(
                "SELECT id, bacm_data FROM messages
                 WHERE target_device_id = :did AND status = 'queued'
                 ORDER BY created_at ASC
                 LIMIT 1
                 FOR UPDATE SKIP LOCKED"
            );
            $stmt->execute(['did' => $deviceId]);
            $row = $stmt->fetch();
            if (!$row) {
                $this->pdo->commit();
                return null;
            }
            if (is_resource($row['bacm_data'])) {
                $row['bacm_data'] = stream_get_contents($row['bacm_data']) ?: '';
            }
            $upd = $this->pdo->prepare(
                "UPDATE messages SET status = 'delivering', delivered_at = NOW() WHERE id = :id"
            );
            $upd->execute(['id' => $row['id']]);
            $this->pdo->commit();
            return $row;
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    public function ack(int $messageId, int $deviceId): bool
    {
        $stmt = $this->pdo->prepare(
            "UPDATE messages SET status = 'acked', acked_at = NOW()
             WHERE id = :id AND target_device_id = :did AND status IN ('delivering', 'delivered')"
        );
        $stmt->execute(['id' => $messageId, 'did' => $deviceId]);
        return $stmt->rowCount() > 0;
    }

    public function listSent(int $userId, int $limit, int $offset): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, message_id, target_device_id, target_device_name, preview_base64, created_at
             FROM sent_message_log
             WHERE sender_user_id = :uid
             ORDER BY created_at DESC
             LIMIT :lim OFFSET :off'
        );
        $stmt->bindValue('uid', $userId, PDO::PARAM_INT);
        $stmt->bindValue('lim', $limit, PDO::PARAM_INT);
        $stmt->bindValue('off', $offset, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function findSentLog(int $userId, int $logId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM sent_message_log WHERE id = :id AND sender_user_id = :uid LIMIT 1'
        );
        $stmt->execute(['id' => $logId, 'uid' => $userId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function getMessageBacm(int $messageId, int $userId): ?string
    {
        $stmt = $this->pdo->prepare(
            'SELECT m.bacm_data FROM messages m
             JOIN sent_message_log l ON l.message_id = m.id
             WHERE l.id = :lid AND l.sender_user_id = :uid LIMIT 1'
        );
        $stmt->execute(['lid' => $messageId, 'uid' => $userId]);
        $data = $stmt->fetchColumn();
        return $data !== false ? (string) $data : null;
    }
}
