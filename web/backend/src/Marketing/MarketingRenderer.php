<?php

declare(strict_types=1);

namespace Bac\Marketing;

use Bac\Legal\LegalEntity;

final class MarketingRenderer
{
    public static function home(): string
    {
        $c = LegalEntity::cfg();
        $site = htmlspecialchars($c['site'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $email = htmlspecialchars($c['email'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $product = htmlspecialchars($c['product'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $year = date('Y');

        $desc = 'Boîte à Cœur : une boîte connectée et son application pour envoyer des petits mots, photos et emojis à distance. '
            . 'Pensée pour les duos qui veulent rester proches. Boutique bientôt disponible.';

        return <<<HTML
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{$product} — Des petits mots qui font battre les cœurs</title>
  <meta name="description" content="{$desc}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://{$site}/">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="fr_FR">
  <meta property="og:site_name" content="{$product}">
  <meta property="og:title" content="{$product} — Des petits mots à distance">
  <meta property="og:description" content="{$desc}">
  <meta property="og:url" content="https://{$site}/">
  <meta property="og:image" content="https://{$site}/public/marketing/img/lifestyle-screens.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{$product}">
  <meta name="twitter:description" content="{$desc}">
  <meta name="twitter:image" content="https://{$site}/public/marketing/img/lifestyle-screens.png">
  <link rel="icon" href="/public/marketing/img/logo.png" type="image/png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/public/marketing/css/site.css">
  <script type="application/ld+json">{
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Boîte à Cœur",
    "description": "Boîte connectée et application mobile pour envoyer des messages personnalisés à distance.",
    "brand": { "@type": "Brand", "name": "Techalchemy" },
    "manufacturer": { "@type": "Organization", "name": "Techalchemy", "url": "https://{$site}/" },
    "category": "Connected gift device",
    "image": "https://{$site}/public/marketing/img/lifestyle-bedroom.png",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/preorder",
      "url": "https://{$site}/#boutique"
    }
  }</script>
</head>
<body class="grain">
  <a class="skip-link" href="#contenu">Aller au contenu</a>

  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="/">
        <img src="/public/marketing/img/logo.png" width="42" height="42" alt="">
        <span>Boîte à Cœur</span>
      </a>
      <nav class="nav-desktop" aria-label="Navigation principale">
        <a href="#moments">En situation</a>
        <a href="#duo">Le duo</a>
        <a href="#comment">Comment ça marche</a>
        <a href="#app">L'application</a>
        <a class="nav-cta" href="#boutique"><span class="badge">Bientôt</span> Boutique</a>
      </nav>
      <button class="menu-toggle" type="button" aria-label="Menu" aria-expanded="false">☰</button>
    </div>
  </header>

  <nav class="nav-mobile" aria-label="Menu mobile">
    <a href="#moments">En situation</a>
    <a href="#duo">Le duo</a>
    <a href="#comment">Comment ça marche</a>
    <a href="#app">L'application</a>
    <a href="#boutique">Boutique</a>
  </nav>

  <main id="contenu">
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-copy">
          <p class="eyebrow">Messagerie affective</p>
          <h1>Un petit mot.<br><em>Un battement.</em></h1>
          <p class="hero-lead">
            Pas une notification de plus. Une photo sur la table de chevet, un mot doux au réveil,
            un emoji animé qui s'allume dans le salon de l'autre — là où la vie se passe.
          </p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="#moments">Voir en situation</a>
            <a class="btn btn-ghost" href="#boutique">Boutique prochainement</a>
          </div>
        </div>
        <div class="hero-scenes" id="moments">
          <figure class="scene-card scene-main">
            <img src="/public/marketing/img/lifestyle-bedroom.png" width="800" height="600" alt="Boîte à cœur sur une table de chevet, affichant un message Je t'aime">
            <figcaption>Le soir, un mot qui attend sur la table de chevet.</figcaption>
          </figure>
          <figure class="scene-card scene-side">
            <img src="/public/marketing/img/lifestyle-desk.png" width="800" height="600" alt="Boîte à cœur sur un bureau en bois">
            <figcaption>Le jour, une présence discrète entre deux e-mails.</figcaption>
          </figure>
        </div>
      </div>
    </section>

    <section class="story-band" id="histoire">
      <div class="story-inner">
        <h2>Quand la distance s'allonge, les petits signes comptent double</h2>
        <p>
          Couple en déplacement, famille éclatée, amis séparés par les fuseaux horaires :
          Boîte à Cœur transforme un message en moment. Tu composes sur ton téléphone,
          la boîte s'éveille chez l'autre — comme si tu avais glissé un mot sous sa porte.
        </p>
      </div>
    </section>

    <section class="section section-alt" id="duo">
      <div class="section-inner">
        <div class="section-head centered">
          <p class="section-label">Le principe</p>
          <h2>Une boîte chacun, pour rester proches</h2>
          <p>Le produit fonctionne par duo minimum : chaque personne possède sa boîte, configurée chez elle, reliée à l'autre par l'application.</p>
        </div>
        <figure class="scene-card duo-hero">
          <img src="/public/marketing/img/lifestyle-screens.png" width="1200" height="800" alt="Trois boîtes en situation dans un intérieur chaleureux">
        </figure>
        <div class="duo-grid duo-copy">
          <div class="duo-text">
            <h3>Chez l'autre</h3>
            <p>La boîte s'installe là où l'on vit : table de chevet, commode, salon. Un message s'allume sans que l'autre ait à sortir son téléphone.</p>
          </div>
          <div class="duo-text">
            <h3>Chez toi</h3>
            <p>De ton côté, tu composes et envoies depuis l'app. Deux boîtes, deux foyers — le lien traverse la distance en silence.</p>
          </div>
        </div>
        <p class="duo-gift">Pensée pour s'offrir en duo : on en garde une, on en offre une.</p>
      </div>
    </section>

    <section class="section" id="comment">
      <div class="section-inner">
        <div class="section-head">
          <p class="section-label">Le geste</p>
          <h2>Quatre étapes, zéro friction</h2>
          <p>De l'idée au sourire de l'autre : une chaîne simple, pensée pour le quotidien.</p>
        </div>
        <div class="steps">
          <article class="step">
            <div class="step-num">1</div>
            <h3>Composer</h3>
            <p>Texte, photo, emoji animé ou GIF : tu crées ton message dans l'éditeur visuel de l'application.</p>
          </article>
          <article class="step">
            <div class="step-num">2</div>
            <h3>Envoyer</h3>
            <p>Maintenant ou plus tard : programme l'heure d'un anniversaire, d'un réveil tendre ou d'une surprise.</p>
          </article>
          <article class="step">
            <div class="step-num">3</div>
            <h3>S'allumer</h3>
            <p>La boîte de l'autre s'éveille. Un message t'attend. Un bouton, un écran, un moment.</p>
          </article>
          <article class="step">
            <div class="step-num">4</div>
            <h3>Relire</h3>
            <p>Les messages peuvent rester, s'effacer ou devenir éphémères — tu choisis l'intimité du geste.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section section-alt" id="app">
      <div class="section-inner">
        <div class="section-head">
          <p class="section-label">L'application</p>
          <h2>Ton téléphone devient l'encrier</h2>
          <p>L'app Boîte à Cœur accompagne la boîte : configuration Wi-Fi, association des contacts, création et suivi des messages.</p>
        </div>
        <div class="features">
          <article class="feature">
            <div class="feature-icon">Ed</div>
            <h3>Éditeur visuel</h3>
            <p>Polices, couleurs, calques : compose comme sur un petit écran 280×240, fidèle à ce que verra l'autre.</p>
          </article>
          <article class="feature">
            <div class="feature-icon">Em</div>
            <h3>Emojis animés</h3>
            <p>Des centaines d'emojis animés pour des messages qui bougent, sourient et dansent un peu.</p>
          </article>
          <article class="feature">
            <div class="feature-icon">Pl</div>
            <h3>Programmation</h3>
            <p>Envoie à l'instant ou planifie : un mot à l'heure du café, une photo pour le coucher.</p>
          </article>
          <article class="feature">
            <div class="feature-icon">Ep</div>
            <h3>Messages éphémères</h3>
            <p>Un clin d'œil de dix secondes, puis plus rien — pour les confidences qui ne restent pas.</p>
          </article>
          <article class="feature">
            <div class="feature-icon">Cd</div>
            <h3>Association par code</h3>
            <p>Lie la boîte de ton partenaire, d'un parent ou d'un ami en quelques secondes.</p>
          </article>
          <article class="feature">
            <div class="feature-icon">Sv</div>
            <h3>Suivi des envois</h3>
            <p>Reçu, ouvert, vu : tu sais quand ton petit mot a trouvé sa place.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-inner">
        <div class="section-head centered">
          <p class="section-label">Le projet</p>
          <h2>Une aventure en cours, portée avec soin</h2>
        </div>
        <div class="timeline">
          <div class="timeline-item is-done">
            <div class="timeline-dot">1</div>
            <h3>Prototypage terminé</h3>
            <p>Boîtier, écran, firmware et cloud validés en conditions réelles.</p>
          </div>
          <div class="timeline-item is-active">
            <div class="timeline-dot">2</div>
            <h3>Application en développement</h3>
            <p>Éditeur, envoi, association et expérience mobile peaufinés au quotidien.</p>
          </div>
          <div class="timeline-item">
            <div class="timeline-dot">3</div>
            <h3>Commercialisation 2026</h3>
            <p>Ouverture de la boutique en ligne prévue d'ici novembre 2026.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="boutique">
      <div class="section-inner">
        <div class="shop">
          <div class="shop-inner">
            <p class="section-label">Boutique</p>
            <h2>Bientôt disponible</h2>
            <p>
              Nous finalisons la première série et l'expérience d'achat.
              La boutique ouvrira ici, sur boite-a-coeur.fr — sans détour, sans compte obligatoire pour découvrir le produit.
            </p>
            <button class="btn btn-disabled" type="button" disabled>Ouverture prochaine</button>
            <p class="shop-note">Une question ? Écrivez-nous à <a href="mailto:{$email}">{$email}</a></p>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="brand" href="/">
          <img src="/public/marketing/img/logo.png" width="36" height="36" alt="">
          <span>Boîte à Cœur</span>
        </a>
        <p>Boîte connectée et application pour envoyer des petits mots à ceux qui comptent.</p>
      </div>
      <div class="footer-col">
        <h4>Produit</h4>
        <ul>
          <li><a href="#moments">En situation</a></li>
          <li><a href="#duo">Le duo</a></li>
          <li><a href="#comment">Comment ça marche</a></li>
          <li><a href="/manual">Manuel d'utilisation</a></li>
          <li><a href="#boutique">Boutique</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Légal</h4>
        <ul>
          <li><a href="/legal">Mentions légales</a></li>
          <li><a href="/terms">CGU</a></li>
          <li><a href="/cgv">CGV</a></li>
          <li><a href="/privacy">Confidentialité</a></li>
          <li><a href="/cookies">Cookies</a></li>
          <li><a href="/delete-me">Vos données (RGPD)</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© {$year} Techalchemy — {$product}</span>
      <span><a href="mailto:{$email}">{$email}</a></span>
    </div>
  </footer>

  <div class="cookie-banner" role="dialog" aria-label="Cookies">
    <p>Ce site utilise des cookies techniques strictement nécessaires. Aucun cookie publicitaire n'est déposé. <a href="/cookies">En savoir plus</a></p>
    <div class="cookie-actions">
      <button class="accept" type="button">J'accepte</button>
      <button class="decline" type="button">Continuer sans enregistrer</button>
    </div>
  </div>

  <script src="/public/marketing/js/site.js" defer></script>
</body>
</html>
HTML;
    }
}
