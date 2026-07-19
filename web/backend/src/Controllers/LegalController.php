<?php

declare(strict_types=1);

namespace Bac\Controllers;

use Bac\Legal\LegalPages;
use Bac\Legal\LegalRenderer;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class LegalController
{
    public function page(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $slug = (string) ($args['slug'] ?? '');
        if (LegalPages::body($slug) === null) {
            $response->getBody()->write('<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>404</title></head><body><p>Page introuvable.</p></body></html>');
            return $response->withStatus(404)->withHeader('Content-Type', 'text/html; charset=utf-8');
        }

        $html = LegalRenderer::render($slug);
        $response->getBody()->write($html);
        return $response->withHeader('Content-Type', 'text/html; charset=utf-8');
    }
}
