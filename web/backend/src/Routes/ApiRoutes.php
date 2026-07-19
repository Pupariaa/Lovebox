<?php

declare(strict_types=1);

namespace Bac\Routes;

use Bac\Controllers\AdminController;
use Bac\Controllers\AuthController;
use Bac\Controllers\DeletionController;
use Bac\Controllers\DeviceController;
use Bac\Controllers\LegalController;
use Bac\Controllers\ManualController;
use Bac\Controllers\MarketingController;
use Bac\Controllers\MessageController;
use Bac\Controllers\OAuthController;
use Bac\Controllers\OtaController;
use Bac\Controllers\PairingController;
use Bac\Controllers\UsbDebugController;
use Bac\Controllers\UserController;
use Bac\Middleware\DeviceAuthMiddleware;
use Bac\Middleware\JwtAuthMiddleware;
use Bac\Middleware\OtaAdminMiddleware;
use Bac\Middleware\RateLimitMiddleware;
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

        $app->get('/', MarketingController::class . ':home');

        $manual = ManualController::class . ':page';
        $app->get('/manual', $manual);
        $app->get('/notice', $manual);
        $app->get('/guide', $manual);

        $app->get('/robots.txt', function ($request, $response) {
            return self::servePublicStatic($response, 'robots.txt', 'text/plain; charset=utf-8');
        });
        $app->get('/sitemap.xml', function ($request, $response) {
            return self::servePublicStatic($response, 'sitemap.xml', 'application/xml; charset=utf-8');
        });

        $legal = LegalController::class . ':page';
        foreach ([
            '/privacy' => 'privacy',
            '/confidentialite' => 'privacy',
            '/terms' => 'terms',
            '/cgu' => 'terms',
            '/legal' => 'legal',
            '/mentions-legales' => 'legal',
            '/cookies' => 'cookies',
            '/politique-cookies' => 'cookies',
            '/cgv' => 'cgv',
            '/conditions-generales-de-vente' => 'cgv',
        ] as $path => $slug) {
            $app->get($path, $legal)->setArgument('slug', $slug);
        }

        $deletion = DeletionController::class;
        $app->get('/delete-me', $deletion . ':show');
        $app->post('/delete-me', $deletion . ':submit')
            ->add(new RateLimitMiddleware('delete-me', 5, 3600));
        $app->get('/delete-me/confirm', $deletion . ':confirm');

        $app->group('/api/v1', function (RouteCollectorProxy $group) {
            $group->group('', function (RouteCollectorProxy $authGroup) {
                $authGroup->post('/auth/register', AuthController::class . ':register');
                $authGroup->post('/auth/login', AuthController::class . ':login');
                $authGroup->post('/auth/refresh', AuthController::class . ':refresh');
                $authGroup->post('/auth/logout', AuthController::class . ':logout');
                $authGroup->get('/auth/verify-email', AuthController::class . ':verifyEmail');
                $authGroup->post('/auth/forgot-password', AuthController::class . ':forgotPassword');
                $authGroup->get('/auth/reset-password', AuthController::class . ':resetPasswordPage');
                $authGroup->post('/auth/reset-password', AuthController::class . ':resetPasswordSubmit');
                $authGroup->get('/users/me/verify-contact-email', UserController::class . ':verifyContactEmail');

                $authGroup->get('/auth/oauth/providers', OAuthController::class . ':providers');
                $authGroup->post('/auth/oauth/apple/native', OAuthController::class . ':nativeApple');
                $authGroup->get('/auth/oauth/{provider}/start', OAuthController::class . ':start');
                $authGroup->get('/auth/oauth/{provider}/callback', OAuthController::class . ':callback');
                $authGroup->post('/auth/oauth/{provider}/callback', OAuthController::class . ':callbackPost');
            })->add(new RateLimitMiddleware('auth', 30, 60));

            $group->post('/devices/register', DeviceController::class . ':register')
                ->add(new RateLimitMiddleware('devreg', 30, 60));

            $group->group('/updates', function (RouteCollectorProxy $otaGroup) {
                $otaGroup->get('/releases', OtaController::class . ':listReleases');
                $otaGroup->get('/devices/lookup', OtaController::class . ':lookupDevice');
                $otaGroup->post('/devices/notify', OtaController::class . ':notifyDevice');
                $otaGroup->post('/upload', OtaController::class . ':upload');
                $otaGroup->post('/releases/{id}/publish', OtaController::class . ':publish');
                $otaGroup->post('/releases/{id}/notify', OtaController::class . ':notify');
            })->add(OtaAdminMiddleware::class);

            $group->group('/usb-debug', function (RouteCollectorProxy $usbGroup) {
                $usbGroup->get('/releases', UsbDebugController::class . ':listReleases')
                    ->add(new RateLimitMiddleware('usb-debug-list', 60, 60));
                $usbGroup->get('/releases/{id}/chunk', UsbDebugController::class . ':firmwareChunk')
                    ->add(new RateLimitMiddleware('usb-debug-chunk', 8000, 3600));
            });

            $group->group('/admin', function (RouteCollectorProxy $adminGroup) {
                $adminGroup->get('/stats', AdminController::class . ':stats');
                $adminGroup->get('/devices', AdminController::class . ':devices');
                $adminGroup->get('/devices/{id}', AdminController::class . ':deviceDetail');
                $adminGroup->post('/devices/notify-batch', AdminController::class . ':notifyBatch');
                $adminGroup->post('/devices/command', AdminController::class . ':command');
            })->add(OtaAdminMiddleware::class);

            $group->group('', function (RouteCollectorProxy $deviceGroup) {
                $deviceGroup->get('/devices/poll', DeviceController::class . ':poll');
                $deviceGroup->get('/devices/commands/poll', DeviceController::class . ':pollCommands');
                $deviceGroup->get('/devices/firmware/check', OtaController::class . ':checkFirmware');
                $deviceGroup->post('/devices/heartbeat', DeviceController::class . ':heartbeat');
                $deviceGroup->post('/devices/deregister', DeviceController::class . ':deregister');
                $deviceGroup->post('/devices/messages/{id}/ack', DeviceController::class . ':ack');
                $deviceGroup->post('/devices/messages/{id}/opened', DeviceController::class . ':opened');
                $deviceGroup->post('/devices/messages/{id}/seen', DeviceController::class . ':seen');
                $deviceGroup->post('/devices/messages/{id}/nack', DeviceController::class . ':nack');
                $deviceGroup->post('/devices/commands/{id}/ack', DeviceController::class . ':ackCommand');
                $deviceGroup->post('/devices/commands/{id}/fail', DeviceController::class . ':failCommand');
            })->add(DeviceAuthMiddleware::class)->add(new RateLimitMiddleware('device', 240, 60));

            $group->group('', function (RouteCollectorProxy $authGroup) {
                $authGroup->post('/devices/claim', DeviceController::class . ':claim');
                $authGroup->get('/devices/me', DeviceController::class . ':me');
                $authGroup->patch('/devices/{id}', DeviceController::class . ':updateMe');
                $authGroup->delete('/devices/{id}/claim', DeviceController::class . ':unclaim');
                $authGroup->delete('/devices/{id}', DeviceController::class . ':delete');

                $authGroup->post('/pairings/code/generate', PairingController::class . ':generateCode');
                $authGroup->post('/pairings/code/accept', PairingController::class . ':acceptCode');
                $authGroup->patch('/pairings/{id}', PairingController::class . ':setAlias');
                $authGroup->delete('/pairings/{id}', PairingController::class . ':unlink');
                $authGroup->get('/pairings/me', PairingController::class . ':me');

                $authGroup->get('/users/me', UserController::class . ':me');
                $authGroup->patch('/users/me', UserController::class . ':updateMe');
                $authGroup->post('/users/me/migrate-email', UserController::class . ':migrateEmail');
                $authGroup->post('/users/me/set-password', UserController::class . ':setPassword');

                $authGroup->post('/messages', MessageController::class . ':send');
                $authGroup->get('/messages/sent', MessageController::class . ':sent');
                $authGroup->get('/messages/received', MessageController::class . ':received');
                $authGroup->get('/messages/sent/{id}/preview', MessageController::class . ':preview');
            })->add(JwtAuthMiddleware::class);
        });
    }

    private static function servePublicStatic(
        \Psr\Http\Message\ResponseInterface $response,
        string $filename,
        string $contentType
    ): \Psr\Http\Message\ResponseInterface {
        $path = dirname(__DIR__, 2) . '/public/' . $filename;
        if (!is_file($path)) {
            $response->getBody()->write('Not found');
            return $response->withStatus(404)->withHeader('Content-Type', 'text/plain; charset=utf-8');
        }
        $response->getBody()->write((string) file_get_contents($path));
        return $response->withHeader('Content-Type', $contentType);
    }
}
