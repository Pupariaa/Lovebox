<?php

declare(strict_types=1);

namespace Bac\Controllers;

use Bac\Repositories\UserRepository;
use Bac\Support\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class UserController
{
    public function __construct(private UserRepository $users)
    {
    }

    public function me(Request $request, Response $response): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $user = $this->users->findById($userId);
        if (!$user) {
            return JsonResponse::error($response, 'not found', 404);
        }
        return JsonResponse::ok($response, ['ok' => true, 'user' => $this->formatUser($user)]);
    }

    public function updateMe(Request $request, Response $response): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $body = (array) $request->getParsedBody();
        $user = $this->users->findById($userId);
        if (!$user) {
            return JsonResponse::error($response, 'not found', 404);
        }
        $fields = [];
        if (isset($body['first_name'])) {
            $fields['first_name'] = substr(trim((string) $body['first_name']), 0, 64);
        }
        if (isset($body['last_name'])) {
            $fields['last_name'] = substr(trim((string) $body['last_name']), 0, 64);
        }
        if (isset($body['locale'])) {
            $fields['locale'] = substr(trim((string) $body['locale']), 0, 8);
        }
        if (isset($body['password'])) {
            $password = (string) $body['password'];
            if (strlen($password) < 8) {
                return JsonResponse::error($response, 'password too short', 400);
            }
            $fields['password_hash'] = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        }
        if ($fields !== []) {
            $this->users->update($userId, $fields);
            $user = $this->users->findById($userId);
        }
        return JsonResponse::ok($response, ['ok' => true, 'user' => $this->formatUser($user)]);
    }

    private function formatUser(array $user): array
    {
        return [
            'id' => (int) $user['id'],
            'email' => $user['email'],
            'first_name' => $user['first_name'] ?? null,
            'last_name' => $user['last_name'] ?? null,
            'locale' => $user['locale'] ?? 'fr',
            'email_verified' => $user['email_verified_at'] !== null,
        ];
    }
}
