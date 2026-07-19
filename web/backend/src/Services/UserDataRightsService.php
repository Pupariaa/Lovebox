<?php

declare(strict_types=1);

namespace Bac\Services;

use Bac\Repositories\DeletionRequestRepository;
use Bac\Repositories\DeviceRepository;
use Bac\Repositories\MessageRepository;
use Bac\Repositories\PairingRepository;
use Bac\Repositories\UserRepository;
use Bac\Support\TokenUtil;

final class UserDataRightsService
{
    public function __construct(
        private UserRepository $users,
        private DeviceRepository $devices,
        private MessageRepository $messages,
        private PairingRepository $pairings,
        private DeletionRequestRepository $deletionRequests,
        private EmailService $mail,
    ) {
    }

    public function requestByEmail(string $email, string $action): void
    {
        $email = strtolower(trim($email));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException('invalid email');
        }
        if (!UserDataAction::isValid($action)) {
            throw new \InvalidArgumentException('invalid action');
        }

        $user = $this->users->findByEmail($email);
        if (!$user) {
            return;
        }

        $userId = (int) $user['id'];
        $this->deletionRequests->cancelPendingForUser($userId);

        $token = TokenUtil::randomUrlSafe(32);
        $tokenHash = TokenUtil::hashToken($token);
        $expiresAt = date('Y-m-d H:i:s', time() + 86400);

        $this->deletionRequests->create($userId, $email, $tokenHash, $expiresAt, $action);
        $this->mail->sendDataRightsConfirm($email, $token, $action);
    }

    /** @return array{action: string, export?: array<string, mixed>} */
    public function confirmToken(string $token): array
    {
        $token = trim($token);
        if ($token === '') {
            throw new \InvalidArgumentException('invalid token');
        }

        $request = $this->deletionRequests->findPendingByTokenHash(TokenUtil::hashToken($token));
        if (!$request) {
            throw new \InvalidArgumentException('invalid or expired token');
        }

        $userId = $request['user_id'] !== null ? (int) $request['user_id'] : null;
        $action = (string) ($request['action'] ?? UserDataAction::ACCOUNT_DELETE);
        $result = ['action' => $action];

        if ($userId !== null) {
            if ($action === UserDataAction::ACCOUNT_DELETE) {
                $this->purgeUser($userId);
            } elseif ($action === UserDataAction::DATA_DELETE) {
                $this->purgePersonalData($userId);
            } elseif ($action === UserDataAction::DATA_EXPORT) {
                $result['export'] = $this->buildExport($userId);
            }
        }

        $this->deletionRequests->markCompleted((int) $request['id']);
        return $result;
    }

    /** @return array<string, mixed> */
    public function buildExport(int $userId): array
    {
        $user = $this->users->findById($userId);
        if (!$user) {
            throw new \InvalidArgumentException('user not found');
        }

        $devices = array_map(static function (array $d): array {
            return [
                'id' => (int) $d['id'],
                'uuid' => $d['uuid'],
                'serial_number' => $d['serial_number'],
                'device_name' => $d['device_name'],
                'display_name' => $d['display_name'],
                'firmware_version' => $d['firmware_version'],
                'last_seen_at' => $d['last_seen_at'],
            ];
        }, $this->devices->listByOwner($userId));

        $pairings = array_map(static function (array $p): array {
            return [
                'id' => (int) $p['id'],
                'target_device_id' => (int) $p['target_device_id'],
                'target_uuid' => $p['target_uuid'] ?? null,
                'alias' => $p['alias'] ?? null,
                'created_at' => $p['created_at'],
            ];
        }, $this->pairings->listActiveBySender($userId));

        $sent = array_map(static function (array $row): array {
            return [
                'log_id' => (int) $row['id'],
                'message_id' => (int) $row['message_id'],
                'target_device_id' => (int) $row['target_device_id'],
                'target_device_name' => $row['target_device_name'],
                'status' => $row['status'],
                'created_at' => $row['created_at'],
                'preview_base64' => $row['preview_base64'],
                'bacm_base64' => $row['bacm_base64'],
            ];
        }, $this->messages->listSentForExport($userId));

        $received = array_map(static function (array $row): array {
            return [
                'message_id' => (int) $row['message_id'],
                'target_device_id' => (int) $row['target_device_id'],
                'device_name' => $row['device_name'],
                'sender_first_name' => $row['sender_first_name'],
                'opened_at' => $row['opened_at'],
                'seen_at' => $row['seen_at'],
                'created_at' => $row['created_at'],
                'preview_base64' => $row['preview_base64'],
                'bacm_base64' => $row['bacm_base64'],
            ];
        }, $this->messages->listReceivedForExport($userId));

        return [
            'exported_at' => gmdate('c'),
            'service' => 'boite-a-coeur',
            'account' => [
                'id' => (int) $user['id'],
                'email' => $user['email'],
                'first_name' => $user['first_name'] ?? null,
                'last_name' => $user['last_name'] ?? null,
                'locale' => $user['locale'] ?? 'fr',
                'email_verified_at' => $user['email_verified_at'],
                'created_at' => $user['created_at'],
            ],
            'oauth_providers' => $this->users->listOAuthProviders($userId),
            'owned_devices' => $devices,
            'pairings' => $pairings,
            'sent_messages' => $sent,
            'received_messages' => $received,
        ];
    }

    private function purgePersonalData(int $userId): void
    {
        $this->messages->purgeSentByUser($userId);
        $this->messages->clearReceivedContentForOwner($userId);
        $this->pairings->clearAliasesForSender($userId);
        $this->users->revokeAllRefreshTokens($userId);
        $this->users->update($userId, [
            'first_name' => null,
            'last_name' => null,
        ]);
    }

    private function purgeUser(int $userId): void
    {
        foreach ($this->devices->listByOwner($userId) as $device) {
            $this->devices->revokeSecret((int) $device['id']);
            $this->devices->unclaim((int) $device['id'], $userId);
        }
        $this->users->deleteById($userId);
    }
}
