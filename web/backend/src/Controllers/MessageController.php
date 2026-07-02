<?php

declare(strict_types=1);

namespace Bac\Controllers;

use Bac\Services\MessageService;
use Bac\Support\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class MessageController
{
    public function __construct(private MessageService $messages)
    {
    }

    public function send(Request $request, Response $response): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $params = $request->getQueryParams();
        $targetDeviceId = (int) ($params['target_device_id'] ?? 0);
        $bacm = (string) $request->getBody();
        if ($targetDeviceId <= 0) {
            return JsonResponse::error($response, 'target_device_id required', 400);
        }
        try {
            $data = $this->messages->send($userId, $targetDeviceId, $bacm);
            return JsonResponse::ok($response, $data, 201);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 400);
        }
    }

    public function sent(Request $request, Response $response): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $params = $request->getQueryParams();
        $page = max(1, (int) ($params['page'] ?? 1));
        $perPage = min(50, max(1, (int) ($params['per_page'] ?? 20)));
        $items = $this->messages->listSent($userId, $page, $perPage);
        return JsonResponse::ok($response, ['ok' => true, 'items' => $items, 'page' => $page]);
    }

    public function preview(Request $request, Response $response, array $args): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $logId = (int) ($args['id'] ?? 0);
        $preview = $this->messages->getPreview($userId, $logId);
        if ($preview === null) {
            return JsonResponse::error($response, 'not found', 404);
        }
        return JsonResponse::ok($response, ['ok' => true, 'preview_base64' => $preview]);
    }
}
