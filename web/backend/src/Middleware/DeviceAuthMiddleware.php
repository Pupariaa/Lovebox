<?php

declare(strict_types=1);

namespace Bac\Middleware;

use Bac\Services\DeviceService;
use Bac\Support\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;

final class DeviceAuthMiddleware implements MiddlewareInterface
{
    public function __construct(private DeviceService $devices)
    {
    }

    public function process(Request $request, Handler $handler): Response
    {
        $uuid = $request->getHeaderLine('X-Device-Uuid');
        $secret = $request->getHeaderLine('X-Device-Secret');
        if ($uuid === '' || $secret === '') {
            return JsonResponse::error(new \Slim\Psr7\Response(), 'missing device credentials', 401);
        }
        try {
            $device = $this->devices->authenticate($uuid, $secret);
        } catch (\InvalidArgumentException) {
            return JsonResponse::error(new \Slim\Psr7\Response(), 'unauthorized device', 401);
        }
        return $handler->handle($request->withAttribute('device', $device));
    }
}
