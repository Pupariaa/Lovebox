<?php

declare(strict_types=1);

namespace Bac\Support;

use Psr\Http\Message\ResponseInterface as Response;

final class JsonResponse
{
    public static function ok(Response $response, array $data, int $status = 200): Response
    {
        $response->getBody()->write((string) json_encode($data, JSON_THROW_ON_ERROR));
        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    }

    public static function error(Response $response, string $message, int $status = 400, ?array $extra = null): Response
    {
        $payload = ['ok' => false, 'error' => $message];
        if ($extra !== null) {
            $payload = array_merge($payload, $extra);
        }
        return self::ok($response, $payload, $status);
    }
}
