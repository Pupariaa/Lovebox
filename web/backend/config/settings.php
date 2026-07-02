<?php

declare(strict_types=1);

return [
    'app' => [
        'url' => $_ENV['APP_URL'] ?? 'http://localhost',
        'debug' => filter_var($_ENV['APP_DEBUG'] ?? false, FILTER_VALIDATE_BOOLEAN),
    ],
    'db' => [
        'host' => $_ENV['DB_HOST'] ?? 'localhost',
        'port' => $_ENV['DB_PORT'] ?? '3306',
        'name' => $_ENV['DB_NAME'] ?? 'techalch_bac_prod',
        'user' => $_ENV['DB_USER'] ?? 'backend',
        'password' => $_ENV['DB_PASSWORD'] ?? '',
    ],
    'jwt' => [
        'secret' => $_ENV['JWT_SECRET'] ?? 'dev-secret-change-me',
        'access_ttl' => (int) ($_ENV['JWT_ACCESS_TTL'] ?? 900),
        'refresh_ttl' => (int) ($_ENV['JWT_REFRESH_TTL'] ?? 2592000),
    ],
    'mail' => [
        'from' => $_ENV['MAIL_FROM'] ?? 'noreply@localhost',
        'enabled' => filter_var($_ENV['MAIL_ENABLED'] ?? false, FILTER_VALIDATE_BOOLEAN),
    ],
    'invite_token_ttl' => (int) ($_ENV['INVITE_TOKEN_TTL'] ?? 604800),
    'long_poll_max_seconds' => (int) ($_ENV['LONG_POLL_MAX_SECONDS'] ?? 25),
];
