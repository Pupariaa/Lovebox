<?php

declare(strict_types=1);

namespace Bac\Controllers;

use Bac\Repositories\FirmwareReleaseRepository;
use Bac\Services\OtaService;
use Bac\Support\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class UsbDebugController
{
    private const MAX_CHUNK = 384;

    public function __construct(
        private OtaService $ota,
        private FirmwareReleaseRepository $releases
    ) {
    }

    public function listReleases(Request $request, Response $response): Response
    {
        $items = [];
        foreach ($this->releases->listAll() as $release) {
            if (empty($release['published'])) {
                continue;
            }
            $items[] = [
                'id' => (int) $release['id'],
                'version' => $release['version'],
                'firmware_size' => (int) $release['firmware_size'],
                'firmware_sha256' => $release['firmware_sha256'],
                'min_version' => $release['min_version'],
                'notes' => $release['notes'],
                'published_at' => $release['published_at'],
            ];
        }
        return JsonResponse::ok($response, [
            'ok' => true,
            'releases' => $items,
        ]);
    }

    public function firmwareChunk(Request $request, Response $response, array $args): Response
    {
        $serial = trim($request->getHeaderLine('X-Bac-Serial'));
        if ($serial === '' && isset($_SERVER['HTTP_X_BAC_SERIAL'])) {
            $serial = trim((string) $_SERVER['HTTP_X_BAC_SERIAL']);
        }
        if (!$this->isValidBacSerial($serial)) {
            return JsonResponse::error($response, 'Connectez votre boîte en USB.', 403);
        }

        $id = (int) ($args['id'] ?? 0);
        if ($id <= 0) {
            return JsonResponse::error($response, 'invalid id', 400);
        }
        $release = $this->releases->findById($id);
        if (!$release || empty($release['published'])) {
            return JsonResponse::error($response, 'release not found', 404);
        }

        $params = $request->getQueryParams();
        $offset = isset($params['offset']) ? (int) $params['offset'] : -1;
        $length = isset($params['length']) ? (int) $params['length'] : -1;
        if ($offset < 0 || $length <= 0 || $length > self::MAX_CHUNK) {
            return JsonResponse::error($response, 'invalid offset or length', 400);
        }

        $size = (int) $release['firmware_size'];
        if ($offset >= $size) {
            return JsonResponse::error($response, 'offset past end', 400);
        }
        $length = min($length, $size - $offset);

        $path = $this->ota->versionDir((string) $release['version'])
            . DIRECTORY_SEPARATOR
            . (string) $release['firmware_file'];
        if (!is_file($path)) {
            return JsonResponse::error($response, 'firmware file missing', 404);
        }

        $fh = fopen($path, 'rb');
        if ($fh === false) {
            return JsonResponse::error($response, 'firmware open failed', 500);
        }
        if (fseek($fh, $offset) !== 0) {
            fclose($fh);
            return JsonResponse::error($response, 'firmware seek failed', 500);
        }
        $data = fread($fh, $length);
        fclose($fh);
        if ($data === false) {
            return JsonResponse::error($response, 'firmware read failed', 500);
        }

        $response->getBody()->write($data);
        return $response
            ->withHeader('Content-Type', 'application/octet-stream')
            ->withHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
            ->withHeader('Pragma', 'no-cache')
            ->withHeader('X-Content-Type-Options', 'nosniff')
            ->withStatus(200);
    }

    private function isValidBacSerial(string $serial): bool
    {
        if ($serial === '' || strlen($serial) > 64) {
            return false;
        }
        return (bool) preg_match('/^BACXS32[A-Z0-9]+R[12]$/i', $serial);
    }
}
