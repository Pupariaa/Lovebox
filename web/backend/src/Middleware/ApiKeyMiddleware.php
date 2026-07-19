<?php

declare(strict_types=1);

namespace Bac\Middleware;

use Bac\Support\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;

abstract class ApiKeyMiddleware implements MiddlewareInterface
{
    public function __construct(
        private string $expectedKey,
        private string $headerName,
        private string $notConfiguredMessage
    ) {
    }

    public function process(Request $request, Handler $handler): Response
    {
        $expected = trim($this->expectedKey);
        if ($expected === '') {
            return JsonResponse::error(new \Slim\Psr7\Response(), $this->notConfiguredMessage, 503);
        }
        $provided = $request->getHeaderLine($this->headerName);
        if ($provided === '') {
            $serverKey = 'HTTP_' . strtoupper(str_replace('-', '_', $this->headerName));
            if (isset($_SERVER[$serverKey])) {
                $provided = (string) $_SERVER[$serverKey];
            }
        }
        if ($provided === '' || !hash_equals($expected, $provided)) {
            return JsonResponse::error(new \Slim\Psr7\Response(), 'unauthorized', 401);
        }
        return $handler->handle($request);
    }
}
