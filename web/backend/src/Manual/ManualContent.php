<?php

declare(strict_types=1);

namespace Bac\Manual;

final class ManualContent
{
    /** @return list<array<string, mixed>> */
    public static function sections(): array
    {
        return [
            [
                'id' => 'demarrage',
                'title' => 'Démarrage',
                'steps' => [
                    [
                        'n' => '',
                        'title' => 'Contenu de l\'emballage',
                        'layout' => 'list',
                        'items' => [
                            '1× Boîte à Cœur',
                            '1× Câble USB souple 1,5 m (USB-A)',
                            '1× Notice d\'utilisation',
                        ],
                        'note' => 'Alimentation 5 V non incluse. Toute prise ou batterie USB-A conforme convient.',
                    ],
                    [
                        'n' => '1',
                        'title' => 'Le bouton',
                        'layout' => 'icon-side',
                        'img' => '1.png',
                        'alt' => 'Bouton de la boîte',
                        'caption' => '<strong>Court</strong> : ouvrir un message.<br><strong>Long</strong> (~2 s) : réglages.',
                        'legend' => ['short', 'long'],
                    ],
                    [
                        'n' => '2',
                        'title' => 'L\'application',
                        'layout' => 'qr',
                        'img' => 'qr-20260715-0522.png',
                        'alt' => 'QR code Boîte à Cœur',
                        'caption' => 'Scanne le code QR pour télécharger <strong>Boîte à Cœur</strong>, puis crée ton compte (prénom requis) pour lier ta boîte.',
                    ],
                    [
                        'n' => '3',
                        'title' => 'Mise en marche',
                        'layout' => 'device-stack',
                        'img' => '3.png',
                        'alt' => 'Écran d\'accueil',
                        'caption' => 'Branche le <strong>câble USB</strong> fourni et attends l\'écran d\'accueil.',
                    ],
                    [
                        'n' => '4',
                        'title' => 'Premiers pas',
                        'layout' => 'device-stack',
                        'img' => '4.png',
                        'alt' => 'Configuration initiale',
                        'caption' => 'Suis les écrans de <strong>bienvenue</strong> jusqu\'à l\'étape Wi-Fi.',
                    ],
                ],
            ],
            [
                'id' => 'wifi',
                'title' => 'Connexion Wi-Fi',
                'steps' => [
                    [
                        'n' => '5',
                        'title' => 'La boîte attend',
                        'layout' => 'device-stack',
                        'img' => '5.png',
                        'alt' => 'Attente Bluetooth',
                        'caption' => 'La boîte attend l\'application en <strong>Bluetooth</strong>. Garde-la allumée à proximité.',
                    ],
                    [
                        'n' => '6',
                        'title' => 'Wi-Fi via l\'app',
                        'layout' => 'app-side',
                        'img' => '6.png',
                        'alt' => 'Configuration Wi-Fi dans l\'app',
                        'caption' => 'Sélectionne ton réseau et saisis le mot de passe. La boîte le reçoit par Bluetooth.',
                    ],
                    [
                        'n' => '7',
                        'title' => 'Connexion en cours',
                        'layout' => 'device-stack',
                        'img' => '7.png',
                        'alt' => 'Connexion Wi-Fi',
                        'caption' => 'Patiente. En cas d\'échec, vérifie le mot de passe et réessaie via l\'app.',
                    ],
                ],
            ],
            [
                'id' => 'duo',
                'title' => 'Ton duo',
                'steps' => [
                    [
                        'n' => '8',
                        'title' => 'Associer une boîte',
                        'layout' => 'app-side',
                        'img' => '8.png',
                        'alt' => 'Association de boîte',
                        'caption' => 'Contact → <strong>Générer mon code</strong> ou saisis celui de ton partenaire. Chacun possède sa boîte.',
                    ],
                    [
                        'n' => '9',
                        'title' => 'Nommer la boîte',
                        'layout' => 'app-side',
                        'img' => '9.png',
                        'alt' => 'Alias de la boîte',
                        'caption' => 'Dans <strong>Contacts</strong>, personnalise le nom (ex. « Mon amour »). Visible de ton côté seulement.',
                    ],
                    [
                        'n' => '10',
                        'title' => 'Au repos',
                        'layout' => 'device-stack',
                        'img' => '10.png',
                        'alt' => 'Écran au repos',
                        'caption' => 'Connectée, la boîte affiche l\'<strong>heure</strong> et attend les messages.',
                    ],
                ],
            ],
            [
                'id' => 'messages',
                'title' => 'Messages',
                'steps' => [
                    [
                        'n' => '',
                        'title' => 'Nouveau message',
                        'layout' => 'device-stack',
                        'img' => '12b.png',
                        'alt' => 'Notification nouveau message',
                        'caption' => 'À la réception, l\'écran <strong>Nouveau message</strong> s\'affiche (ou « éphémère »).',
                    ],
                    [
                        'n' => '',
                        'title' => 'Lire un message',
                        'layout' => 'text-only',
                        'caption' => '<strong>Appui court</strong> sur le bouton pour ouvrir le message. Fermeture automatique après lecture.',
                        'legend' => ['short'],
                    ],
                ],
            ],
            [
                'id' => 'reglages',
                'title' => 'Réglages de la boîte',
                'steps' => [
                    [
                        'n' => '11',
                        'title' => 'Ouvrir les réglages',
                        'layout' => 'device-stack',
                        'img' => '11.png',
                        'alt' => 'Menu réglages',
                        'caption' => 'Sur l\'accueil, fais un <strong>appui long</strong> pour ouvrir les Réglages.',
                    ],
                    [
                        'n' => '12',
                        'title' => 'Réglages Wi-Fi',
                        'layout' => 'device-stack',
                        'img' => '12.png',
                        'alt' => 'Paramètres Wi-Fi',
                        'caption' => 'Appui long → Paramètres → <strong>Wi-Fi</strong> : voir le réseau actif et le déconnecter.',
                    ],
                    [
                        'n' => '13',
                        'title' => 'Langue',
                        'layout' => 'device-stack',
                        'img' => '13.png',
                        'alt' => 'Choix de la langue',
                        'caption' => 'Appui long → Paramètres → Langue → <strong>Français</strong>. Choisis la langue de l\'interface.',
                    ],
                    [
                        'n' => '14',
                        'title' => 'Test internet',
                        'layout' => 'device-stack',
                        'img' => '14.png',
                        'alt' => 'Test de connexion',
                        'caption' => 'Appui long → Paramètres → WIFI → <strong>Tester</strong>. Vérifie l\'accès au serveur.',
                    ],
                    [
                        'n' => '15',
                        'title' => 'Déconnecter le Wi-Fi',
                        'layout' => 'device-stack',
                        'img' => '15.png',
                        'alt' => 'Déconnexion Wi-Fi',
                        'caption' => 'Appui long → Paramètres → Wi-Fi → <strong>Déconnecter</strong>. Efface le réseau Wi-Fi enregistré.',
                    ],
                    [
                        'n' => '16',
                        'title' => 'Informations',
                        'layout' => 'device-stack',
                        'img' => '16.png',
                        'alt' => 'Informations système',
                        'caption' => 'Appui long → <strong>Informations</strong> : n° de série, version, adresse MAC.',
                    ],
                ],
            ],
            [
                'id' => 'maintenance',
                'title' => 'Réinitialisation et dépannage',
                'steps' => [
                    [
                        'n' => '17',
                        'title' => 'Réinitialiser (boîte)',
                        'layout' => 'device-stack',
                        'img' => '17.png',
                        'alt' => 'Réinitialisation usine',
                        'caption' => 'Appui long → <strong>Réinitialiser</strong>. La boîte doit être connectée à Internet pour se désinscrire.',
                    ],
                    [
                        'n' => '18',
                        'title' => 'Réinitialiser (app)',
                        'layout' => 'app-side',
                        'img' => '18.png',
                        'alt' => 'Suppression depuis l\'app',
                        'caption' => '<strong>Compte</strong> → Détail de la boîte → <strong>Réinitialiser et supprimer</strong>. Dissocie la boîte et envoie l\'ordre d\'effacement.',
                    ],
                    [
                        'n' => '19',
                        'title' => 'En cas de souci',
                        'layout' => 'text-only',
                        'caption' => 'Pas de Wi-Fi ? Ouvre <strong>Compte</strong> → <strong>Configurer le WiFi</strong> pour reconfigurer le réseau via Bluetooth. support@boite-a-coeur.fr',
                    ],
                ],
            ],
        ];
    }
}
