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
    'ota' => [
        'storage_path' => (($otaStorage = trim((string) ($_ENV['OTA_STORAGE_PATH'] ?? ''))) !== '')
            ? $otaStorage
            : dirname(__DIR__) . '/updates',
        'public_url' => (($otaPublic = trim((string) ($_ENV['OTA_PUBLIC_URL'] ?? ''))) !== '')
            ? $otaPublic
            : ($_ENV['APP_URL'] ?? 'http://localhost'),
        'admin_key' => $_ENV['OTA_ADMIN_KEY'] ?? '',
    ],
    'oauth' => [
        'google_client_id' => $_ENV['OAUTH_GOOGLE_CLIENT_ID'] ?? '',
        'google_client_secret' => $_ENV['OAUTH_GOOGLE_CLIENT_SECRET'] ?? '',
        'apple_client_id' => $_ENV['OAUTH_APPLE_CLIENT_ID'] ?? '',
        'apple_client_secret' => $_ENV['OAUTH_APPLE_CLIENT_SECRET'] ?? '',
        'facebook_client_id' => $_ENV['OAUTH_FACEBOOK_CLIENT_ID'] ?? '',
        'facebook_client_secret' => $_ENV['OAUTH_FACEBOOK_CLIENT_SECRET'] ?? '',
        'instagram_client_id' => $_ENV['OAUTH_INSTAGRAM_CLIENT_ID'] ?? '',
        'instagram_client_secret' => $_ENV['OAUTH_INSTAGRAM_CLIENT_SECRET'] ?? '',
    ],
];
