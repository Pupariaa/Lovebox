<?php

declare(strict_types=1);

namespace Bac\Controllers;

use Bac\Services\MessageService;
use Bac\Support\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class MessageController
{
    private const MAX_MESSAGE_BYTES = 3145728;

    public function __construct(private MessageService $messages)
    {
    }

    public function send(Request $request, Response $response): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $params = $request->getQueryParams();
        $targetId = (int) ($params['target_device_id'] ?? 0);

        $declaredLen = (int) $request->getHeaderLine('Content-Length');
        if ($declaredLen > self::MAX_MESSAGE_BYTES) {
            return JsonResponse::error($response, 'message too large', 413);
        }
        $body = $request->getBody()->getContents();
        if (strlen($body) > self::MAX_MESSAGE_BYTES) {
            return JsonResponse::error($response, 'message too large', 413);
        }
        $parsed = (array) $request->getParsedBody();
        $scheduledAt = isset($params['scheduled_at'])
            ? (string) $params['scheduled_at']
            : (isset($parsed['scheduled_at']) ? (string) $parsed['scheduled_at'] : null);
        $ephemeral = ($params['ephemeral'] ?? '0') === '1';
        if ($ephemeral) {
            $displayDuration = 10;
        } else {
            $displayDuration = isset($parsed['display_duration_sec'])
                ? (int) $parsed['display_duration_sec']
                : null;
        }
        try {
            $data = $this->messages->send($userId, $targetId, $body, $scheduledAt, $displayDuration);
            return JsonResponse::ok($response, $data);
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
        return JsonResponse::ok($response, ['ok' => true, 'items' => $items]);
    }

    public function received(Request $request, Response $response): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $params = $request->getQueryParams();
        $page = max(1, (int) ($params['page'] ?? 1));
        $perPage = min(50, max(1, (int) ($params['per_page'] ?? 20)));
        $items = $this->messages->listReceived($userId, $page, $perPage);
        return JsonResponse::ok($response, ['ok' => true, 'items' => $items]);
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
