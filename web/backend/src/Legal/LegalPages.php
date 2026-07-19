<?php

declare(strict_types=1);

namespace Bac\Legal;

final class LegalPages
{
    /** @return array<string, string> */
    public static function slugs(): array
    {
        return [
            '/privacy' => 'privacy',
            '/confidentialite' => 'privacy',
            '/terms' => 'terms',
            '/cgu' => 'terms',
            '/legal' => 'legal',
            '/mentions-legales' => 'legal',
            '/cookies' => 'cookies',
            '/politique-cookies' => 'cookies',
            '/cgv' => 'cgv',
            '/conditions-generales-de-vente' => 'cgv',
        ];
    }

    /** @return array{title: string, h1: string, sections: list<array{h2: string, html: string}>}|null */
    public static function body(string $slug): ?array
    {
        return match ($slug) {
            'legal' => self::legal(),
            'terms' => self::terms(),
            'privacy' => self::privacy(),
            'cookies' => self::cookies(),
            'cgv' => self::cgv(),
            default => null,
        };
    }

    public static function pageTitle(string $slug): string
    {
        return match ($slug) {
            'legal' => 'Mentions légales',
            'terms' => 'Conditions d\'utilisation',
            'privacy' => 'Politique de confidentialité',
            'cookies' => 'Politique cookies',
            'cgv' => 'Conditions générales de vente',
            default => 'Boîte à Cœur',
        };
    }

    /** @return array{title: string, h1: string, sections: list<array{h2: string, html: string}>} */
    private static function legal(): array
    {
        $c = LegalEntity::cfg();
        $site = htmlspecialchars($c['site']);
        $product = htmlspecialchars($c['product']);
        $mediation = '<a href="' . htmlspecialchars($c['mediation_url']) . '" rel="noopener noreferrer">'
            . htmlspecialchars($c['mediation_name']) . '</a>';
        $odr = '<a href="' . htmlspecialchars($c['odr_url']) . '" rel="noopener noreferrer">'
            . htmlspecialchars($c['odr_url']) . '</a>';

        return [
            'title' => 'Mentions légales — Boîte à Cœur',
            'h1' => 'Mentions légales',
            'sections' => [
                [
                    'h2' => 'Éditeur du service',
                    'html' => LegalEntity::editorBlock()
                        . '<p>Site et application : <a href="https://' . $site . '">' . $site . '</a></p>'
                        . '<p>Produit : <strong>' . $product . '</strong> — application mobile et boîte connectée.</p>',
                ],
                [
                    'h2' => 'Directeur de la publication',
                    'html' => '<p>' . htmlspecialchars($c['director']) . '</p>',
                ],
                [
                    'h2' => 'Hébergeur',
                    'html' => '<p>Les données traitées par le service ' . $product . ' sont hébergées en France par :</p>'
                        . LegalEntity::hostBlock(),
                ],
                [
                    'h2' => 'Nature du service',
                    'html' => '<p>' . $product . ' est un service de messagerie affective permettant d\'envoyer des messages personnalisés (texte, images, animations) vers une boîte connectée associée à un compte utilisateur.</p>'
                        . '<p>Le service comprend une application mobile (Android et iOS), une API en ligne et un appareil connecté (boîte à cœur). L\'utilisation nécessite un compte utilisateur et une connexion Internet pour l\'application et la boîte.</p>',
                ],
                [
                    'h2' => 'Données personnelles',
                    'html' => '<p>Pour le traitement des données personnelles, consultez notre <a href="/privacy">Politique de confidentialité</a>. Pour les cookies et technologies similaires, voir notre <a href="/cookies">Politique cookies</a>.</p>',
                ],
                [
                    'h2' => 'Droit applicable et règlement des litiges',
                    'html' => '<p>Les présentes mentions légales sont régies par le droit français. Les utilisateurs conservent par ailleurs les droits que leur confère le droit de leur pays de résidence lorsque des dispositions impératives s\'appliquent.</p>'
                        . '<p>En cas de litige non résolu à l\'amiable, vous pouvez saisir ' . $mediation . '.</p>'
                        . '<p>Les consommateurs européens peuvent également utiliser la plateforme de règlement en ligne des litiges : ' . $odr . '.</p>',
                ],
            ],
        ];
    }

