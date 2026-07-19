<?php

declare(strict_types=1);

namespace Bac\Controllers;

use Bac\Manual\ManualRenderer;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class ManualController
{
    public function page(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $response->getBody()->write(ManualRenderer::page());
        return $response->withHeader('Content-Type', 'text/html; charset=utf-8');
    }
}
