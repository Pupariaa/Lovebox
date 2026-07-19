<?php

declare(strict_types=1);

namespace Bac\Legal;

final class LegalRenderer
{
    public static function render(string $slug): string
    {
        $body = LegalPages::body($slug);
        if ($body === null) {
            return self::notFound();
        }

        $title = htmlspecialchars($body['title'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $h1 = htmlspecialchars($body['h1'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $updated = htmlspecialchars(LegalEntity::cfg()['updated'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $email = htmlspecialchars(LegalEntity::cfg()['email'], ENT_QUOTES | ENT_HTML5, 'UTF-8');

        $sections = '';
        foreach ($body['sections'] as $sec) {
            $h2 = htmlspecialchars($sec['h2'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $sections .= '<section><h2>' . $h2 . '</h2>' . $sec['html'] . '</section>';
        }

        $nav = self::nav($slug);

        return <<<HTML
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{$title}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #1a0c12;
      --text: #f5e8ec;
      --muted: #b8a0a8;
      --accent: #e85d7a;
      --line: #4a2834;
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
    nav {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 18px;
      margin-bottom: 28px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--line);
      font-size: 0.9rem;
    }
    nav a { color: var(--muted); text-decoration: none; }
    nav a.active { color: var(--accent); }
    h1 { font-size: 1.85rem; line-height: 1.2; margin: 0 0 8px; }
    .meta { color: var(--muted); font-size: 0.9rem; margin-bottom: 28px; }
    h2 { font-size: 1.12rem; margin: 28px 0 10px; color: var(--accent); }
    p, li { margin: 0 0 10px; }
    ul { padding-left: 1.2rem; margin: 0 0 12px; }
    a { color: var(--accent); }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0 16px;
      font-size: 0.92rem;
    }
    th, td {
      border: 1px solid var(--line);
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }
    th { background: #2e141c; }
    footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <main>
    {$nav}
    <h1>{$h1}</h1>
    <p class="meta">Boîte à Cœur · Dernière mise à jour : {$updated}</p>
    {$sections}
    <footer>
      <p>Techalchemy · Boîte à Cœur · <a href="mailto:{$email}">{$email}</a></p>
    </footer>
  </main>
</body>
</html>
HTML;
    }

    private static function nav(string $active): string
    {
        $items = [
            'legal' => ['/legal', 'Mentions légales'],
            'terms' => ['/terms', 'CGU'],
            'cgv' => ['/cgv', 'CGV'],
            'privacy' => ['/privacy', 'Confidentialité'],
            'cookies' => ['/cookies', 'Cookies'],
        ];
    $out = '<nav><a href="/">Accueil</a>';
    foreach ($items as $slug => [$href, $label]) {
      $cls = $slug === $active ? ' class="active"' : '';
      $out .= '<a href="' . $href . '"' . $cls . '>' . htmlspecialchars($label) . '</a>';
    }
    $out .= '<a href="/delete-me">Vos données (RGPD)</a>';
    $out .= '</nav>';
        return $out;
    }

    private static function notFound(): string
    {
        return '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>404</title></head>'
            . '<body><p>Page introuvable.</p></body></html>';
    }
}
