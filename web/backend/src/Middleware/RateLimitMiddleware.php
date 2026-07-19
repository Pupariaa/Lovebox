<?php

declare(strict_types=1);

namespace Bac\Middleware;

use Bac\Support\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;

// Fixed-window per-IP rate limiter backed by the local filesystem (no external dependency).
// Protects brute-force sensitive endpoints (auth, device registration/authentication). Fails open
// if the counter storage is not writable so a storage issue never blocks legitimate traffic.
final class RateLimitMiddleware implements MiddlewareInterface
{
    private string $dir;

    public function __construct(
        private string $bucket,
        private int $limit,
        private int $windowSeconds
    ) {
        $this->dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'bac_ratelimit';
        if (!is_dir($this->dir)) {
            @mkdir($this->dir, 0700, true);
        }
    }

    public function process(Request $request, Handler $handler): Response
    {
        $ip = $this->clientIp($request);
        $now = time();
        $windowStart = $now - ($now % $this->windowSeconds);
        $safeIp = preg_replace('/[^a-zA-Z0-9:._-]/', '_', $ip) ?? 'unknown';
        $file = $this->dir . DIRECTORY_SEPARATOR . $this->bucket . '_' . md5($safeIp) . '_' . $windowStart;

        $count = $this->increment($file);
        if ($count > $this->limit) {
            $retry = $this->windowSeconds - ($now % $this->windowSeconds);
            return JsonResponse::error(new \Slim\Psr7\Response(), 'rate limit exceeded', 429)
                ->withHeader('Retry-After', (string) $retry);
        }

        if (mt_rand(1, 100) === 1) {
            $this->cleanup($now);
        }

        return $handler->handle($request);
    }

    private function increment(string $file): int
    {
        $fh = @fopen($file, 'c+');
        if ($fh === false) {
            return 0;
        }
        $count = 0;
        if (flock($fh, LOCK_EX)) {
            $content = stream_get_contents($fh);
            $count = (int) $content + 1;
            ftruncate($fh, 0);
            rewind($fh);
            fwrite($fh, (string) $count);
            fflush($fh);
            flock($fh, LOCK_UN);
        }
        fclose($fh);
        return $count;
    }

    private function cleanup(int $now): void
    {
        $files = @glob($this->dir . DIRECTORY_SEPARATOR . '*');
        if ($files === false) {
            return;
        }
        foreach ($files as $f) {
            if (is_file($f) && ($now - @filemtime($f)) > ($this->windowSeconds * 3)) {
                @unlink($f);
            }
        }
    }

    private function clientIp(Request $request): string
    {
        $forwarded = $request->getHeaderLine('X-Forwarded-For');
        if ($forwarded !== '') {
            $parts = explode(',', $forwarded);
            $first = trim($parts[0]);
            if ($first !== '') {
                return $first;
            }
        }
        $server = $request->getServerParams();
        return isset($server['REMOTE_ADDR']) ? (string) $server['REMOTE_ADDR'] : 'unknown';
    }
}
