<?php

declare(strict_types=1);

namespace Bac\Support;

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;

final class JwksVerifier
{
    private const CACHE_TTL = 21600;

    /**
     * @param list<string> $allowedIssuers
     * @return array<string, mixed>
     */
    public static function verify(
        string $idToken,
        string $jwksUrl,
        array $allowedIssuers,
        string $expectedAudience
    ): array {
        if ($expectedAudience === '') {
            throw new \InvalidArgumentException('missing expected audience');
        }
        $keys = self::keys($jwksUrl);
        if ($keys === []) {
            throw new \InvalidArgumentException('unable to load id_token signing keys');
        }
        JWT::$leeway = 60;
        try {
            $decoded = (array) JWT::decode($idToken, $keys);
        } catch (\Throwable) {
            throw new \InvalidArgumentException('invalid id_token signature');
        }
        $issuer = (string) ($decoded['iss'] ?? '');
        if (!in_array($issuer, $allowedIssuers, true)) {
            throw new \InvalidArgumentException('invalid id_token issuer');
        }
        $audience = $decoded['aud'] ?? '';
        $audiences = is_array($audience) ? $audience : [$audience];
        $audiences = array_map(static fn ($value): string => (string) $value, $audiences);
        if (!in_array($expectedAudience, $audiences, true)) {
            throw new \InvalidArgumentException('invalid id_token audience');
        }
        return $decoded;
    }

    /** @return array<string, \Firebase\JWT\Key> */
    private static function keys(string $jwksUrl): array
    {
        $raw = self::fetchJwks($jwksUrl);
        if ($raw === null) {
            return [];
        }
        $data = json_decode($raw, true);
        if (!is_array($data) || empty($data['keys'])) {
            return [];
        }
        try {
            return JWK::parseKeySet($data, 'RS256');
        } catch (\Throwable) {
            return [];
        }
    }

    private static function fetchJwks(string $jwksUrl): ?string
    {
        $cacheFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'bac_jwks_' . md5($jwksUrl) . '.json';
        if (is_file($cacheFile) && (time() - (int) @filemtime($cacheFile)) < self::CACHE_TTL) {
            $cached = @file_get_contents($cacheFile);
            if (is_string($cached) && $cached !== '') {
                return $cached;
            }
        }
        $ctx = stream_context_create(['http' => ['method' => 'GET', 'timeout' => 8]]);
        $raw = @file_get_contents($jwksUrl, false, $ctx);
        if (!is_string($raw) || $raw === '') {
            $stale = is_file($cacheFile) ? @file_get_contents($cacheFile) : false;
            return is_string($stale) && $stale !== '' ? $stale : null;
        }
        @file_put_contents($cacheFile, $raw, LOCK_EX);
        return $raw;
    }
}