    /** @return array{title: string, h1: string, sections: list<array{h2: string, html: string}>} */
    private static function terms(): array
    {
        $c = LegalEntity::cfg();
        $product = htmlspecialchars($c['product']);
        $email = htmlspecialchars($c['email']);
        $mailto = LegalEntity::mailto();
        $publisher = htmlspecialchars($c['publisher_name']);
        $mediation = '<a href="' . htmlspecialchars($c['mediation_url']) . '" rel="noopener noreferrer">'
            . htmlspecialchars($c['mediation_name']) . '</a>';
        $odr = '<a href="' . htmlspecialchars($c['odr_url']) . '" rel="noopener noreferrer">'
            . htmlspecialchars($c['odr_url']) . '</a>';
        $updated = htmlspecialchars($c['updated']);

        return [
            'title' => 'Conditions d\'utilisation — Boîte à Cœur',
            'h1' => 'Conditions d\'utilisation',
            'sections' => [
                [
                    'h2' => 'Acceptation',
                    'html' => '<p>Dernière mise à jour : ' . $updated . '. En installant l\'application, en créant un compte ou en utilisant une boîte '
                        . $product . ', vous acceptez les présentes conditions. Dans le cas contraire, veuillez ne pas utiliser le service. '
                        . 'Ces conditions complètent nos <a href="/legal">Mentions légales</a> et notre <a href="/privacy">Politique de confidentialité</a>.</p>',
                ],
                [
                    'h2' => 'Description du service',
                    'html' => '<p>' . $product . ' permet de composer et d\'envoyer des messages vers une ou plusieurs boîtes connectées autorisées. '
                        . 'Le service inclut l\'association de boîtes, la configuration initiale via Bluetooth, l\'historique des envois et, le cas échéant, l\'historique de réception.</p>'
                        . '<p>Le fonctionnement normal requiert une connexion Internet stable pour l\'application mobile et pour la boîte destinataire.</p>',
                ],
                [
                    'h2' => 'Compte utilisateur',
                    'html' => '<p>Vous devez fournir des informations exactes lors de l\'inscription. Vous êtes responsable de la confidentialité de vos identifiants et de toute activité réalisée via votre compte.</p>'
                        . '<p>Vous pouvez supprimer votre compte et dissocier vos boîtes depuis l\'application, sous réserve des obligations légales de conservation.</p>',
                ],
                [
                    'h2' => 'Usage acceptable',
                    'html' => '<p>Vous vous engagez à utiliser ' . $product . ' de manière légale et respectueuse. Il est notamment interdit de :</p>'
                        . '<ul>'
                        . '<li>Envoyer des contenus illégaux, diffamatoires, haineux, violents, pornographiques ou portant atteinte aux droits de tiers ;</li>'
                        . '<li>Tenter de perturber, surcharger ou contourner les mesures de sécurité du service ;</li>'
                        . '<li>Usurper une identité ou accéder à une boîte sans autorisation ;</li>'
                        . '<li>Utiliser le service à des fins de spam, de harcèlement ou d\'abus manifeste.</li>'
                        . '</ul>',
                ],
                [
                    'h2' => 'Association des boîtes',
                    'html' => '<p>L\'association d\'une boîte à un compte est personnelle. Les codes ou liens d\'invitation ne doivent pas être diffusés publiquement. '
                        . 'Le propriétaire d\'une boîte peut la dissocier, la réinitialiser ou en demander la suppression conformément aux fonctionnalités prévues dans l\'application.</p>',
                ],
                [
                    'h2' => 'Contenu des messages',
                    'html' => '<p>Vous conservez vos droits sur les contenus que vous créez. Vous nous accordez les droits limités nécessaires pour stocker, transmettre et afficher ces contenus sur la boîte destinataire, le temps requis par le fonctionnement du service.</p>'
                        . '<p>Vous restez seul responsable du contenu envoyé et de son usage.</p>',
                ],
                [
                    'h2' => 'Appareil connecté',
                    'html' => '<p>La boîte connectée est un équipement électronique soumis à ses propres conditions d\'usage et de sécurité (alimentation USB 5 V, usage intérieur, etc.). '
                        . 'Les mises à jour firmware ou assets peuvent être déployées à distance pour assurer la sécurité et la compatibilité du service.</p>',
                ],
                [
                    'h2' => 'Propriété intellectuelle',
                    'html' => '<p>Le nom ' . $product . ', l\'application, la charte graphique, le code source, les textes et éléments originaux du service sont protégés par le droit de la propriété intellectuelle et restent la propriété de '
                        . $publisher . ' ou de ses concédants.</p>',
                ],
                [
                    'h2' => 'Limitation de responsabilité',
                    'html' => '<p>Le service est fourni « en l\'état ». Nous visons la disponibilité et la fiabilité du service, sans garantir l\'absence d\'interruption, d\'erreur ou d\'incompatibilité ponctuelle.</p>'
                        . '<p>Dans les limites autorisées par la loi, ' . $publisher . ' ne pourra être tenu responsable des dommages indirects résultant de l\'utilisation du service, notamment en cas de perte de message liée à une coupure réseau, une mauvaise configuration Wi-Fi ou une utilisation non conforme de la boîte.</p>',
                ],
                [
                    'h2' => 'Modification des conditions',
                    'html' => '<p>Nous pouvons mettre à jour les présentes conditions à tout moment. La date en tête de page indique la dernière révision. La poursuite de l\'utilisation du service après publication des modifications vaut acceptation des conditions mises à jour.</p>',
                ],
                [
                    'h2' => 'Droit applicable et médiation',
                    'html' => '<p>Les présentes conditions sont régies par le droit français. Les règles impératives de protection des consommateurs de votre pays de résidence s\'appliquent lorsqu\'elles ne peuvent être écartées.</p>'
                        . '<p>Avant toute action judiciaire, vous pouvez nous contacter à <a href="' . $mailto . '">' . $email . '</a> pour rechercher une solution amiable.</p>'
                        . '<p>Vous pouvez également recourir à ' . $mediation . ' ou à la plateforme européenne de règlement en ligne des litiges : ' . $odr . '.</p>',
                ],
            ],
        ];
    }

