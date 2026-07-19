<?php

declare(strict_types=1);

namespace Bac\Controllers;

use Bac\Services\AuthService;
use Bac\Support\JsonResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class AuthController
{
    public function __construct(private AuthService $auth)
    {
    }

    public function register(Request $request, Response $response): Response
    {
        $body = (array) $request->getParsedBody();
        try {
            $data = $this->auth->register(
                (string) ($body['email'] ?? ''),
                (string) ($body['password'] ?? ''),
                (string) ($body['first_name'] ?? '')
            );
            return JsonResponse::ok($response, ['ok' => true] + $data, 201);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 400);
        }
    }

    public function login(Request $request, Response $response): Response
    {
        $body = (array) $request->getParsedBody();
        try {
            $data = $this->auth->login((string) ($body['email'] ?? ''), (string) ($body['password'] ?? ''));
            return JsonResponse::ok($response, ['ok' => true] + $data);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 401);
        }
    }

    public function refresh(Request $request, Response $response): Response
    {
        $body = (array) $request->getParsedBody();
        try {
            $data = $this->auth->refresh((string) ($body['refresh_token'] ?? ''));
            return JsonResponse::ok($response, ['ok' => true] + $data);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($response, $e->getMessage(), 401);
        }
    }

    public function logout(Request $request, Response $response): Response
    {
        $body = (array) $request->getParsedBody();
        $this->auth->logout((string) ($body['refresh_token'] ?? ''));
        return JsonResponse::ok($response, ['ok' => true]);
    }

    public function forgotPassword(Request $request, Response $response): Response
    {
        $body = (array) $request->getParsedBody();
        $this->auth->requestPasswordReset((string) ($body['email'] ?? ''));
        return JsonResponse::ok($response, ['ok' => true]);
    }

    public function resetPasswordPage(Request $request, Response $response): Response
    {
        $token = (string) ($request->getQueryParams()['token'] ?? '');
        $response->getBody()->write($this->resetPasswordHtml($token, null));
        return $response->withHeader('Content-Type', 'text/html; charset=utf-8');
    }

    public function resetPasswordSubmit(Request $request, Response $response): Response
    {
        $body = (array) $request->getParsedBody();
        $token = (string) ($body['token'] ?? '');
        $password = (string) ($body['password'] ?? '');
        $confirm = (string) ($body['password_confirm'] ?? '');

        if ($token === '') {
            $response->getBody()->write($this->resetPasswordHtml($token, 'Lien invalide.'));
            return $response->withHeader('Content-Type', 'text/html; charset=utf-8')->withStatus(400);
        }
        if (strlen($password) < 8) {
            $response->getBody()->write($this->resetPasswordHtml($token, 'Le mot de passe doit contenir au moins 8 caractères.'));
            return $response->withHeader('Content-Type', 'text/html; charset=utf-8')->withStatus(400);
        }
        if ($password !== $confirm) {
            $response->getBody()->write($this->resetPasswordHtml($token, 'Les deux mots de passe ne correspondent pas.'));
            return $response->withHeader('Content-Type', 'text/html; charset=utf-8')->withStatus(400);
        }

        try {
            $ok = $this->auth->resetPassword($token, $password);
        } catch (\InvalidArgumentException $e) {
            $ok = false;
        }
        if (!$ok) {
            $response->getBody()->write($this->resetPasswordHtml($token, 'Lien invalide ou expiré. Refaites une demande depuis l\'application.'));
            return $response->withHeader('Content-Type', 'text/html; charset=utf-8')->withStatus(400);
        }

        $response->getBody()->write($this->resetSuccessHtml());
        return $response->withHeader('Content-Type', 'text/html; charset=utf-8');
    }

    private function resetPasswordHtml(string $token, ?string $error): string
    {
        $safeToken = htmlspecialchars($token, ENT_QUOTES);
        $errorHtml = $error
            ? '<p style="color:#ff8080;margin:0 0 16px">' . htmlspecialchars($error, ENT_QUOTES) . '</p>'
            : '';
        return <<<HTML
<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Boîte à cœur — Nouveau mot de passe</title>
<style>
body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#1A0C12;color:#FFF0F2;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
.card{background:#2E141C;border:1px solid #5A3848;border-radius:24px;padding:28px;max-width:380px;width:100%}
h1{font-size:22px;margin:0 0 8px}
p{color:#C9A8B0;font-size:14px}
label{display:block;font-size:13px;margin:16px 0 6px;color:#C9A8B0}
input{width:100%;box-sizing:border-box;background:#241018;border:1px solid #5A3848;border-radius:12px;padding:12px;color:#FFF0F2;font-size:15px}
button{width:100%;margin-top:20px;background:#FF6B8A;color:#2A0A12;border:none;border-radius:12px;padding:14px;font-size:16px;font-weight:600;cursor:pointer}
</style></head><body>
<form class="card" method="post" action="/api/v1/auth/reset-password">
<h1>Nouveau mot de passe</h1>
<p>Choisissez un nouveau mot de passe pour votre compte Boîte à cœur.</p>
{$errorHtml}
<input type="hidden" name="token" value="{$safeToken}">
<label>Nouveau mot de passe</label>
<input type="password" name="password" minlength="8" required>
<label>Confirmez le mot de passe</label>
<input type="password" name="password_confirm" minlength="8" required>
<button type="submit">Enregistrer</button>
</form></body></html>
HTML;
    }

    private function resetSuccessHtml(): string
    {
        return <<<HTML
<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Boîte à cœur</title>
<style>
body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#1A0C12;color:#FFF0F2;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;text-align:center}
.card{background:#2E141C;border:1px solid #5A3848;border-radius:24px;padding:28px;max-width:380px}
h1{font-size:22px;margin:0 0 8px}
p{color:#C9A8B0;font-size:14px}
</style></head><body>
<div class="card"><h1>Mot de passe mis à jour</h1>
<p>Votre mot de passe a bien été changé. Vous pouvez retourner dans l'application et vous connecter.</p></div>
</body></html>
HTML;
    }

    public function verifyEmail(Request $request, Response $response): Response
    {
        $params = $request->getQueryParams();
        $token = (string) ($params['token'] ?? '');
        if ($token === '' || !$this->auth->verifyEmail($token)) {
            $response->getBody()->write('<html><body><p>Lien invalide ou expiré.</p></body></html>');
            return $response->withHeader('Content-Type', 'text/html')->withStatus(400);
        }
        $response->getBody()->write('<html><body><p>E-mail confirmé. Vous pouvez retourner dans l\'application.</p></body></html>');
        return $response->withHeader('Content-Type', 'text/html');
    }
}
