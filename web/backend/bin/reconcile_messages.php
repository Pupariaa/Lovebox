<?php

declare(strict_types=1);

namespace Bac\Bin;

use Bac\Services\MessageService;
use DI\ContainerBuilder;
use Dotenv\Dotenv;

$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';

if (is_file($root . '/.env')) {
    Dotenv::createImmutable($root)->safeLoad();
}

$containerBuilder = new ContainerBuilder();
$containerBuilder->addDefinitions(require $root . '/config/container.php');
$container = $containerBuilder->build();

/** @var MessageService $messages */
$messages = $container->get(MessageService::class);
$requeued = $messages->reconcileStale();

$stamp = date('c');
fwrite(STDOUT, "[$stamp] reconcile_messages requeued=$requeued\n");
exit(0);
