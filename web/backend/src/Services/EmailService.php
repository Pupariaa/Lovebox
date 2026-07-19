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
        $subject = 'Boîte à cœur — Confirmez votre e-mail';
        $body = "Bonjour,\n\nPour confirmer votre adresse e-mail, ouvrez ce lien :\n\n$link\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.\n";
        @mail($email, $subject, $body, 'From: ' . $this->from);
    }

    public function sendPasswordReset(string $email, string $token): void
    {
        if (!$this->enabled) {
            return;
        }
        $link = rtrim($this->appUrl, '/') . '/api/v1/auth/reset-password?token=' . urlencode($token);
        $subject = 'Boîte à cœur — Réinitialisation du mot de passe';
        $body = "Bonjour,\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n\n$link\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.\n";
        @mail($email, $subject, $body, 'From: ' . $this->from);
    }

    public function sendContactEmailVerification(string $email, string $token): void
    {
        if (!$this->enabled) {
            return;
        }
        $link = rtrim($this->appUrl, '/') . '/api/v1/users/me/verify-contact-email?token=' . urlencode($token);
        $subject = 'Boîte à cœur — Confirmer votre e-mail de contact';
        $body = "Bonjour,\n\nPour confirmer votre e-mail de contact et activer la connexion par mot de passe, ouvrez ce lien :\n\n$link\n";
        @mail($email, $subject, $body, 'From: ' . $this->from);
    }

    public function sendDataRightsConfirm(string $email, string $token, string $action): void
    {
        if (!$this->enabled) {
            return;
        }
        $link = rtrim($this->appUrl, '/') . '/delete-me/confirm?token=' . urlencode($token);
        [$subject, $intro] = match ($action) {
            'data_export' => [
                'Boîte à cœur — Téléchargement de vos données',
                'Vous avez demandé à télécharger une copie de vos données personnelles.',
            ],
            'data_delete' => [
                'Boîte à cœur — Suppression de vos données',
                'Vous avez demandé la suppression de vos données personnelles sans supprimer votre compte.',
            ],
            default => [
                'Boîte à cœur — Confirmation de suppression de compte',
                'Vous avez demandé la suppression de votre compte et de vos données personnelles.',
            ],
        };
        $body = "Bonjour,\n\n$intro\n\n"
            . "Pour confirmer cette demande (lien valable 24 heures), ouvrez :\n\n$link\n\n"
            . "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.\n\n"
            . "Conformément au RGPD, nous traitons votre demande dans un délai maximal d'un mois.\n";
        @mail($email, $subject, $body, 'From: ' . $this->from);
    }
}
