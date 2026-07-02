<?php

declare(strict_types=1);

namespace Bac\Services;

final class EmailService
{
    private bool $enabled;
    private string $from;
    private string $appUrl;

    public function __construct()
    {
        $settings = require dirname(__DIR__, 2) . '/config/settings.php';
        $this->enabled = $settings['mail']['enabled'];
        $this->from = $settings['mail']['from'];
        $this->appUrl = $settings['app']['url'];
    }

    public function sendVerification(string $email, string $token): void
    {
        if (!$this->enabled) {
            return;
        }
        $link = rtrim($this->appUrl, '/') . '/api/v1/auth/verify-email?token=' . urlencode($token);
        $subject = 'Boite a Coeur - Confirm your email';
        $body = "Open this link to confirm your email:\n\n$link\n";
        @mail($email, $subject, $body, 'From: ' . $this->from);
    }
}
