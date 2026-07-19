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

    public function providers(Request $request, Response $response): Response
    {
        return JsonResponse::ok($response, [
            'providers' => $this->oauth->availableProviders(),
        ]);
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
        return $this->finishOAuth($request, $response, $args);
    }

    public function callbackPost(Request $request, Response $response, array $args): Response
    {
        return $this->finishOAuth($request, $response, $args);
    }

    public function nativeApple(Request $request, Response $response): Response
    {
        $body = (array) ($request->getParsedBody() ?? []);
        try {
            $tokens = $this->oauth->handleNativeApple($body);
            return JsonResponse::ok($response, $tokens);
        } catch (\InvalidArgumentException $e) {
            $status = $e->getMessage() === 'account_not_found' ? 404 : 400;
            return JsonResponse::error($response, $e->getMessage(), $status);
        }
    }

    public function exchange(Request $request, Response $response): Response
    {
        $body = (array) ($request->getParsedBody() ?? []);
        $code = (string) ($body['code'] ?? ($request->getQueryParams()['code'] ?? ''));
        try {
            $tokens = $this->oauth->exchangeCode($code);
            return JsonResponse::ok($response, $tokens);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 400);
        }
    }

    private function finishOAuth(Request $request, Response $response, array $args): Response
    {
        $provider = (string) ($args['provider'] ?? '');
        $params = array_merge($request->getQueryParams(), (array) ($request->getParsedBody() ?? []));
        $native = OAuthService::decodeNativeRedirect((string) ($params['state'] ?? ''));
        try {
            $tokens = $this->oauth->handleCallback($provider, $params);
            $code = $this->oauth->createExchangeCode($tokens);
            $query = http_build_query(['code' => $code]);
            if ($native !== null) {
                $separator = str_contains($native, '?') ? '&' : '?';
                return $response->withHeader('Location', $native . $separator . $query)->withStatus(302);
            }
            $settings = require dirname(__DIR__, 2) . '/config/settings.php';
            $redirect = rtrim($settings['app']['url'], '/') . '/sim/oauth-callback.html';
            return $response->withHeader('Location', $redirect . '?' . $query)->withStatus(302);
        } catch (\InvalidArgumentException $e) {
            if ($native !== null) {
                $query = http_build_query(['error' => $e->getMessage()]);
                $separator = str_contains($native, '?') ? '&' : '?';
                return $response->withHeader('Location', $native . $separator . $query)->withStatus(302);
            }
            return JsonResponse::error($response, $e->getMessage(), 400);
        } catch (\Throwable $e) {
            error_log('oauth callback failed: ' . $e->getMessage());
            if ($native !== null) {
                $query = http_build_query(['error' => 'server_error']);
                $separator = str_contains($native, '?') ? '&' : '?';
                return $response->withHeader('Location', $native . $separator . $query)->withStatus(302);
            }
            return JsonResponse::error($response, 'server_error', 500);
        }
    }
}