    /** @return array{title: string, h1: string, sections: list<array{h2: string, html: string}>} */
    private static function privacy(): array
    {
        $c = LegalEntity::cfg();
        $product = htmlspecialchars($c['product']);
        $site = htmlspecialchars($c['site']);
        $email = htmlspecialchars($c['email']);
        $mailto = LegalEntity::mailto();
        $publisher = htmlspecialchars($c['publisher_name']);
        $host = htmlspecialchars($c['host_name']);
        $retention = (int) $c['data_retention_months'];
        $updated = htmlspecialchars($c['updated']);

        return [
            'title' => 'Politique de confidentialité — Boîte à Cœur',
            'h1' => 'Politique de confidentialité',
            'sections' => [
                [
                    'h2' => 'Introduction',
                    'html' => '<p>Dernière mise à jour : ' . $updated . '. La présente Politique de confidentialité décrit comment '
                        . $publisher . ' (« nous ») traite les données personnelles lorsque vous utilisez l\'application '
                        . $product . ', une boîte connectée ou le site <a href="https://' . $site . '">' . $site . '</a>. '
                        . 'Elle est conforme au Règlement général sur la protection des données (RGPD) et à la loi française « Informatique et Libertés ».</p>'
                        . '<p>Pour les cookies, consultez notre <a href="/cookies">Politique cookies</a>.</p>',
                ],
                [
                    'h2' => 'Responsable du traitement',
                    'html' => LegalEntity::editorBlock()
                        . '<p>Directeur de la publication : ' . htmlspecialchars($c['director']) . '</p>'
                        . '<p>Contact protection des données : <a href="' . $mailto . '">' . $email . '</a></p>',
                ],
                [
                    'h2' => 'Hébergement',
                    'html' => '<p>Les données personnelles traitées par le service sont hébergées en France par :</p>'
                        . LegalEntity::hostBlock(),
                ],
                [
                    'h2' => 'Données traitées et finalités',
                    'html' => '<p>Selon votre utilisation du service, nous pouvons traiter les catégories suivantes :</p>'
                        . '<table>'
                        . '<thead><tr><th>Catégorie</th><th>Finalité</th><th>Base légale (RGPD)</th></tr></thead>'
                        . '<tbody>'
                        . '<tr><td>Adresse e-mail, prénom, mot de passe haché</td><td>Création et gestion du compte</td><td>Exécution du contrat (art. 6(1)(b))</td></tr>'
                        . '<tr><td>Identifiants OAuth (Google, Apple, Facebook)</td><td>Connexion via un fournisseur tiers</td><td>Exécution du contrat ; consentement lorsque requis par le fournisseur</td></tr>'
                        . '<tr><td>Contenus de messages (BACM), métadonnées d\'envoi, statut de livraison</td><td>Composition, transmission et affichage des messages</td><td>Exécution du contrat (art. 6(1)(b))</td></tr>'
                        . '<tr><td>Identifiants de boîte, numéro de série, nom, alias de contact, version firmware</td><td>Association, gestion et affichage des boîtes liées</td><td>Exécution du contrat (art. 6(1)(b))</td></tr>'
                        . '<tr><td>Télémétrie technique de la boîte (mémoire, uptime, IP locale, MAC, RSSI)</td><td>Maintenance, diagnostic et sécurité du parc</td><td>Intérêt légitime (art. 6(1)(f))</td></tr>'
                        . '<tr><td>Adresse IP et journaux techniques</td><td>Sécurité, prévention des abus, diagnostic</td><td>Intérêt légitime (art. 6(1)(f))</td></tr>'
                        . '<tr><td>Jeton de session (stockage sécurisé sur le téléphone)</td><td>Maintien de la connexion à l\'application</td><td>Exécution du contrat (art. 6(1)(b))</td></tr>'
                        . '<tr><td>Images ou vidéos sélectionnées pour composer un message</td><td>Création du message</td><td>Exécution du contrat ; traitement principalement local sur l\'appareil avant envoi</td></tr>'
                        . '</tbody>'
                        . '</table>',
                ],
                [
                    'h2' => 'Données non collectées',
                    'html' => '<ul>'
                        . '<li>Nous ne collectons pas votre position GPS. La permission de localisation sur Android peut être requise par le système pour le scan Bluetooth lors de la configuration Wi-Fi ; aucune coordonnée n\'est transmise à nos serveurs.</li>'
                        . '<li>Nous n\'enregistrons pas de contenu audio via le microphone.</li>'
                        . '<li>Nous n\'accédons pas à l\'ensemble de votre galerie : seuls les médias que vous sélectionnez sont traités.</li>'
                        . '<li>Nous ne vendons pas vos données personnelles.</li>'
                        . '</ul>',
                ],
                [
                    'h2' => 'Permissions de l\'application mobile',
                    'html' => '<ul>'
                        . '<li><strong>Bluetooth</strong> : configuration Wi-Fi de la boîte lors de l\'association initiale.</li>'
                        . '<li><strong>Photos / médiathèque</strong> : sélection d\'images ou de courtes vidéos pour composer un message.</li>'
                        . '<li><strong>Localisation (Android)</strong> : exigée par le système pour le scan Bluetooth ; non utilisée pour vous géolocaliser.</li>'
                        . '</ul>',
                ],
                [
                    'h2' => 'Durée de conservation',
                    'html' => '<p>Les données de compte sont conservées tant que le compte est actif, puis supprimées après demande de suppression ou selon nos procédures internes.</p>'
                        . '<p>Les messages sont conservés le temps nécessaire à la livraison et à l\'affichage. Les messages éphémères sont supprimés après ouverture sur la boîte. L\'historique persistant est conservé selon les paramètres du message.</p>'
                        . '<p>Les journaux techniques et données de sécurité sont conservés pour une durée limitée, en principe au maximum '
                        . $retention . ' mois, sauf obligation légale ou nécessité de constater, exercer ou défendre un droit en justice.</p>',
                ],
                [
                    'h2' => 'Destinataires et absence de cession',
                    'html' => '<p>Les données personnelles sont traitées par ' . $publisher . ' et notre hébergeur '
                        . $host . ' agissant en qualité de sous-traitant selon nos instructions. Nous ne vendons, ne louons ni n\'échangeons vos données personnelles.</p>'
                        . '<p>Les fournisseurs OAuth (Google, Apple, Facebook) peuvent traiter des données lorsque vous choisissez une connexion via ces services, conformément à leurs propres politiques.</p>',
                ],
                [
                    'h2' => 'Transferts hors Union européenne',
                    'html' => '<p>Les données sont stockées et traitées au sein de l\'Union européenne. Nous ne transférons pas volontairement vos messages hors de l\'UE.</p>'
                        . '<p>Si vous utilisez une connexion OAuth ou des services de fournisseurs établis hors UE, ces tiers peuvent traiter des données selon leurs propres garanties (clauses contractuelles types, etc.).</p>',
                ],
                [
                    'h2' => 'Sécurité',
                    'html' => '<p>Nous mettons en œuvre des mesures techniques et organisationnelles appropriées : communications chiffrées (HTTPS/TLS), mots de passe hachés, authentification des boîtes, stockage sécurisé des jetons sur le téléphone.</p>',
                ],
                [
                    'h2' => 'Vos droits',
                    'html' => '<p>Conformément au RGPD, vous disposez des droits suivants :</p>'
                        . '<ul>'
                        . '<li><strong>Droit d\'accès</strong> — obtenir confirmation et copie des données vous concernant ;</li>'
                        . '<li><strong>Droit de rectification</strong> — faire corriger des données inexactes ;</li>'
                        . '<li><strong>Droit à l\'effacement</strong> — demander la suppression lorsque la loi l\'autorise ;</li>'
                        . '<li><strong>Droit à la limitation</strong> — demander la limitation du traitement dans certains cas ;</li>'
                        . '<li><strong>Droit à la portabilité</strong> — recevoir les données que vous avez fournies dans un format structuré, lorsque applicable ;</li>'
                        . '<li><strong>Droit d\'opposition</strong> — vous opposer à un traitement fondé sur l\'intérêt légitime ;</li>'
                        . '<li><strong>Retrait du consentement</strong> — retirer votre consentement à tout moment pour les traitements fondés sur celui-ci.</li>'
                        . '</ul>'
                        . '<p>Pour exercer vos droits, écrivez à <a href="' . $mailto . '">' . $email . '</a>. Nous pouvons vous demander des éléments permettant de vérifier votre identité. Nous répondons dans un délai d\'un mois, prolongeable lorsque la loi le permet.</p>'
                        . '<p>Vous pouvez également télécharger vos données, supprimer uniquement vos données personnelles ou supprimer votre compte via notre page dédiée : <a href="/delete-me">boite-a-coeur.fr/delete-me</a>.</p>',
                ],
                [
                    'h2' => 'Mineurs',
                    'html' => '<p>Le service s\'adresse aux personnes âgées de 16 ans et plus. Si vous pensez qu\'un mineur nous a transmis des données sans autorisation parentale, contactez-nous pour demander la suppression.</p>',
                ],
                [
                    'h2' => 'Réclamation auprès de l\'autorité de contrôle',
                    'html' => '<p>Si vous estimez que nos traitements enfreignent la réglementation applicable, vous avez le droit d\'introduire une réclamation auprès de la CNIL (<a href="https://www.cnil.fr" rel="noopener noreferrer">www.cnil.fr</a>), autorité de contrôle française, ou auprès de l\'autorité de votre État membre de l\'UE de résidence.</p>',
                ],
                [
                    'h2' => 'Modifications',
                    'html' => '<p>Nous pouvons mettre à jour la présente Politique de confidentialité pour refléter des évolutions légales ou opérationnelles. La date en tête de page indique la dernière version. Les modifications substantielles seront signalées par un moyen approprié.</p>',
                ],
            ],
        ];
    }

