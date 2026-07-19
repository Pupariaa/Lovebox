<?php

declare(strict_types=1);

namespace Bac\Services;

use Firebase\JWT\JWT;

final class AppleClientSecret
{
    private array $settings;

    public function __construct()
    {
        $this->settings = require dirname(__DIR__, 2) . '/config/settings.php';
    }

    public function isConfigured(): bool
    {
        $oauth = $this->settings['oauth'] ?? [];
        return trim((string) ($oauth['apple_team_id'] ?? '')) !== ''
            && trim((string) ($oauth['apple_key_id'] ?? '')) !== ''
            && $this->privateKey() !== '';
    }

    public function forClientId(string $clientId): string
    {
        $oauth = $this->settings['oauth'] ?? [];
        $teamId = trim((string) ($oauth['apple_team_id'] ?? ''));
        $keyId = trim((string) ($oauth['apple_key_id'] ?? ''));
        $privateKey = $this->privateKey();
        if ($teamId === '' || $keyId === '' || $privateKey === '') {
            throw new \InvalidArgumentException('apple oauth not configured');
        }
        $now = time();
        $payload = [
            'iss' => $teamId,
            'iat' => $now,
            'exp' => $now + 86400 * 150,
            'aud' => 'https://appleid.apple.com',
            'sub' => $clientId,
        ];
        return JWT::encode($payload, $privateKey, 'ES256', $keyId);
    }

    private function privateKey(): string
    {
        $oauth = $this->settings['oauth'] ?? [];
        $inline = trim((string) ($oauth['apple_private_key'] ?? ''));
        if ($inline !== '') {
            return str_replace('\\n', "\n", $inline);
        }
        $path = trim((string) ($oauth['apple_private_key_path'] ?? ''));
        if ($path === '' || !is_readable($path)) {
            return '';
        }
        $contents = file_get_contents($path);
        return is_string($contents) ? $contents : '';
    }
}
