<?php

declare(strict_types=1);

namespace Bac\Controllers;

use Bac\Repositories\PairingRepository;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class InviteController
{
    public function __construct(private PairingRepository $pairings)
    {
    }

    public function page(Request $request, Response $response, array $args): Response
    {
        $token = (string) ($args['token'] ?? '');
        $invite = $this->pairings->findInvite($token);
        $deepLink = 'boiteacoeur://invite/' . htmlspecialchars($token, ENT_QUOTES);
        $valid = $invite !== null;
        $html = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            . '<title>Boîte à cœur</title><style>body{font-family:system-ui,sans-serif;max-width:480px;margin:40px auto;padding:0 16px}'
            . 'a.btn{display:inline-block;padding:12px 20px;background:#c45c5c;color:#fff;text-decoration:none;border-radius:8px}</style></head><body>';
        if ($valid) {
            $html .= '<h1>Invitation Boîte à cœur</h1><p>Ouvrez l\'application pour lier votre compte.</p>'
                . '<p><a class="btn" href="' . $deepLink . '">Ouvrir l\'application</a></p>';
        } else {
            $html .= '<h1>Invitation invalide</h1><p>Ce lien a expiré ou a déjà été utilisé.</p>';
        }
        $html .= '</body></html>';
        $response->getBody()->write($html);
        return $response->withHeader('Content-Type', 'text/html; charset=utf-8');
    }
}
