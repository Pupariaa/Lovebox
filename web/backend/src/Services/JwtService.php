<?php

declare(strict_types=1);

namespace Bac\Services;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

final class JwtService
{
    private string $secret;
    private int $accessTtl;
    private int $refreshTtl;

    public function __construct()
    {
        $settings = require dirname(__DIR__, 2) . '/config/settings.php';
        $this->secret = $settings['jwt']['secret'];
        $this->accessTtl = $settings['jwt']['access_ttl'];
        $this->refreshTtl = $settings['jwt']['refresh_ttl'];
    }

    public function accessTtl(): int
    {
        return $this->accessTtl;
    }

    public function refreshTtl(): int
    {
        return $this->refreshTtl;
    }

    public function issueAccessToken(int $userId, string $email): string
    {
        $now = time();
        return JWT::encode([
            'sub' => $userId,
            'email' => $email,
            'type' => 'access',
            'iat' => $now,
            'exp' => $now + $this->accessTtl,
        ], $this->secret, 'HS256');
    }

    public function decodeAccessToken(string $token): ?array
    {
        try {
            $decoded = JWT::decode($token, new Key($this->secret, 'HS256'));
            $payload = (array) $decoded;
            if (($payload['type'] ?? '') !== 'access') {
                return null;
            }
            return $payload;
        } catch (\Throwable) {
            return null;
        }
    }
}
