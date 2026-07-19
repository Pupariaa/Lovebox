<?php

declare(strict_types=1);

namespace Bac\Controllers;

use Bac\Services\FleetService;
use Bac\Support\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class AdminController
{
    public function __construct(private FleetService $fleet)
    {
    }

    public function stats(Request $request, Response $response): Response
    {
        return JsonResponse::ok($response, ['ok' => true] + $this->fleet->stats());
    }

    public function devices(Request $request, Response $response): Response
    {
        $params = $request->getQueryParams();
        $filters = [
            'q' => isset($params['q']) ? trim((string) $params['q']) : '',
            'version' => isset($params['version']) ? trim((string) $params['version']) : '',
            'region' => isset($params['region']) ? trim((string) $params['region']) : '',
        ];
        if (isset($params['claimed']) && $params['claimed'] !== '') {
            $filters['claimed'] = filter_var($params['claimed'], FILTER_VALIDATE_BOOLEAN);
        }
        $devices = $this->fleet->listDevices($filters);
        if (isset($params['online']) && $params['online'] !== '') {
            $wantOnline = filter_var($params['online'], FILTER_VALIDATE_BOOLEAN);
            $devices = array_values(array_filter(
                $devices,
                fn ($d) => (bool) $d['online'] === $wantOnline
            ));
        }
        return JsonResponse::ok($response, [
            'ok' => true,
            'devices' => $devices,
            'count' => count($devices),
        ]);
    }

    public function deviceDetail(Request $request, Response $response, array $args): Response
    {
        $id = (int) ($args['id'] ?? 0);
        if ($id <= 0) {
            return JsonResponse::error($response, 'invalid id', 400);
        }
        $device = $this->fleet->deviceDetail($id);
        if (!$device) {
            return JsonResponse::error($response, 'device not found', 404);
        }
        return JsonResponse::ok($response, ['ok' => true, 'device' => $device]);
    }

    public function notifyBatch(Request $request, Response $response): Response
    {
        $body = (array) $request->getParsedBody();
        $ids = $body['device_ids'] ?? [];
        if (!is_array($ids) || $ids === []) {
            return JsonResponse::error($response, 'device_ids required', 400);
        }
        $releaseId = isset($body['release_id']) && $body['release_id'] !== ''
            ? (int) $body['release_id']
            : null;
        $force = !empty($body['force']);
        $data = $this->fleet->notifyBatch($ids, $releaseId, $force);
        return JsonResponse::ok($response, ['ok' => true] + $data);
    }

    public function command(Request $request, Response $response): Response
    {
        $body = (array) $request->getParsedBody();
        $ids = $body['device_ids'] ?? [];
        if (!is_array($ids) || $ids === []) {
            return JsonResponse::error($response, 'device_ids required', 400);
        }
        $command = trim((string) ($body['command'] ?? ''));
        if ($command === '') {
            return JsonResponse::error($response, 'command required', 400);
        }
        try {
            $data = $this->fleet->sendCommand($ids, $command, [
                'display_name' => $body['display_name'] ?? null,
                'region' => $body['region'] ?? null,
            ]);
            return JsonResponse::ok($response, ['ok' => true] + $data);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 400);
        }
    }
}
