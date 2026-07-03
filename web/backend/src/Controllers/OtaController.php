<?php

declare(strict_types=1);

namespace Bac\Controllers;

use Bac\Repositories\FirmwareReleaseRepository;
use Bac\Services\OtaService;
use Bac\Support\AssetsPackBuilder;
use Bac\Support\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Message\UploadedFileInterface;

final class OtaController
{
    public function __construct(
        private OtaService $ota,
        private FirmwareReleaseRepository $releases
    ) {
    }

    public function listReleases(Request $request, Response $response): Response
    {
        return JsonResponse::ok($response, [
            'ok' => true,
            'releases' => $this->ota->listReleases(),
            'active' => $this->ota->formatRelease($this->releases->getActivePublished()),
        ]);
    }

    public function upload(Request $request, Response $response): Response
    {
        $body = (array) $request->getParsedBody();
        $version = trim((string) ($body['version'] ?? ''));
        if ($version === '' || !preg_match('/^[0-9]+\\.[0-9]+\\.[0-9]+([.-][0-9A-Za-z]+)?$/', $version)) {
            return JsonResponse::error($response, 'invalid version (use semver like 1.0.1)', 400);
        }
        if ($this->releases->findByVersion($version)) {
            return JsonResponse::error($response, 'version already exists', 409);
        }

        $files = $request->getUploadedFiles();
        $firmware = $files['firmware'] ?? null;
        if (!$firmware instanceof UploadedFileInterface || $firmware->getError() !== UPLOAD_ERR_OK) {
            return JsonResponse::error($response, 'firmware file required', 400);
        }

        $dir = $this->ota->versionDir($version);
        if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
            return JsonResponse::error($response, 'storage mkdir failed', 500);
        }

        $firmwarePath = $dir . DIRECTORY_SEPARATOR . 'firmware.bin';
        $firmware->moveTo($firmwarePath);
        $firmwareSize = filesize($firmwarePath);
        $firmwareSha = hash_file('sha256', $firmwarePath);
        if ($firmwareSize === false || $firmwareSha === false) {
            return JsonResponse::error($response, 'firmware hash failed', 500);
        }

        $assetsFile = null;
        $assetsSha = null;
        $assetsSize = null;
        $assetsPath = null;
        $assets = $files['assets'] ?? null;
        if ($assets instanceof UploadedFileInterface && $assets->getError() === UPLOAD_ERR_OK) {
            $tmpZip = $dir . DIRECTORY_SEPARATOR . 'assets_upload.zip';
            $assets->moveTo($tmpZip);
            $assetsPath = $dir . DIRECTORY_SEPARATOR . 'assets.bacassets';
            try {
                $meta = AssetsPackBuilder::buildFromZip($tmpZip, $assetsPath);
            } catch (\InvalidArgumentException $e) {
                @unlink($tmpZip);
                return JsonResponse::error($response, $e->getMessage(), 400);
            } catch (\Throwable $e) {
                @unlink($tmpZip);
                return JsonResponse::error($response, 'assets pack failed', 500);
            }
            @unlink($tmpZip);
            $assetsSize = $meta['size'];
            $assetsSha = $meta['sha256'];
            $assetsFile = 'assets.bacassets';
        }

        $id = $this->releases->create([
            'version' => $version,
            'channel' => trim((string) ($body['channel'] ?? 'stable')) ?: 'stable',
            'firmware_file' => 'firmware.bin',
            'firmware_sha256' => $firmwareSha,
            'firmware_size' => $firmwareSize,
            'assets_file' => $assetsFile,
            'assets_sha256' => $assetsSha,
            'assets_size' => $assetsSize,
            'min_version' => trim((string) ($body['min_version'] ?? '')) ?: null,
            'notes' => trim((string) ($body['notes'] ?? '')) ?: null,
        ]);

        return JsonResponse::ok($response, [
            'ok' => true,
            'release' => $this->ota->formatRelease($this->releases->findById($id)),
        ], 201);
    }

    public function publish(Request $request, Response $response, array $args): Response
    {
        $id = (int) ($args['id'] ?? 0);
        if ($id <= 0) {
            return JsonResponse::error($response, 'invalid id', 400);
        }
        try {
            $data = $this->ota->publish($id);
            return JsonResponse::ok($response, ['ok' => true] + $data);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 400);
        }
    }

    public function notify(Request $request, Response $response, array $args): Response
    {
        $id = (int) ($args['id'] ?? 0);
        if ($id <= 0) {
            return JsonResponse::error($response, 'invalid id', 400);
        }
        try {
            $data = $this->ota->notifyPublishedRelease($id);
            return JsonResponse::ok($response, ['ok' => true] + $data);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 400);
        }
    }

    public function checkFirmware(Request $request, Response $response): Response
    {
        $device = (array) $request->getAttribute('device');
        $params = $request->getQueryParams();
        $current = isset($params['firmware_version'])
            ? (string) $params['firmware_version']
            : (string) ($device['firmware_version'] ?? '');
        $update = $this->ota->checkForDevice($current !== '' ? $current : null);
        if (!$update) {
            return $response->withStatus(204);
        }
        return JsonResponse::ok($response, ['ok' => true, 'firmware_update' => $update]);
    }

    public function lookupDevice(Request $request, Response $response): Response
    {
        $params = $request->getQueryParams();
        $serial = isset($params['serial_number']) ? (string) $params['serial_number'] : null;
        $uuid = isset($params['uuid']) ? (string) $params['uuid'] : null;
        $deviceId = isset($params['device_id']) ? (int) $params['device_id'] : null;
        if (($serial === null || $serial === '') && ($uuid === null || $uuid === '') && ($deviceId === null || $deviceId <= 0)) {
            return JsonResponse::error($response, 'serial_number, uuid, or device_id required', 400);
        }
        $device = $this->ota->lookupDevice($serial, $uuid, $deviceId);
        if (!$device) {
            return JsonResponse::error($response, 'device not found', 404);
        }
        return JsonResponse::ok($response, ['ok' => true, 'device' => $device]);
    }

    public function notifyDevice(Request $request, Response $response): Response
    {
        $body = (array) $request->getParsedBody();
        try {
            $data = $this->ota->notifyDevice(
                [
                    'device_id' => isset($body['device_id']) ? (int) $body['device_id'] : null,
                    'uuid' => isset($body['uuid']) ? (string) $body['uuid'] : null,
                    'serial_number' => isset($body['serial_number']) ? (string) $body['serial_number'] : null,
                ],
                isset($body['release_id']) ? (int) $body['release_id'] : null,
                !empty($body['force'])
            );
            return JsonResponse::ok($response, ['ok' => true] + $data);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 400);
        }
    }
}
