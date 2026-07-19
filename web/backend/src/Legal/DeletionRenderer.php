<?php

declare(strict_types=1);

namespace Bac\Legal;

use Bac\Services\UserDataAction;

final class DeletionRenderer
{
    public static function form(?string $selectedAction = null, ?string $error = null): string
    {
        $c = LegalEntity::cfg();
        $email = htmlspecialchars($c['email'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $selectedAction = $selectedAction && UserDataAction::isValid($selectedAction)
            ? $selectedAction
            : UserDataAction::DATA_EXPORT;
        $errorHtml = $error
            ? '<p class="error">' . htmlspecialchars($error, ENT_QUOTES | ENT_HTML5, 'UTF-8') . '</p>'
            : '';

        $radios = '';
        foreach ([
            UserDataAction::DATA_EXPORT => [
                'Télécharger mes données',
                'Recevez une copie structurée (JSON) de vos données : compte, boîtes, contacts, messages envoyés et reçus.',
            ],
            UserDataAction::DATA_DELETE => [
                'Supprimer mes données (conserver le compte)',
                'Efface vos messages, alias de contacts, prénom et sessions actives. Votre compte et vos boîtes restent actifs.',
            ],
            UserDataAction::ACCOUNT_DELETE => [
                'Supprimer mon compte et mes données',
                'Supprime définitivement votre compte, dissocie vos boîtes et efface les données personnelles associées.',
            ],
        ] as $value => [$label, $hint]) {
            $checked = $selectedAction === $value ? ' checked' : '';
            $radios .= '<label class="radio">'
                . '<input type="radio" name="action" value="' . htmlspecialchars($value, ENT_QUOTES | ENT_HTML5, 'UTF-8') . '"' . $checked . ' required>'
                . '<span><strong>' . htmlspecialchars($label, ENT_QUOTES | ENT_HTML5, 'UTF-8') . '</strong>'
                . '<small>' . htmlspecialchars($hint, ENT_QUOTES | ENT_HTML5, 'UTF-8') . '</small></span>'
                . '</label>';
        }

        return self::shell(
            'Vos données personnelles',
            '<h1>Vos données personnelles</h1>'
            . '<p class="meta">Droits RGPD · Boîte à Cœur</p>'
            . $errorHtml
            . '<p>Conformément au Règlement général sur la protection des données (RGPD), vous pouvez exercer vos droits d\'accès, de portabilité et d\'effacement via cette page.</p>'
            . '<section><h2>Choisissez une action</h2>'
            . '<form method="post" action="/delete-me">'
            . '<fieldset class="actions">' . $radios . '</fieldset>'
            . '<label for="email">Adresse e-mail du compte</label>'
            . '<input id="email" name="email" type="email" required autocomplete="email" maxlength="255">'
            . '<label class="check"><input type="checkbox" name="confirm" value="1" required> '
            . 'Je confirme cette demande et comprends ses conséquences.</label>'
            . '<input type="text" name="website" value="" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">'
            . '<button type="submit">Envoyer la demande</button>'
            . '</form></section>'
            . '<section><h2>Procédure</h2>'
            . '<p>Saisissez l\'adresse e-mail de votre compte. Si un compte existe, vous recevrez un e-mail de confirmation valable 24 heures. L\'action n\'est effective qu\'après validation du lien.</p>'
            . '<p>Pour des raisons de sécurité, nous affichons le même message que l\'adresse existe ou non dans notre base.</p></section>'
            . '<section><h2>Délai de traitement</h2>'
            . '<p>Nous répondons aux demandes dans un délai maximal d\'un mois conformément à l\'article 12 du RGPD. Vous pouvez également nous écrire à '
            . '<a href="mailto:' . $email . '">' . $email . '</a>.</p></section>'
            . '<p class="links">Voir aussi : <a href="/privacy">Politique de confidentialité</a> · <a href="/legal">Mentions légales</a></p>'
        );
    }

    public static function requested(string $action = UserDataAction::ACCOUNT_DELETE): string
    {
        $detail = match ($action) {
            UserDataAction::DATA_EXPORT => 'Si un compte est associé à cette adresse, un lien de confirmation vous permettra de télécharger vos données au format JSON.',
            UserDataAction::DATA_DELETE => 'Si un compte est associé à cette adresse, un lien de confirmation déclenchera la suppression de vos données personnelles (votre compte sera conservé).',
            default => 'Si un compte est associé à cette adresse, un lien de confirmation déclenchera la suppression de votre compte et de vos données.',
        };

        return self::shell(
            'Demande enregistrée — Boîte à Cœur',
            '<h1>Demande enregistrée</h1>'
            . '<p class="notice">Un message de confirmation vient peut-être de vous être envoyé. ' . htmlspecialchars($detail, ENT_QUOTES | ENT_HTML5, 'UTF-8') . '</p>'
            . '<p>Le lien est valable 24 heures. Si vous ne recevez pas d\'e-mail, vérifiez vos courriers indésirables ou contactez '
            . '<a href="mailto:' . htmlspecialchars(LegalEntity::cfg()['email']) . '">'
            . htmlspecialchars(LegalEntity::cfg()['email']) . '</a>.</p>'
            . '<p class="links"><a href="/delete-me">Nouvelle demande</a> · <a href="/privacy">Politique de confidentialité</a></p>'
        );
    }

    public static function confirmed(string $action): string
    {
        [$title, $body] = match ($action) {
            UserDataAction::DATA_DELETE => [
                'Données supprimées — Boîte à Cœur',
                '<h1>Données supprimées</h1>'
                . '<p class="notice">Votre demande a été confirmée. Vos données personnelles (messages, alias, prénom, sessions) ont été effacées.</p>'
                . '<p>Votre compte et vos boîtes restent actifs. Vous pouvez vous reconnecter à l\'application.</p>',
            ],
            default => [
                'Compte supprimé — Boîte à Cœur',
                '<h1>Compte supprimé</h1>'
                . '<p class="notice">Votre demande a été confirmée. Votre compte et les données personnelles associées ont été supprimés.</p>'
                . '<p>Les boîtes que vous possédiez ont été dissociées. Vous pouvez les reconfigurer ultérieurement si vous le souhaitez.</p>',
            ],
        };

        return self::shell(
            $title,
            $body . '<p class="links"><a href="https://' . htmlspecialchars(LegalEntity::cfg()['site']) . '">Retour au site</a></p>'
        );
    }

    public static function confirmError(string $message): string
    {
        return self::shell(
            'Confirmation impossible — Boîte à Cœur',
            '<h1>Confirmation impossible</h1>'
            . '<p class="error">' . htmlspecialchars($message, ENT_QUOTES | ENT_HTML5, 'UTF-8') . '</p>'
            . '<p class="links"><a href="/delete-me">Faire une nouvelle demande</a></p>'
        );
    }

    private static function shell(string $title, string $body): string
    {
        $titleEsc = htmlspecialchars($title, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        return <<<HTML
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{$titleEsc}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #1a0c12;
      --text: #f5e8ec;
      --muted: #b8a0a8;
      --accent: #e85d7a;
      --line: #4a2834;
      --ok: #7dcea0;
      --err: #ff8a8a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font: 16px/1.65 "Segoe UI", system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    main {
      max-width: 760px;
      margin: 0 auto;
      padding: 32px 20px 64px;
    }
    h1 { font-size: 1.85rem; line-height: 1.2; margin: 0 0 8px; }
    .meta { color: var(--muted); font-size: 0.9rem; margin-bottom: 24px; }
    h2 { font-size: 1.1rem; margin: 24px 0 10px; color: var(--accent); }
    p, li { margin: 0 0 10px; }
    ul { padding-left: 1.2rem; margin: 0 0 12px; }
    a { color: var(--accent); }
    .notice {
      background: #1e3a2f;
      border: 1px solid #2d5a45;
      color: var(--ok);
      padding: 12px 14px;
      border-radius: 10px;
      margin: 16px 0;
    }
    .error {
      background: #3a1e24;
      border: 1px solid #5a2d36;
      color: var(--err);
      padding: 12px 14px;
      border-radius: 10px;
      margin: 16px 0;
    }
    form {
      display: grid;
      gap: 12px;
      margin-top: 16px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #2e141c;
    }
    fieldset.actions {
      border: 0;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 10px;
    }
    label { font-size: 0.95rem; }
    label.check { display: flex; gap: 10px; align-items: flex-start; }
    label.radio {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      cursor: pointer;
    }
    label.radio:has(input:checked) {
      border-color: var(--accent);
      background: #3a1a24;
    }
    label.radio input { margin-top: 4px; }
    label.radio span { display: grid; gap: 4px; }
    label.radio small { color: var(--muted); font-size: 0.88rem; line-height: 1.45; }
    input[type="email"] {
      width: 100%;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid var(--line);
      background: var(--bg);
      color: var(--text);
      font: inherit;
    }
    button {
      justify-self: start;
      padding: 10px 18px;
      border: 0;
      border-radius: 8px;
      background: var(--accent);
      color: #fff;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    .hp { display: none !important; }
    .links { margin-top: 28px; color: var(--muted); font-size: 0.92rem; }
  </style>
</head>
<body>
  <main>{$body}</main>
</body>
</html>
HTML;
    }
}
