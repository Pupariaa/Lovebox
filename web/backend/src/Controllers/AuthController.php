<?php

declare(strict_types=1);

namespace Bac\Controllers;

use Bac\Services\AuthService;
use Bac\Support\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class AuthController
{
    public function __construct(private AuthService $auth)
    {
    }

    public function register(Request $request, Response $response): Response
    {
        $body = (array) $request->getParsedBody();
        try {
            $data = $this->auth->register((string) ($body['email'] ?? ''), (string) ($body['password'] ?? ''));
            return JsonResponse::ok($response, ['ok' => true] + $data, 201);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 400);
        }
    }

    public function login(Request $request, Response $response): Response
    {
        $body = (array) $request->getParsedBody();
        try {
            $data = $this->auth->login((string) ($body['email'] ?? ''), (string) ($body['password'] ?? ''));
            return JsonResponse::ok($response, ['ok' => true] + $data);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 401);
        }
    }

    public function refresh(Request $request, Response $response): Response
    {
        $body = (array) $request->getParsedBody();
        try {
            $data = $this->auth->refresh((string) ($body['refresh_token'] ?? ''));
            return JsonResponse::ok($response, ['ok' => true] + $data);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 401);
        }
    }

    public function logout(Request $request, Response $response): Response
    {
        $body = (array) $request->getParsedBody();
        $this->auth->logout((string) ($body['refresh_token'] ?? ''));
        return JsonResponse::ok($response, ['ok' => true]);
    }

    public function verifyEmail(Request $request, Response $response): Response
    {
        $params = $request->getQueryParams();
        $token = (string) ($params['token'] ?? '');
        if ($token === '' || !$this->auth->verifyEmail($token)) {
            $response->getBody()->write('<html><body><p>Invalid or expired token.</p></body></html>');
            return $response->withHeader('Content-Type', 'text/html')->withStatus(400);
        }
        $response->getBody()->write('<html><body><p>Email confirmed. You can return to the app.</p></body></html>');
        return $response->withHeader('Content-Type', 'text/html');
    }
}
