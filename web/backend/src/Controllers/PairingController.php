<?php

declare(strict_types=1);

namespace Bac\Controllers;

use Bac\Services\PairingService;
use Bac\Support\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class PairingController
{
    public function __construct(private PairingService $pairings)
    {
    }

    public function generateCode(Request $request, Response $response): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $body = (array) $request->getParsedBody();
        $deviceId = isset($body['device_id']) ? (int) $body['device_id'] : null;
        try {
            $data = $this->pairings->generateCode($userId, $deviceId ?: null);
            return JsonResponse::ok($response, ['ok' => true] + $data);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 400);
        }
    }

    public function acceptCode(Request $request, Response $response): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $body = (array) $request->getParsedBody();
        try {
            $data = $this->pairings->acceptCode(
                $userId,
                (string) ($body['code'] ?? ''),
                isset($body['device_id']) ? (int) $body['device_id'] : null
            );
            return JsonResponse::ok($response, ['ok' => true] + $data);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 400);
        }
    }

    public function unlink(Request $request, Response $response, array $args): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        try {
            $this->pairings->unlink($userId, (int) ($args['id'] ?? 0));
            return JsonResponse::ok($response, ['ok' => true]);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 400);
        }
    }

    public function me(Request $request, Response $response): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        return JsonResponse::ok($response, ['ok' => true] + $this->pairings->getState($userId));
    }
}
