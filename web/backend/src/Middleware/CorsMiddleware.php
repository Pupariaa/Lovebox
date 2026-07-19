<?php

declare(strict_types=1);

namespace Bac\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;

final class CorsMiddleware implements MiddlewareInterface
{
    /** @var list<string> */
    private array $allowedOrigins;

    /** @param list<string> $allowedOrigins */
    public function __construct(array $allowedOrigins = [])
    {
        $this->allowedOrigins = array_values(array_filter(array_map(
            static fn ($origin): string => rtrim(trim((string) $origin), '/'),
            $allowedOrigins
        )));
    }

    public function process(Request $request, Handler $handler): Response
    {
        $origin = rtrim(trim($request->getHeaderLine('Origin')), '/');
        if ($request->getMethod() === 'OPTIONS') {
            return $this->withCors(new \Slim\Psr7\Response(), $origin);
        }
        return $this->withCors($handler->handle($request), $origin);
    }

    private function withCors(Response $response, string $origin): Response
    {
        $response = $response
            ->withHeader('Vary', 'Origin')
            ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Uuid, X-Device-Secret, X-Message-Id')
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
        if ($origin !== '' && in_array($origin, $this->allowedOrigins, true)) {
            $response = $response
                ->withHeader('Access-Control-Allow-Origin', $origin)
                ->withHeader('Access-Control-Allow-Credentials', 'true');
        }
        return $response;
    }
}
