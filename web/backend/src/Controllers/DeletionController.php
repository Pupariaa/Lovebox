<?php

declare(strict_types=1);

namespace Bac\Controllers;

use Bac\Legal\DeletionRenderer;
use Bac\Services\UserDataAction;
use Bac\Services\UserDataRightsService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class DeletionController
{
    public function __construct(private UserDataRightsService $rights)
    {
    }

    public function show(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $response->getBody()->write(DeletionRenderer::form());
        return $response->withHeader('Content-Type', 'text/html; charset=utf-8');
    }

    public function submit(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $body = (array) $request->getParsedBody();
        if (!empty($body['website'])) {
            $response->getBody()->write(DeletionRenderer::requested());
            return $response->withHeader('Content-Type', 'text/html; charset=utf-8');
        }

        $email = trim((string) ($body['email'] ?? ''));
        $action = trim((string) ($body['action'] ?? UserDataAction::ACCOUNT_DELETE));
        $confirmed = ($body['confirm'] ?? '') === '1';

        if (!$confirmed) {
            $response->getBody()->write(DeletionRenderer::form($action, 'Veuillez confirmer votre demande.'));
            return $response->withStatus(400)->withHeader('Content-Type', 'text/html; charset=utf-8');
        }

        if (!UserDataAction::isValid($action)) {
            $response->getBody()->write(DeletionRenderer::form(null, 'Action invalide.'));
            return $response->withStatus(400)->withHeader('Content-Type', 'text/html; charset=utf-8');
        }

        try {
            $this->rights->requestByEmail($email, $action);
        } catch (\InvalidArgumentException) {
            $response->getBody()->write(DeletionRenderer::form($action, 'Adresse e-mail invalide.'));
            return $response->withStatus(400)->withHeader('Content-Type', 'text/html; charset=utf-8');
        }

        $response->getBody()->write(DeletionRenderer::requested($action));
        return $response->withHeader('Content-Type', 'text/html; charset=utf-8');
    }

    public function confirm(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $token = (string) ($request->getQueryParams()['token'] ?? '');
        try {
            $result = $this->rights->confirmToken($token);
            $action = (string) $result['action'];

            if ($action === UserDataAction::DATA_EXPORT && isset($result['export'])) {
                $json = json_encode(
                    $result['export'],
                    JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
                );
                $filename = 'boite-a-coeur-export-' . gmdate('Ymd') . '.json';
                $response->getBody()->write($json);
                return $response
                    ->withHeader('Content-Type', 'application/json; charset=utf-8')
                    ->withHeader('Content-Disposition', 'attachment; filename="' . $filename . '"');
            }

            $response->getBody()->write(DeletionRenderer::confirmed($action));
            return $response->withHeader('Content-Type', 'text/html; charset=utf-8');
        } catch (\InvalidArgumentException) {
            $response->getBody()->write(DeletionRenderer::confirmError(
                'Ce lien est invalide ou a expiré. Vous pouvez faire une nouvelle demande.'
            ));
            return $response->withStatus(400)->withHeader('Content-Type', 'text/html; charset=utf-8');
        } catch (\JsonException) {
            $response->getBody()->write(DeletionRenderer::confirmError(
                'Impossible de générer l\'export. Contactez le support.'
            ));
            return $response->withStatus(500)->withHeader('Content-Type', 'text/html; charset=utf-8');
        }
    }
}
