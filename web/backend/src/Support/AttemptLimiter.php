<?php

declare(strict_types=1);

namespace Bac\Support;

final class AttemptLimiter
{
    private static function dir(): string
    {
        $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'bac_attempts';
        if (!is_dir($dir)) {
            @mkdir($dir, 0700, true);
        }
        return $dir;
    }

    private static function file(string $bucket, string $key): string
    {
        $safe = preg_replace('/[^a-zA-Z0-9._-]/', '_', $bucket . '_' . $key) ?? 'unknown';
        return self::dir() . DIRECTORY_SEPARATOR . md5($safe);
    }

    /** @return array{count: int, first: int} */
    private static function read(string $file, int $windowSeconds): array
    {
        if (!is_file($file)) {
            return ['count' => 0, 'first' => 0];
        }
        $raw = @file_get_contents($file);
        if ($raw === false || $raw === '') {
            return ['count' => 0, 'first' => 0];
        }
        $parts = explode(':', $raw, 2);
        $first = (int) ($parts[0] ?? 0);
        $count = (int) ($parts[1] ?? 0);
        if ($first === 0 || (time() - $first) > $windowSeconds) {
            return ['count' => 0, 'first' => 0];
        }
        return ['count' => $count, 'first' => $first];
    }

    public static function tooMany(string $bucket, string $key, int $maxAttempts, int $windowSeconds): bool
    {
        $state = self::read(self::file($bucket, $key), $windowSeconds);
        return $state['count'] >= $maxAttempts;
    }

    public static function hit(string $bucket, string $key, int $windowSeconds): int
    {
        $file = self::file($bucket, $key);
        $state = self::read($file, $windowSeconds);
        $first = $state['first'] !== 0 ? $state['first'] : time();
        $count = $state['count'] + 1;
        @file_put_contents($file, $first . ':' . $count, LOCK_EX);
        return $count;
    }

    public static function reset(string $bucket, string $key): void
    {
        @unlink(self::file($bucket, $key));
    }
}
