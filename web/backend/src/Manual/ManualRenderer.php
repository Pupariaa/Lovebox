<?php

declare(strict_types=1);

namespace Bac\Manual;

use Bac\Legal\LegalEntity;

final class ManualRenderer
{
    public static function page(): string
    {
        $c = LegalEntity::cfg();
        $site = htmlspecialchars($c['site'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $email = htmlspecialchars($c['email'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $product = htmlspecialchars($c['product'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $year = date('Y');

        $toc = self::toc();
        $body = self::sectionsHtml();
        $legal = self::legalHtml($email);

        return <<<HTML
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Manuel d'utilisation — {$product}</title>
  <meta name="description" content="Guide complet pour installer, configurer et utiliser la Boîte à Cœur TCY BAC XS3.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://{$site}/manual">
  <link rel="icon" href="/public/marketing/img/logo.png" type="image/png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/public/manual/css/manual.css">
</head>
<body class="manual grain">
  <a class="skip-link" href="#contenu">Aller au contenu</a>

  <header class="manual-header">
    <div class="manual-header-inner">
      <a class="brand" href="/">
        <img src="/public/marketing/img/logo.png" width="36" height="36" alt="">
        <span>Boîte à Cœur</span>
      </a>
      <div class="manual-header-actions">
        <a class="btn btn-ghost" href="/">Accueil</a>
        <button class="btn btn-primary" type="button" id="print-btn">Télécharger en PDF</button>
      </div>
    </div>
  </header>

  <div class="manual-shell">
    <aside class="manual-toc" aria-label="Sommaire">
      <p class="toc-label">Sommaire</p>
      <nav>{$toc}</nav>
    </aside>

    <main id="contenu" class="manual-main">
      <section class="manual-cover" id="couverture">
        <div class="manual-cover-copy">
          <p class="eyebrow">TCY BAC XS3</p>
          <h1>Manuel d'utilisation</h1>
          <p class="manual-lead">Installation, connexion Wi-Fi, association de ton duo, messages et réglages — étape par étape.</p>
          <p class="manual-meta">Techalchemy · {$product}</p>
        </div>
        <figure class="manual-cover-visual">
          <img src="/public/manual/img/cov-fr.png" width="640" height="800" alt="Boîte à Cœur">
        </figure>
      </section>

      {$body}

      <section class="manual-legal" id="legal">
        {$legal}
      </section>

      <footer class="manual-footer">
        <p>© {$year} Techalchemy — {$product} · <a href="mailto:{$email}">{$email}</a> · <a href="https://{$site}/">{$site}</a></p>
      </footer>
    </main>
  </div>

  <script src="/public/manual/js/manual.js" defer></script>
</body>
</html>
HTML;
    }

    private static function toc(): string
    {
        $out = '<a href="#couverture">Couverture</a>';
        foreach (ManualContent::sections() as $section) {
            $id = htmlspecialchars($section['id'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $title = htmlspecialchars($section['title'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $out .= '<a href="#' . $id . '">' . $title . '</a>';
        }
        $out .= '<a href="#legal">Informations légales</a>';
        return $out;
    }

    private static function sectionsHtml(): string
    {
        $html = '';
        foreach (ManualContent::sections() as $section) {
            $id = htmlspecialchars($section['id'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $title = htmlspecialchars($section['title'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $steps = '';
            foreach ($section['steps'] as $step) {
                $steps .= self::stepHtml($step);
            }
            $html .= <<<HTML
<section class="manual-section" id="{$id}">
  <header class="section-head">
    <h2>{$title}</h2>
  </header>
  <div class="step-grid">
    {$steps}
  </div>
</section>
HTML;
        }
        return $html;
    }

    /** @param array<string, mixed> $step */
    private static function stepHtml(array $step): string
    {
        $n = htmlspecialchars((string) ($step['n'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $title = htmlspecialchars($step['title'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $layout = $step['layout'];
        $badge = $n !== '' ? '<span class="step-badge">' . $n . '</span>' : '<span class="step-badge step-badge--heart">♡</span>';
        $legend = self::legendHtml($step['legend'] ?? []);
        $body = match ($layout) {
            'list' => self::listBody($step),
            'qr' => self::qrBody($step),
            'text-only' => self::textOnlyBody($step),
            'icon-side' => self::shotBody($step, 'icon-side'),
            'app-side' => self::shotBody($step, 'app-side'),
            default => self::shotBody($step, 'device-stack'),
        };

        return <<<HTML
<article class="step-card step-card--{$layout}">
  <header class="step-head">
    {$badge}
    <h3>{$title}</h3>
  </header>
  <div class="step-body">
    {$body}
    {$legend}
  </div>
</article>
HTML;
    }

    /** @param array<string, mixed> $step */
    private static function listBody(array $step): string
    {
        $items = '';
        foreach ($step['items'] as $item) {
            $items .= '<li>' . htmlspecialchars($item, ENT_QUOTES | ENT_HTML5, 'UTF-8') . '</li>';
        }
        $note = '';
        if (!empty($step['note'])) {
            $note = '<p class="step-note">' . htmlspecialchars($step['note'], ENT_QUOTES | ENT_HTML5, 'UTF-8') . '</p>';
        }
        return '<ul class="step-list">' . $items . '</ul>' . $note;
    }

    /** @param array<string, mixed> $step */
    private static function qrBody(array $step): string
    {
        $img = htmlspecialchars($step['img'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $alt = htmlspecialchars($step['alt'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $caption = $step['caption'];
        return <<<HTML
<div class="step-qr">
  <img src="/public/manual/img/{$img}" alt="{$alt}">
  <div class="step-qr-labels"><span>Android</span><span>iOS</span></div>
</div>
<p class="step-caption">{$caption}</p>
HTML;
    }

    /** @param array<string, mixed> $step */
    private static function textOnlyBody(array $step): string
    {
        return '<p class="step-caption step-caption--center">' . $step['caption'] . '</p>';
    }

    /** @param array<string, mixed> $step */
    private static function shotBody(array $step, string $layout): string
    {
        $img = htmlspecialchars($step['img'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $alt = htmlspecialchars($step['alt'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $caption = $step['caption'];
        $shotClass = match ($layout) {
            'icon-side' => 'step-shot step-shot--icon',
            'app-side' => 'step-shot step-shot--app',
            default => 'step-shot step-shot--device',
        };
        if ($layout === 'device-stack') {
            return <<<HTML
<div class="step-stack">
  <figure class="{$shotClass}"><img src="/public/manual/img/{$img}" alt="{$alt}"></figure>
  <p class="step-caption">{$caption}</p>
</div>
HTML;
        }
        return <<<HTML
<div class="step-side">
  <figure class="{$shotClass}"><img src="/public/manual/img/{$img}" alt="{$alt}"></figure>
  <p class="step-caption">{$caption}</p>
</div>
HTML;
    }

    /** @param list<string> $items */
    private static function legendHtml(array $items): string
    {
        if ($items === []) {
            return '';
        }
        $spans = '';
        foreach ($items as $item) {
            if ($item === 'short') {
                $spans .= '<span><i class="dot dot-short"></i> Appui court</span>';
            } elseif ($item === 'long') {
                $spans .= '<span><i class="dot dot-long"></i> Appui long</span>';
            }
        }
        return '<div class="step-legend">' . $spans . '</div>';
    }

    private static function legalHtml(string $email): string
    {
        return <<<HTML
<h2>Informations légales</h2>
<p><strong>TechAlchemy</strong> — Boîte à Cœur — Modèle <strong>TCY BAC XS3</strong></p>
<div class="legal-logos">
  <img src="/public/manual/img/CE.svg" alt="CE" height="14">
  <img src="/public/manual/img/DEEE.svg" alt="DEEE" height="14">
  <img src="/public/manual/img/FCC.svg" alt="FCC" height="14">
</div>
<p>Conforme aux directives UE applicables, dont 2014/53/UE (RED) — radio Wi-Fi et Bluetooth.</p>
<h3>Sécurité</h3>
<p>Alimentation 5 V CC par USB uniquement. Bloc secteur non fourni. Ne pas immerger ni ouvrir. Usage intérieur, 0–40 °C.</p>
<h3>Environnement (DEEE)</h3>
<p>Ne pas jeter avec les ordures ménagères ; déposer en point de collecte.</p>
<h3>Garantie</h3>
<p>Garantie légale de conformité de 2 ans (UE).</p>
<p class="legal-contact"><a href="mailto:{$email}">{$email}</a> · boite-a-coeur.fr</p>
HTML;
    }
}
