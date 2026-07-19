<?php

declare(strict_types=1);

namespace Bac\Middleware;

final class OtaAdminMiddleware extends ApiKeyMiddleware
{
    public function __construct(array $settings)
    {
        parent::__construct(
            (string) ($settings['ota']['admin_key'] ?? ''),
            'X-Ota-Admin-Key',
            'ota admin not configured'
        );
    }
}
