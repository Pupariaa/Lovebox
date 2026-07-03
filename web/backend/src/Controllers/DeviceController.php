<?php

declare(strict_types=1);

namespace Bac\Controllers;

use Bac\Repositories\DeviceCommandRepository;
use Bac\Repositories\DeviceRepository;
use Bac\Services\DeviceService;
use Bac\Services\MessageService;
use Bac\Support\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class DeviceController
{
    public function __construct(
        private DeviceService $devices,
        private DeviceRepository $deviceRepo,
        private DeviceCommandRepository $commands,
        private MessageService $messages
    ) {
    }

    public function register(Request $request, Response $response): Response
    {
        $uuid = $request->getHeaderLine('X-Device-Uuid');
        $secret = $request->getHeaderLine('X-Device-Secret');
        $body = (array) $request->getParsedBody();
        $ip = $request->getServerParams()['REMOTE_ADDR'] ?? null;
        try {
            $data = $this->devices->register($uuid, $secret !== '' ? $secret : null, $body, is_string($ip) ? $ip : null);
            return JsonResponse::ok($response, $data);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 400);
        }
    }

    public function heartbeat(Request $request, Response $response): Response
    {
        $device = (array) $request->getAttribute('device');
        $body = (array) $request->getParsedBody();
        $fw = isset($body['firmware_version']) ? (string) $body['firmware_version'] : null;
        $this->deviceRepo->touchHeartbeat((int) $device['id'], $fw);
        return JsonResponse::ok($response, ['ok' => true]);
    }

    public function poll(Request $request, Response $response): Response
    {
        $device = (array) $request->getAttribute('device');
        $params = $request->getQueryParams();
        $timeout = (int) ($params['timeout'] ?? 25);
        $this->deviceRepo->touchHeartbeat((int) $device['id']);
        $ownerUserId = isset($device['owner_user_id']) ? (int) $device['owner_user_id'] : null;
        if ($ownerUserId) {
            $this->messages->consolidateDeliveryForDevice((int) $device['id'], $ownerUserId);
        }
        $msg = $this->messages->longPoll((int) $device['id'], $timeout);
        if (!$msg) {
            return $response->withStatus(204);
        }
        $body = (string) $msg['bacm_data'];
        $response->getBody()->write($body);
        $bodyLen = strlen($body);
        return $response
            ->withHeader('Content-Type', 'application/octet-stream')
            ->withHeader('Content-Length', (string) $bodyLen)
            ->withHeader('X-Message-Bytes', (string) $bodyLen)
            ->withHeader('X-Message-Id', (string) $msg['id'])
            ->withHeader('X-Display-Duration-Sec', (string) ($msg['display_duration_sec'] ?? ''))
            ->withoutHeader('Transfer-Encoding')
            ->withStatus(200);
    }

    public function pollCommands(Request $request, Response $response): Response
    {
        $device = (array) $request->getAttribute('device');
        $this->deviceRepo->touchHeartbeat((int) $device['id']);
        $cmd = $this->commands->claimNext((int) $device['id']);
        if (!$cmd) {
            return $response->withStatus(204);
        }
        return JsonResponse::ok($response, [
            'ok' => true,
            'command_id' => (int) $cmd['id'],
            'command_type' => $cmd['command_type'],
            'payload' => $cmd['payload'],
        ]);
    }

    public function ack(Request $request, Response $response, array $args): Response
    {
        $device = (array) $request->getAttribute('device');
        $messageId = (int) ($args['id'] ?? 0);
        if (!$this->messages->ack((int) $device['id'], $messageId)) {
            return JsonResponse::error($response, 'ack failed', 404);
        }
        return JsonResponse::ok($response, ['ok' => true]);
    }

    public function opened(Request $request, Response $response, array $args): Response
    {
        $device = (array) $request->getAttribute('device');
        $messageId = (int) ($args['id'] ?? 0);
        if (!$this->messages->opened((int) $device['id'], $messageId)) {
            return JsonResponse::error($response, 'opened failed', 404);
        }
        return JsonResponse::ok($response, ['ok' => true]);
    }

    public function seen(Request $request, Response $response, array $args): Response
    {
        $device = (array) $request->getAttribute('device');
        $messageId = (int) ($args['id'] ?? 0);
        if (!$this->messages->seen((int) $device['id'], $messageId)) {
            return JsonResponse::error($response, 'seen failed', 404);
        }
        return JsonResponse::ok($response, ['ok' => true]);
    }

    public function nack(Request $request, Response $response, array $args): Response
    {
        $device = (array) $request->getAttribute('device');
        $messageId = (int) ($args['id'] ?? 0);
        if (!$this->messages->nack((int) $device['id'], $messageId)) {
            return JsonResponse::error($response, 'nack failed', 404);
        }
        return JsonResponse::ok($response, ['ok' => true]);
    }

    public function ackCommand(Request $request, Response $response, array $args): Response
    {
        $device = (array) $request->getAttribute('device');
        $commandId = (int) ($args['id'] ?? 0);
        if (!$this->commands->ack($commandId, (int) $device['id'])) {
            return JsonResponse::error($response, 'command ack failed', 404);
        }
        return JsonResponse::ok($response, ['ok' => true]);
    }

    public function failCommand(Request $request, Response $response, array $args): Response
    {
        $device = (array) $request->getAttribute('device');
        $commandId = (int) ($args['id'] ?? 0);
        if (!$this->commands->fail($commandId, (int) $device['id'])) {
            return JsonResponse::error($response, 'command fail failed', 404);
        }
        return JsonResponse::ok($response, ['ok' => true]);
    }

    public function claim(Request $request, Response $response): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $body = (array) $request->getParsedBody();
        try {
            $data = $this->devices->claim(
                $userId,
                (string) ($body['uuid'] ?? ''),
                (string) ($body['serial_number'] ?? '')
            );
            return JsonResponse::ok($response, ['ok' => true, 'device' => $data]);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 400);
        }
    }

    public function me(Request $request, Response $response): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $devices = $this->devices->listOwned($userId);
        return JsonResponse::ok($response, [
            'ok' => true,
            'devices' => $devices,
            'device' => $devices[0] ?? null,
        ]);
    }

    public function updateMe(Request $request, Response $response, array $args): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $deviceId = (int) ($args['id'] ?? 0);
        $body = (array) $request->getParsedBody();
        try {
            $data = $this->devices->updateOwned($userId, $deviceId, $body);
            return JsonResponse::ok($response, ['ok' => true, 'device' => $data]);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 400);
        }
    }

    public function unclaim(Request $request, Response $response, array $args): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $deviceId = (int) ($args['id'] ?? 0);
        try {
            $this->devices->unclaimOwned($userId, $deviceId);
            return JsonResponse::ok($response, ['ok' => true]);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 400);
        }
    }
}
