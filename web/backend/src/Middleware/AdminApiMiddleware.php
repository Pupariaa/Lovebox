<?php

declare(strict_types=1);

namespace Bac\Middleware;

final class AdminApiMiddleware extends ApiKeyMiddleware
{
    public function __construct(array $settings)
    {
        parent::__construct(
            (string) ($settings['admin']['api_key'] ?? ''),
            'X-Admin-Key',
            'admin api not configured'
        );
    }
}