    /** @return array{title: string, h1: string, sections: list<array{h2: string, html: string}>} */
    private static function cookies(): array
    {
        $c = LegalEntity::cfg();
        $email = htmlspecialchars($c['email']);
        $mailto = LegalEntity::mailto();
        $updated = htmlspecialchars($c['updated']);

        return [
            'title' => 'Politique cookies — Boîte à Cœur',
            'h1' => 'Politique cookies',
            'sections' => [
                [
                    'h2' => 'Introduction',
                    'html' => '<p>Dernière mise à jour : ' . $updated . '. Cette page explique comment '
                        . htmlspecialchars($c['site']) . ' utilise les cookies et technologies similaires. '
                        . 'Elle doit être lue conjointement avec notre <a href="/privacy">Politique de confidentialité</a>.</p>',
                ],
                [
                    'h2' => 'Cookies strictement nécessaires',
                    'html' => '<p>Le site et l\'API peuvent utiliser des cookies ou mécanismes de session techniques nécessaires au fonctionnement du service, notamment pour l\'authentification, la sécurité et le bon déroulement des flux OAuth. Ces traceurs ne requièrent pas de consentement au titre des règles ePrivacy applicables.</p>',
                ],
                [
                    'h2' => 'Absence de publicité et de mesure d\'audience marketing',
                    'html' => '<p>boite-a-coeur.fr n\'utilise pas de cookies publicitaires ni de cookies de mesure d\'audience à des fins marketing. Nous ne diffusons pas de publicité ciblée sur le service Boîte à Cœur.</p>',
                ],
                [
                    'h2' => 'Stockage local de l\'application',
                    'html' => '<p>L\'application mobile stocke localement un jeton de session de manière sécurisée afin de maintenir votre connexion. Ce stockage relève du fonctionnement de l\'application et non du présent site web.</p>',
                ],
                [
                    'h2' => 'Gestion des cookies',
                    'html' => '<p>Le site vitrine boite-a-coeur.fr peut mémoriser votre choix relatif au bandeau cookies dans le stockage local de votre navigateur (aucun cookie publicitaire n\'est déposé).</p>'
                        . '<p>Vous pouvez configurer votre navigateur pour refuser les cookies ou être averti de leur dépôt. Le refus des cookies strictement nécessaires peut empêcher certaines fonctionnalités web (par exemple la finalisation d\'une connexion OAuth dans le navigateur).</p>',
                ],
                [
                    'h2' => 'Contact',
                    'html' => '<p>Questions relatives aux cookies : <a href="' . $mailto . '">' . $email . '</a>.</p>',
                ],
            ],
        ];
    }

