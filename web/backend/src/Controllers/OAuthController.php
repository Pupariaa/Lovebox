<?php

declare(strict_types=1);

namespace Bac\Controllers;

use Bac\Services\OAuthService;
use Bac\Support\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class OAuthController
{
    public function __construct(private OAuthService $oauth)
    {
    }

    public function start(Request $request, Response $response, array $args): Response
    {
        $provider = (string) ($args['provider'] ?? '');
        try {
            $url = $this->oauth->startUrl($provider, $request->getQueryParams());
            return $response->withHeader('Location', $url)->withStatus(302);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 400);
        }
    }

    public function callback(Request $request, Response $response, array $args): Response
    {
        $provider = (string) ($args['provider'] ?? '');
        $params = $request->getQueryParams();
        try {
            $tokens = $this->oauth->handleCallback($provider, $params);
            $native = OAuthService::decodeNativeRedirect((string) ($params['state'] ?? ''));
            $query = http_build_query($tokens);
            if ($native !== null) {
                $separator = str_contains($native, '?') ? '&' : '?';
                return $response->withHeader('Location', $native . $separator . $query)->withStatus(302);
            }
            $settings = require dirname(__DIR__, 2) . '/config/settings.php';
            $redirect = rtrim($settings['app']['url'], '/') . '/sim/oauth-callback.html';
            return $response->withHeader('Location', $redirect . '?' . $query)->withStatus(302);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 400);
        }
    }
}
