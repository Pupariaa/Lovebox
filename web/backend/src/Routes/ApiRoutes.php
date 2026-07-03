<?php

declare(strict_types=1);

namespace Bac\Routes;

use Bac\Controllers\AuthController;
use Bac\Controllers\DeviceController;
use Bac\Controllers\MessageController;
use Bac\Controllers\OAuthController;
use Bac\Controllers\OtaController;
use Bac\Controllers\PairingController;
use Bac\Controllers\UserController;
use Bac\Middleware\DeviceAuthMiddleware;
use Bac\Middleware\JwtAuthMiddleware;
use Bac\Middleware\OtaAdminMiddleware;
use Slim\App;
use Slim\Routing\RouteCollectorProxy;

final class ApiRoutes
{
    public static function register(App $app): void
    {
        $app->get('/health', function ($request, $response) {
            $response->getBody()->write(json_encode(['ok' => true, 'service' => 'boite-a-coeur-api']));
            return $response->withHeader('Content-Type', 'application/json');
        });

        $app->group('/api/v1', function (RouteCollectorProxy $group) {
            $group->post('/auth/register', AuthController::class . ':register');
            $group->post('/auth/login', AuthController::class . ':login');
            $group->post('/auth/refresh', AuthController::class . ':refresh');
            $group->post('/auth/logout', AuthController::class . ':logout');
            $group->get('/auth/verify-email', AuthController::class . ':verifyEmail');

            $group->get('/auth/oauth/{provider}/start', OAuthController::class . ':start');
            $group->get('/auth/oauth/{provider}/callback', OAuthController::class . ':callback');

            $group->post('/devices/register', DeviceController::class . ':register');

            $group->group('/updates', function (RouteCollectorProxy $otaGroup) {
                $otaGroup->get('/releases', OtaController::class . ':listReleases');
                $otaGroup->get('/devices/lookup', OtaController::class . ':lookupDevice');
                $otaGroup->post('/devices/notify', OtaController::class . ':notifyDevice');
                $otaGroup->post('/upload', OtaController::class . ':upload');
                $otaGroup->post('/releases/{id}/publish', OtaController::class . ':publish');
                $otaGroup->post('/releases/{id}/notify', OtaController::class . ':notify');
            })->add(OtaAdminMiddleware::class);

            $group->group('', function (RouteCollectorProxy $deviceGroup) {
                $deviceGroup->get('/devices/poll', DeviceController::class . ':poll');
                $deviceGroup->get('/devices/commands/poll', DeviceController::class . ':pollCommands');
                $deviceGroup->get('/devices/firmware/check', OtaController::class . ':checkFirmware');
                $deviceGroup->post('/devices/heartbeat', DeviceController::class . ':heartbeat');
                $deviceGroup->post('/devices/messages/{id}/ack', DeviceController::class . ':ack');
                $deviceGroup->post('/devices/messages/{id}/nack', DeviceController::class . ':nack');
                $deviceGroup->post('/devices/commands/{id}/ack', DeviceController::class . ':ackCommand');
                $deviceGroup->post('/devices/commands/{id}/fail', DeviceController::class . ':failCommand');
            })->add(DeviceAuthMiddleware::class);

            $group->group('', function (RouteCollectorProxy $authGroup) {
                $authGroup->post('/devices/claim', DeviceController::class . ':claim');
                $authGroup->get('/devices/me', DeviceController::class . ':me');
                $authGroup->patch('/devices/{id}', DeviceController::class . ':updateMe');
                $authGroup->delete('/devices/{id}/claim', DeviceController::class . ':unclaim');

                $authGroup->post('/pairings/code/generate', PairingController::class . ':generateCode');
                $authGroup->post('/pairings/code/accept', PairingController::class . ':acceptCode');
                $authGroup->delete('/pairings/{id}', PairingController::class . ':unlink');
                $authGroup->get('/pairings/me', PairingController::class . ':me');

                $authGroup->get('/users/me', UserController::class . ':me');
                $authGroup->patch('/users/me', UserController::class . ':updateMe');

                $authGroup->post('/messages', MessageController::class . ':send');
                $authGroup->get('/messages/sent', MessageController::class . ':sent');
                $authGroup->get('/messages/sent/{id}/preview', MessageController::class . ':preview');
            })->add(JwtAuthMiddleware::class);
        });
    }
}
