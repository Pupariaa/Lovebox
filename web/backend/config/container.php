<?php

declare(strict_types=1);

use Bac\Middleware\DeviceAuthMiddleware;
use Bac\Middleware\JwtAuthMiddleware;
use Bac\Middleware\OtaAdminMiddleware;
use Bac\Repositories\DeviceCommandRepository;
use Bac\Repositories\DeviceRepository;
use Bac\Repositories\FirmwareReleaseRepository;
use Bac\Repositories\MessageRepository;
use Bac\Repositories\PairingRepository;
use Bac\Repositories\UserRepository;
use Bac\Services\AppleClientSecret;
use Bac\Services\AuthService;
use Bac\Services\BacmValidator;
use Bac\Services\DeviceService;
use Bac\Services\EmailService;
use Bac\Services\JwtService;
use Bac\Services\MessageService;
use Bac\Services\OtaService;
use Bac\Services\PairingService;
use Psr\Container\ContainerInterface;
use function DI\autowire;
use function DI\create;
use function DI\get;

return [
    'settings' => require __DIR__ . '/settings.php',

    \PDO::class => function (ContainerInterface $c): \PDO {
        $s = $c->get('settings')['db'];
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            $s['host'],
            $s['port'],
            $s['name']
        );
        $pdo = new \PDO($dsn, $s['user'], $s['password'], [
            \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
            \PDO::MYSQL_ATTR_INIT_COMMAND => 'SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci',
        ]);
        return $pdo;
    },

    JwtService::class => autowire(),
    AuthService::class => autowire(),
    DeviceService::class => autowire(),
    PairingService::class => autowire(),
    MessageService::class => autowire(),
    OtaService::class => function (ContainerInterface $c): OtaService {
        return new OtaService(
            $c->get(FirmwareReleaseRepository::class),
            $c->get(DeviceRepository::class),
            $c->get(DeviceCommandRepository::class),
            $c->get('settings')
        );
    },
    EmailService::class => autowire(),
    UserDataRightsService::class => autowire(),
    BacmValidator::class => autowire(),
    UserRepository::class => autowire(),
    DeviceRepository::class => autowire(),
    DeletionRequestRepository::class => autowire(),
    DeviceCommandRepository::class => autowire(),
    FirmwareReleaseRepository::class => autowire(),
    PairingRepository::class => autowire(),
    MessageRepository::class => autowire(),
    AppleClientSecret::class => autowire(),
    OAuthService::class => autowire(),
    JwtAuthMiddleware::class => autowire(),
    DeviceAuthMiddleware::class => autowire(),
    OtaAdminMiddleware::class => function (ContainerInterface $c): OtaAdminMiddleware {
        return new OtaAdminMiddleware($c->get('settings'));
    },
];
