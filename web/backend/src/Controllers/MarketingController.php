<?php

declare(strict_types=1);

namespace Bac\Controllers;

use Bac\Marketing\MarketingRenderer;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class MarketingController
{
    public function home(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $response->getBody()->write(MarketingRenderer::home());
        return $response->withHeader('Content-Type', 'text/html; charset=utf-8');
    }
}
