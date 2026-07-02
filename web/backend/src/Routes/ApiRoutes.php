<?php

declare(strict_types=1);

namespace Bac\Routes;

use Bac\Controllers\AuthController;
use Bac\Controllers\DeviceController;
use Bac\Controllers\InviteController;
use Bac\Controllers\MessageController;
use Bac\Controllers\PairingController;
use Bac\Middleware\DeviceAuthMiddleware;
use Bac\Middleware\JwtAuthMiddleware;
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

        $app->get('/invite/{token}', InviteController::class . ':page');

        $app->group('/api/v1', function (RouteCollectorProxy $group) {
            $group->post('/auth/register', AuthController::class . ':register');
            $group->post('/auth/login', AuthController::class . ':login');
            $group->post('/auth/refresh', AuthController::class . ':refresh');
            $group->post('/auth/logout', AuthController::class . ':logout');
            $group->get('/auth/verify-email', AuthController::class . ':verifyEmail');

            $group->post('/devices/register', DeviceController::class . ':register');

            $group->group('', function (RouteCollectorProxy $deviceGroup) {
                $deviceGroup->get('/devices/poll', DeviceController::class . ':poll');
                $deviceGroup->post('/devices/heartbeat', DeviceController::class . ':heartbeat');
                $deviceGroup->post('/devices/messages/{id}/ack', DeviceController::class . ':ack');
            })->add(DeviceAuthMiddleware::class);

            $group->group('', function (RouteCollectorProxy $authGroup) {
                $authGroup->post('/devices/claim', DeviceController::class . ':claim');
                $authGroup->get('/devices/me', DeviceController::class . ':me');
                $authGroup->patch('/devices/me', DeviceController::class . ':updateMe');

                $authGroup->post('/pairings/invite', PairingController::class . ':invite');
                $authGroup->post('/pairings/accept-invite', PairingController::class . ':acceptInvite');
                $authGroup->post('/pairings/request', PairingController::class . ':request');
                $authGroup->post('/pairings/{id}/accept', PairingController::class . ':accept');
                $authGroup->post('/pairings/{id}/reject', PairingController::class . ':reject');
                $authGroup->get('/pairings/me', PairingController::class . ':me');

                $authGroup->post('/messages', MessageController::class . ':send');
                $authGroup->get('/messages/sent', MessageController::class . ':sent');
                $authGroup->get('/messages/sent/{id}/preview', MessageController::class . ':preview');
            })->add(JwtAuthMiddleware::class);
        });
    }
}
