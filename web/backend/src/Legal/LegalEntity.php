<?php

declare(strict_types=1);

namespace Bac\Legal;

final class LegalEntity
{
    /** @var array<string, mixed> */
    private static array $cfg = [];

    /** @return array<string, mixed> */
    public static function cfg(): array
    {
        if (self::$cfg === []) {
            self::$cfg = require dirname(__DIR__, 2) . '/config/legal.php';
        }
        return self::$cfg;
    }

    public static function mailto(): string
    {
        return 'mailto:' . self::cfg()['email'];
    }

    public static function editorBlock(): string
    {
        $c = self::cfg();
        return '<p><strong>' . htmlspecialchars($c['publisher_name']) . '</strong> ('
            . htmlspecialchars($c['publisher_form_fr']) . ')<br>'
            . htmlspecialchars($c['address']) . '<br>'
            . 'SIRET ' . htmlspecialchars($c['siret']) . '<br>'
            . htmlspecialchars($c['rcs']) . '<br>'
            . 'TVA intracommunautaire : ' . htmlspecialchars($c['vat']) . '<br>'
            . 'Téléphone : ' . htmlspecialchars($c['phone']) . '<br>'
            . 'E-mail : <a href="' . self::mailto() . '">'
            . htmlspecialchars($c['email']) . '</a></p>';
    }

    public static function hostBlock(): string
    {
        $c = self::cfg();
        return '<p><strong>' . htmlspecialchars($c['host_name']) . '</strong><br>'
            . htmlspecialchars($c['host_address']) . '<br>'
            . htmlspecialchars($c['host_rcs']) . ' — SIRET '
            . htmlspecialchars($c['host_siret']) . '<br>'
            . 'Téléphone : ' . htmlspecialchars($c['host_phone']) . '</p>';
    }
}
