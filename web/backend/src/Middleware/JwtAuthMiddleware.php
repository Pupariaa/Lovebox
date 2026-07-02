<?php

declare(strict_types=1);

namespace Bac\Middleware;

use Bac\Services\JwtService;
use Bac\Support\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;

final class JwtAuthMiddleware implements MiddlewareInterface
{
    public function __construct(private JwtService $jwt)
    {
    }

    public function process(Request $request, Handler $handler): Response
    {
        $header = $request->getHeaderLine('Authorization');
        if ($header === '' && isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $header = (string) $_SERVER['HTTP_AUTHORIZATION'];
        }
        if ($header === '' && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $header = (string) $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }
        if (!preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
            return JsonResponse::error(new \Slim\Psr7\Response(), 'missing token', 401);
        }
        $payload = $this->jwt->decodeAccessToken($m[1]);
        if (!$payload) {
            return JsonResponse::error(new \Slim\Psr7\Response(), 'invalid token', 401);
        }
        return $handler->handle($request->withAttribute('user_id', (int) $payload['sub']));
    }
}
