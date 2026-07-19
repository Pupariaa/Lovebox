<?php

declare(strict_types=1);

$appEnv = strtolower(trim((string) ($_ENV['APP_ENV'] ?? 'production')));
$isLocalEnv = in_array($appEnv, ['local', 'dev', 'development', 'testing'], true);
$appUrl = $_ENV['APP_URL'] ?? 'http://localhost';

$jwtSecret = trim((string) ($_ENV['JWT_SECRET'] ?? ''));
if ($jwtSecret === '') {
    if (!$isLocalEnv) {
        throw new \RuntimeException('JWT_SECRET must be configured in non-local environments');
    }
    $devSecretFile = dirname(__DIR__) . '/var/dev_jwt_secret';
    if (is_file($devSecretFile)) {
        $jwtSecret = trim((string) @file_get_contents($devSecretFile));
    }
    if ($jwtSecret === '') {
        $jwtSecret = bin2hex(random_bytes(32));
        if (!is_dir(dirname($devSecretFile))) {
            @mkdir(dirname($devSecretFile), 0700, true);
        }
        @file_put_contents($devSecretFile, $jwtSecret, LOCK_EX);
    }
}

$parseList = static function (string $raw): array {
    return array_values(array_filter(array_map('trim', explode(',', $raw))));
};

$corsOrigins = $parseList((string) ($_ENV['CORS_ALLOWED_ORIGINS'] ?? ''));
if ($corsOrigins === []) {
    $corsOrigins = array_values(array_filter([rtrim($appUrl, '/')]));
}

return [
    'app' => [
        'url' => $appUrl,
        'env' => $appEnv,
        'is_local' => $isLocalEnv,
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
        'secret' => $jwtSecret,
        'issuer' => trim((string) ($_ENV['JWT_ISSUER'] ?? '')) !== ''
            ? trim((string) $_ENV['JWT_ISSUER'])
            : rtrim($appUrl, '/'),
        'audience' => trim((string) ($_ENV['JWT_AUDIENCE'] ?? '')) !== ''
            ? trim((string) $_ENV['JWT_AUDIENCE'])
            : 'boite-a-coeur-app',
        'access_ttl' => (int) ($_ENV['JWT_ACCESS_TTL'] ?? 900),
        'refresh_ttl' => (int) ($_ENV['JWT_REFRESH_TTL'] ?? 2592000),
    ],
    'cors' => [
        'allowed_origins' => $corsOrigins,
    ],
    'security' => [
        'trusted_proxies' => $parseList((string) ($_ENV['TRUSTED_PROXIES'] ?? '')),
    ],
    'mail' => [
        'from' => $_ENV['MAIL_FROM'] ?? 'noreply@localhost',
        'enabled' => filter_var($_ENV['MAIL_ENABLED'] ?? false, FILTER_VALIDATE_BOOLEAN),
    ],
    'auth' => [
        'require_email_verification' => filter_var($_ENV['REQUIRE_EMAIL_VERIFICATION'] ?? false, FILTER_VALIDATE_BOOLEAN),
    ],
    'invite_token_ttl' => (int) ($_ENV['INVITE_TOKEN_TTL'] ?? 604800),
    'long_poll_max_seconds' => max(1, min(30, (int) ($_ENV['LONG_POLL_MAX_SECONDS'] ?? 15))),
    'message_stale_seconds' => (int) ($_ENV['MESSAGE_STALE_SECONDS'] ?? 120),
    'ota' => [
        'storage_path' => (($otaStorage = trim((string) ($_ENV['OTA_STORAGE_PATH'] ?? ''))) !== '')
            ? $otaStorage
            : dirname(__DIR__) . '/updates',
        'public_url' => (($otaPublic = trim((string) ($_ENV['OTA_PUBLIC_URL'] ?? ''))) !== '')
            ? $otaPublic
            : ($_ENV['APP_URL'] ?? 'http://localhost'),
        'backup_urls' => array_values(array_filter([
            trim((string) ($_ENV['OTA_PUBLIC_URL_BACKUP_1'] ?? 'https://update.bac-tcy.com')),
            trim((string) ($_ENV['OTA_PUBLIC_URL_BACKUP_2'] ?? 'https://update.tcy-services.com')),
        ])),
        'admin_key' => $_ENV['OTA_ADMIN_KEY'] ?? '',
    ],
    'admin' => [
        'api_key' => trim((string) ($_ENV['ADMIN_API_KEY'] ?? '')),
    ],
    'usb_debug' => [
        'token_secret' => trim((string) ($_ENV['USB_DEBUG_TOKEN_SECRET'] ?? '')) !== ''
            ? trim((string) $_ENV['USB_DEBUG_TOKEN_SECRET'])
            : $jwtSecret,
        'token_ttl' => max(60, (int) ($_ENV['USB_DEBUG_TOKEN_TTL'] ?? 7200)),
    ],
    'oauth' => [
        'google_client_id' => $_ENV['OAUTH_GOOGLE_CLIENT_ID'] ?? '',
        'google_client_secret' => $_ENV['OAUTH_GOOGLE_CLIENT_SECRET'] ?? '',
        'apple_client_id' => $_ENV['OAUTH_APPLE_CLIENT_ID'] ?? '',
        'apple_native_client_id' => $_ENV['OAUTH_APPLE_NATIVE_CLIENT_ID'] ?? '',
        'apple_team_id' => $_ENV['OAUTH_APPLE_TEAM_ID'] ?? '',
        'apple_key_id' => $_ENV['OAUTH_APPLE_KEY_ID'] ?? '',
        'apple_private_key' => $_ENV['OAUTH_APPLE_PRIVATE_KEY'] ?? '',
        'apple_private_key_path' => $_ENV['OAUTH_APPLE_PRIVATE_KEY_PATH'] ?? '',
        'facebook_client_id' => $_ENV['OAUTH_FACEBOOK_CLIENT_ID'] ?? '',
        'facebook_client_secret' => $_ENV['OAUTH_FACEBOOK_CLIENT_SECRET'] ?? '',
        'instagram_client_id' => $_ENV['OAUTH_INSTAGRAM_CLIENT_ID'] ?? '',
        'instagram_client_secret' => $_ENV['OAUTH_INSTAGRAM_CLIENT_SECRET'] ?? '',
    ],
];
