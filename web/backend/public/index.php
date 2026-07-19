<?php

declare(strict_types=1);

namespace Bac;

use Bac\Middleware\CorsMiddleware;
use Bac\Middleware\DeviceAuthMiddleware;
use Bac\Middleware\JwtAuthMiddleware;
use Bac\Routes\ApiRoutes;
use DI\ContainerBuilder;
use Dotenv\Dotenv;
use Slim\Factory\AppFactory;

require dirname(__DIR__) . '/vendor/autoload.php';

if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) && !isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $_SERVER['HTTP_AUTHORIZATION'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
}

$root = dirname(__DIR__);
if (is_file($root . '/.env')) {
    Dotenv::createImmutable($root)->safeLoad();
}

$containerBuilder = new ContainerBuilder();
$containerBuilder->addDefinitions(require $root . '/config/container.php');
$container = $containerBuilder->build();

$settings = $container->get('settings');

AppFactory::setContainer($container);
$app = AppFactory::create();
$app->setBasePath('');
$app->addBodyParsingMiddleware();
$app->addRoutingMiddleware();
$app->add(new CorsMiddleware($settings['cors']['allowed_origins'] ?? []));

$appDebug = filter_var($_ENV['APP_DEBUG'] ?? false, FILTER_VALIDATE_BOOLEAN);
$displayErrorDetails = $appDebug && ($settings['app']['is_local'] ?? false);
$app->addErrorMiddleware($displayErrorDetails, true, true);

ApiRoutes::register($app);

$app->run();
