<?php

declare(strict_types=1);

namespace Bac\Middleware;

use Bac\Support\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;

final class RateLimitMiddleware implements MiddlewareInterface
{
    private string $dir;
    /** @var list<string> */
    private array $trustedProxies;

    public function __construct(
        private string $bucket,
        private int $limit,
        private int $windowSeconds
    ) {
        $this->dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'bac_ratelimit';
        if (!is_dir($this->dir)) {
            @mkdir($this->dir, 0700, true);
        }
        $settings = require dirname(__DIR__, 2) . '/config/settings.php';
        $this->trustedProxies = $settings['security']['trusted_proxies'] ?? [];
    }

    public function process(Request $request, Handler $handler): Response
    {
        if (!is_dir($this->dir) || !is_writable($this->dir)) {
            return JsonResponse::error(new \Slim\Psr7\Response(), 'rate limit storage unavailable', 503);
        }

        $ip = $this->clientIp($request);
        $now = time();
        $windowStart = $now - ($now % $this->windowSeconds);
        $safeIp = preg_replace('/[^a-zA-Z0-9:._-]/', '_', $ip) ?? 'unknown';
        $file = $this->dir . DIRECTORY_SEPARATOR . $this->bucket . '_' . md5($safeIp) . '_' . $windowStart;

        $count = $this->increment($file);
        if ($count === null) {
            return JsonResponse::error(new \Slim\Psr7\Response(), 'rate limit storage unavailable', 503);
        }
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

    private function increment(string $file): ?int
    {
        $fh = @fopen($file, 'c+');
        if ($fh === false) {
            return null;
        }
        $count = null;
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
        $server = $request->getServerParams();
        $remote = isset($server['REMOTE_ADDR']) ? (string) $server['REMOTE_ADDR'] : 'unknown';
        if ($this->trustedProxies === [] || !in_array($remote, $this->trustedProxies, true)) {
            return $remote;
        }
        $forwarded = $request->getHeaderLine('X-Forwarded-For');
        if ($forwarded !== '') {
            $parts = explode(',', $forwarded);
            $first = trim($parts[0]);
            if ($first !== '') {
                return $first;
            }
        }
        return $remote;
    }
}
