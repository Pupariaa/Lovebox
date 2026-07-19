<?php

declare(strict_types=1);

namespace Bac\Controllers;

use Bac\Repositories\FirmwareReleaseRepository;
use Bac\Services\OtaService;
use Bac\Support\AssetsPackBuilder;
use Bac\Support\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class UsbDebugController
{
    private const MAX_CHUNK = 768;

    private array $settings;

    public function __construct(
        private OtaService $ota,
        private FirmwareReleaseRepository $releases
    ) {
        $this->settings = require dirname(__DIR__, 2) . '/config/settings.php';
    }

    public function listReleases(Request $request, Response $response): Response
    {
        $serial = $this->requestSerial($request);
        if (!$this->isValidBacSerial($serial)) {
            return JsonResponse::error($response, 'Connectez votre boîte en USB.', 403);
        }
        $ttl = (int) $this->settings['usb_debug']['token_ttl'];
        $downloadToken = $this->issueDownloadToken($serial, $ttl);
        $items = [];
        foreach ($this->releases->listAll() as $release) {
            if (empty($release['published'])) {
                continue;
            }
            $manifestSize = 0;
            $manifestPath = $this->releaseFilePath($release, 'manifest');
            if ($manifestPath !== null && is_file($manifestPath)) {
                $manifestSize = (int) filesize($manifestPath);
            }
            $items[] = [
                'id' => (int) $release['id'],
                'version' => $release['version'],
                'firmware_size' => (int) $release['firmware_size'],
                'firmware_sha256' => $release['firmware_sha256'],
                'assets_size' => (int) ($release['assets_size'] ?? 0),
                'assets_sha256' => $release['assets_sha256'] ?? null,
                'assets_manifest_size' => $manifestSize,
                'min_version' => $release['min_version'],
                'notes' => $release['notes'],
                'published_at' => $release['published_at'],
            ];
        }
        return JsonResponse::ok($response, [
            'ok' => true,
            'releases' => $items,
            'download_token' => $downloadToken,
            'token_expires_in' => $ttl,
        ]);
    }

    public function firmwareDownload(Request $request, Response $response, array $args): Response
    {
        return $this->binaryDownload($request, $response, $args, 'firmware');
    }

    public function firmwareChunk(Request $request, Response $response, array $args): Response
    {
        return $this->binaryChunk($request, $response, $args, 'firmware');
    }

    public function assetsDownload(Request $request, Response $response, array $args): Response
    {
        return $this->binaryDownload($request, $response, $args, 'assets');
    }

    public function assetsChunk(Request $request, Response $response, array $args): Response
    {
        return $this->binaryChunk($request, $response, $args, 'assets');
    }

    public function manifestDownload(Request $request, Response $response, array $args): Response
    {
        return $this->binaryDownload($request, $response, $args, 'manifest');
    }

    public function manifestChunk(Request $request, Response $response, array $args): Response
    {
        return $this->binaryChunk($request, $response, $args, 'manifest');
    }

    private function binaryDownload(Request $request, Response $response, array $args, string $kind): Response
    {
        $auth = $this->authorizeDownload($request, $response, $args, $kind);
        if ($auth instanceof Response) {
            return $auth;
        }
        $size = (int) $auth['size'];

        $data = file_get_contents($auth['path']);
        if ($data === false) {
            return JsonResponse::error($response, $kind . ' read failed', 500);
        }

        $response->getBody()->write($data);
        return $response
            ->withHeader('Content-Type', 'application/octet-stream')
            ->withHeader('Content-Length', (string) $size)
            ->withHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
            ->withHeader('Pragma', 'no-cache')
            ->withHeader('X-Content-Type-Options', 'nosniff')
            ->withStatus(200);
    }

    private function binaryChunk(Request $request, Response $response, array $args, string $kind): Response
    {
        $auth = $this->authorizeDownload($request, $response, $args, $kind);
        if ($auth instanceof Response) {
            return $auth;
        }

        $params = $request->getQueryParams();
        $offset = isset($params['offset']) ? (int) $params['offset'] : -1;
        $length = isset($params['length']) ? (int) $params['length'] : -1;
        if ($offset < 0 || $length <= 0 || $length > self::MAX_CHUNK) {
            return JsonResponse::error($response, 'invalid offset or length', 400);
        }

        $size = (int) $auth['size'];
        if ($offset >= $size) {
            return JsonResponse::error($response, 'offset past end', 400);
        }
        $length = min($length, $size - $offset);

        $fh = fopen($auth['path'], 'rb');
        if ($fh === false) {
            return JsonResponse::error($response, $kind . ' open failed', 500);
        }
        if (fseek($fh, $offset) !== 0) {
            fclose($fh);
            return JsonResponse::error($response, $kind . ' seek failed', 500);
        }
        $data = fread($fh, $length);
        fclose($fh);
        if ($data === false) {
            return JsonResponse::error($response, $kind . ' read failed', 500);
        }

        $response->getBody()->write($data);
        return $response
            ->withHeader('Content-Type', 'application/octet-stream')
            ->withHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
            ->withHeader('Pragma', 'no-cache')
            ->withHeader('X-Content-Type-Options', 'nosniff')
            ->withStatus(200);
    }

    private function authorizeDownload(Request $request, Response $response, array $args, string $kind): array|Response
    {
        $serial = $this->requestSerial($request);
        if (!$this->isValidBacSerial($serial)) {
            return JsonResponse::error($response, 'Connectez votre boîte en USB.', 403);
        }
        $token = trim($request->getHeaderLine('X-Bac-Download-Token'));
        if ($token === '' && isset($_SERVER['HTTP_X_BAC_DOWNLOAD_TOKEN'])) {
            $token = trim((string) $_SERVER['HTTP_X_BAC_DOWNLOAD_TOKEN']);
        }
        if (!$this->verifyDownloadToken($serial, $token)) {
            return JsonResponse::error($response, 'session expirée, relancez le diagnostic.', 401);
        }

        $id = (int) ($args['id'] ?? 0);
        if ($id <= 0) {
            return JsonResponse::error($response, 'invalid id', 400);
        }
        $release = $this->releases->findById($id);
        if (!$release || empty($release['published'])) {
            return JsonResponse::error($response, 'release not found', 404);
        }

        $path = $this->releaseFilePath($release, $kind);
        if ($path === null || !is_file($path)) {
            return JsonResponse::error($response, $kind . ' file missing', 404);
        }

        $size = (int) filesize($path);
        if ($kind === 'firmware') {
            $size = (int) $release['firmware_size'];
        } elseif ($kind === 'assets') {
            $size = (int) ($release['assets_size'] ?? 0);
        }

        return ['release' => $release, 'path' => $path, 'size' => $size];
    }

    private function releaseFilePath(array $release, string $kind): ?string
    {
        $dir = $this->ota->versionDir((string) $release['version']);
        if ($kind === 'firmware') {
            return $dir . DIRECTORY_SEPARATOR . (string) $release['firmware_file'];
        }
        if ($kind === 'assets') {
            if (empty($release['assets_file'])) {
                return null;
            }
            return $dir . DIRECTORY_SEPARATOR . (string) $release['assets_file'];
        }
        if ($kind === 'manifest') {
            if (empty($release['assets_file'])) {
                return null;
            }
            return AssetsPackBuilder::manifestPathFor(
                $dir . DIRECTORY_SEPARATOR . (string) $release['assets_file']
            );
        }
        return null;
    }

    private function requestSerial(Request $request): string
    {
        $serial = trim($request->getHeaderLine('X-Bac-Serial'));
        if ($serial === '' && isset($_SERVER['HTTP_X_BAC_SERIAL'])) {
            $serial = trim((string) $_SERVER['HTTP_X_BAC_SERIAL']);
        }
        return $serial;
    }

    private function isValidBacSerial(string $serial): bool
    {
        if ($serial === '' || strlen($serial) > 64) {
            return false;
        }
        return (bool) preg_match('/^BACXS32[A-Z0-9]+R[12]$/i', $serial);
    }

    private function issueDownloadToken(string $serial, int $ttl): string
    {
        $expiry = time() + $ttl;
        return $expiry . '.' . $this->signDownload($serial, $expiry);
    }

    private function verifyDownloadToken(string $serial, string $token): bool
    {
        if ($token === '' || !str_contains($token, '.')) {
            return false;
        }
        [$expiryRaw, $signature] = explode('.', $token, 2);
        if (!ctype_digit($expiryRaw)) {
            return false;
        }
        $expiry = (int) $expiryRaw;
        if ($expiry < time()) {
            return false;
        }
        $expected = $this->signDownload($serial, $expiry);
        return hash_equals($expected, $signature);
    }

    private function signDownload(string $serial, int $expiry): string
    {
        $secret = (string) $this->settings['usb_debug']['token_secret'];
        return hash_hmac('sha256', strtoupper($serial) . '|' . $expiry, $secret);
    }
}
