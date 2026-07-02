<?php

declare(strict_types=1);

namespace Bac\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;

final class CorsMiddleware implements MiddlewareInterface
{
    public function process(Request $request, Handler $handler): Response
    {
        if ($request->getMethod() === 'OPTIONS') {
            $response = new \Slim\Psr7\Response();
            return $this->withCors($response);
        }
        $response = $handler->handle($request);
        return $this->withCors($response);
    }

    private function withCors(Response $response): Response
    {
        return $response
            ->withHeader('Access-Control-Allow-Origin', '*')
            ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Uuid, X-Device-Secret, X-Message-Id')
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    }
}
