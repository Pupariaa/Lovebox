<?php

declare(strict_types=1);

namespace Bac\Controllers;

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
        $msg = $this->messages->longPoll((int) $device['id'], $timeout);
        if (!$msg) {
            return $response->withStatus(204);
        }
        $response->getBody()->write((string) $msg['bacm_data']);
        return $response
            ->withHeader('Content-Type', 'application/octet-stream')
            ->withHeader('X-Message-Id', (string) $msg['id'])
            ->withStatus(200);
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

    public function claim(Request $request, Response $response): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $body = (array) $request->getParsedBody();
        try {
            $data = $this->devices->claim(
                $userId,
                (string) ($body['device_name'] ?? ''),
                isset($body['serial_number']) ? (string) $body['serial_number'] : null
            );
            return JsonResponse::ok($response, ['ok' => true, 'device' => $data]);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 400);
        }
    }

    public function me(Request $request, Response $response): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $device = $this->deviceRepo->findByOwner($userId);
        if (!$device) {
            return JsonResponse::ok($response, ['ok' => true, 'device' => null]);
        }
        return JsonResponse::ok($response, [
            'ok' => true,
            'device' => $this->devices->formatDevice($device),
        ]);
    }

    public function updateMe(Request $request, Response $response): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $body = (array) $request->getParsedBody();
        try {
            $data = $this->devices->updateOwned($userId, $body);
            return JsonResponse::ok($response, ['ok' => true, 'device' => $data]);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 400);
        }
    }
}
