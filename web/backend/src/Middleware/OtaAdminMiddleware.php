<?php

declare(strict_types=1);

namespace Bac\Middleware;

use Bac\Support\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;

final class OtaAdminMiddleware implements MiddlewareInterface
{
    public function __construct(private array $settings)
    {
    }

    public function process(Request $request, Handler $handler): Response
    {
        $expected = trim((string) ($this->settings['ota']['admin_key'] ?? ''));
        if ($expected === '') {
            return JsonResponse::error(new \Slim\Psr7\Response(), 'ota admin not configured', 503);
        }
        $provided = $request->getHeaderLine('X-Ota-Admin-Key');
        if ($provided === '' && isset($_SERVER['HTTP_X_OTA_ADMIN_KEY'])) {
            $provided = (string) $_SERVER['HTTP_X_OTA_ADMIN_KEY'];
        }
        if ($provided === '' || !hash_equals($expected, $provided)) {
            return JsonResponse::error(new \Slim\Psr7\Response(), 'unauthorized', 401);
        }
        return $handler->handle($request);
    }
}
