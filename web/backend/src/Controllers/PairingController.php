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

    public function invite(Request $request, Response $response): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        try {
            $data = $this->pairings->createInvite($userId);
            return JsonResponse::ok($response, ['ok' => true] + $data);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 400);
        }
    }

    public function acceptInvite(Request $request, Response $response): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $body = (array) $request->getParsedBody();
        try {
            $data = $this->pairings->acceptInvite($userId, (string) ($body['token'] ?? ''));
            return JsonResponse::ok($response, ['ok' => true] + $data);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 400);
        }
    }

    public function request(Request $request, Response $response): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $body = (array) $request->getParsedBody();
        try {
            $data = $this->pairings->requestPairing(
                $userId,
                isset($body['device_name']) ? (string) $body['device_name'] : null,
                isset($body['uuid']) ? (string) $body['uuid'] : null
            );
            return JsonResponse::ok($response, ['ok' => true] + $data);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 400);
        }
    }

    public function accept(Request $request, Response $response, array $args): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        try {
            $data = $this->pairings->acceptPairing($userId, (int) ($args['id'] ?? 0));
            return JsonResponse::ok($response, ['ok' => true] + $data);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 400);
        }
    }

    public function reject(Request $request, Response $response, array $args): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        try {
            $this->pairings->rejectPairing($userId, (int) ($args['id'] ?? 0));
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