    /** @return array{title: string, h1: string, sections: list<array{h2: string, html: string}>} */
    private static function cgv(): array
    {
        $c = LegalEntity::cfg();
        $email = htmlspecialchars($c['email']);
        $mailto = LegalEntity::mailto();
        $product = htmlspecialchars($c['product']);
        $mediation = '<a href="' . htmlspecialchars($c['mediation_url']) . '" rel="noopener noreferrer">'
            . htmlspecialchars($c['mediation_name']) . '</a>';
        $odr = '<a href="' . htmlspecialchars($c['odr_url']) . '" rel="noopener noreferrer">'
            . htmlspecialchars($c['odr_url']) . '</a>';

        return [
            'title' => 'Conditions générales de vente — Boîte à Cœur',
            'h1' => 'Conditions générales de vente',
            'sections' => [
                [
                    'h2' => 'Champ d\'application',
                    'html' => '<p>Les présentes Conditions générales de vente (CGV) s\'appliquent à toute commande de produits '
                        . $product . ' passée sur le site boite-a-coeur.fr dès l\'ouverture de la boutique en ligne.</p>'
                        . '<p>Tant que la boutique n\'est pas ouverte, aucune commande ne peut être passée sur le site. '
                        . 'Les présentes CGV sont publiées à titre informatif en vue de la commercialisation.</p>',
                ],
                [
                    'h2' => 'Vendeur',
                    'html' => LegalEntity::editorBlock(),
                ],
                [
                    'h2' => 'Produits',
                    'html' => '<p>' . $product . ' est une boîte connectée destinée à recevoir des messages personnalisés envoyés via l\'application mobile associée. '
                        . 'Le produit est généralement proposé par duo (deux boîtes). Les caractéristiques essentielles, photographies et descriptifs '
                        . 'figurant sur la fiche produit au moment de la commande font foi.</p>',
                ],
                [
                    'h2' => 'Prix et paiement',
                    'html' => '<p>Les prix sont indiqués en euros toutes taxes comprises (TTC) pour les consommateurs situés dans l\'Union européenne, '
                        . 'sauf mention contraire. Le vendeur se réserve le droit de modifier ses prix à tout moment, étant entendu que le prix figurant '
                        . 'au catalogue le jour de la commande sera le seul applicable à l\'acheteur.</p>'
                        . '<p>Le paiement est exigible immédiatement à la commande par les moyens proposés sur le site (carte bancaire, etc.). '
                        . 'La commande ne sera considérée comme définitive qu\'après encaissement effectif.</p>',
                ],
                [
                    'h2' => 'Commande et confirmation',
                    'html' => '<p>Le client sélectionne les produits, valide son panier et confirme sa commande après avoir accepté les présentes CGV. '
                        . 'Une confirmation de commande est envoyée par e-mail à l\'adresse indiquée par le client.</p>',
                ],
                [
                    'h2' => 'Livraison',
                    'html' => '<p>Les produits sont livrés à l\'adresse indiquée par le client lors de la commande, en France métropolitaine et dans les pays '
                        . 'effectivement proposés au moment de l\'achat. Les délais de livraison sont communiqués lors de la commande et peuvent varier '
                        . 'selon la disponibilité des stocks.</p>'
                        . '<p>Le risque de perte ou d\'endommagement des produits est transféré au client au moment où celui-ci prend physiquement possession des produits.</p>',
                ],
                [
                    'h2' => 'Droit de rétractation',
                    'html' => '<p>Conformément aux articles L221-18 et suivants du Code de la consommation, le client dispose d\'un délai de quatorze (14) jours '
                        . 'à compter de la réception des produits pour exercer son droit de rétractation, sans avoir à justifier de motifs ni à payer de pénalités.</p>'
                        . '<p>Pour exercer ce droit, le client notifie sa décision par e-mail à <a href="' . $mailto . '">' . $email . '</a> ou par courrier à l\'adresse du vendeur. '
                        . 'Les produits doivent être retournés dans leur état d\'origine, complets et en parfait état de revente.</p>'
                        . '<p>Les frais de retour sont à la charge du client, sauf disposition légale contraire.</p>',
                ],
                [
                    'h2' => 'Garanties légales',
                    'html' => '<p>Les produits bénéficient de la garantie légale de conformité (articles L217-4 et suivants du Code de la consommation) '
                        . 'et de la garantie contre les vices cachés (articles 1641 et suivants du Code civil).</p>'
                        . '<p>En cas de non-conformité, le client peut demander la réparation ou le remplacement du produit, ou à défaut une réduction du prix ou la résolution du contrat.</p>',
                ],
                [
                    'h2' => 'Responsabilité',
                    'html' => '<p>Le vendeur est responsable des défauts de conformité existant au moment de la délivrance du produit. Sa responsabilité ne saurait être engagée '
                        . 'pour les dommages indirects résultant d\'une mauvaise utilisation, d\'une absence de connexion Internet ou d\'une configuration incorrecte de l\'appareil.</p>',
                ],
                [
                    'h2' => 'Données personnelles',
                    'html' => '<p>Les données collectées lors de la commande sont traitées conformément à notre <a href="/privacy">Politique de confidentialité</a>.</p>',
                ],
                [
                    'h2' => 'Médiation et litiges',
                    'html' => '<p>En cas de litige, le client peut recourir gratuitement à ' . $mediation . ' ou à la plateforme européenne de règlement en ligne des litiges : ' . $odr . '.</p>'
                        . '<p>À défaut de résolution amiable, les tribunaux français seront compétents conformément aux règles de droit commun.</p>',
                ],
                [
                    'h2' => 'Contact',
                    'html' => '<p>Service client : <a href="' . $mailto . '">' . $email . '</a>.</p>',
                ],
            ],
        ];
    }
}
