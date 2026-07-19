# Publication App Store / Play Store — Boîte à cœur

Guide de preparation des fiches produit, assets, conformite et comptes developpeur pour l'application mobile **Boîte à cœur** (`fr.techalchemy.boiteacoeur`).

---

## 1. Identifiants techniques a garder sous la main

| Element | Valeur actuelle |
|---------|-----------------|
| Nom public | Boîte à cœur |
| Bundle ID iOS | `fr.techalchemy.boiteacoeur` |
| Package Android | `fr.techalchemy.boiteacoeur` |
| Scheme deep link | `boiteacoeur://` |
| Callback OAuth natif | `boiteacoeur://oauth-callback` |
| API production | `https://boite-a-coeur.fr` |
| Site marketing | `https://boite-a-coeur.fr` |
| EAS project ID | `b46525a4-43c1-4fcd-aa74-61dc479b364c` |
| Editeur | Techalchemy |
| Contact support | support@boite-a-coeur.fr (a confirmer) |
| Politique de confidentialite | `https://boite-a-coeur.fr/confidentialite` |
| CGU | `https://boite-a-coeur.fr/cgu` |
| Mentions legales | `https://boite-a-coeur.fr/mentions-legales` |
| Suppression de compte | `https://boite-a-coeur.fr/delete-me` |

---

## 2. Comptes developpeur a ouvrir / maintenir

### Apple — Apple Developer Program
- Compte **Organisation** (125 EUR/an) de preference si marque Techalchemy
- Acces a **App Store Connect**
- Certificats, profils de provisioning, capabilities :
  - **Sign In with Apple** (obligatoire si Google/Facebook actifs)
  - **Access WiFi Information** (lecture SSID pour pre-remplissage WiFi)
  - Bluetooth (deja utilise pour provisioning BLE)

### Google — Google Play Console
- Compte developpeur (25 USD unique)
- Acces **Play Console** pour fiche, tests internes/fermes/ouvertes, production
- Compte **Google Cloud** pour OAuth Google (client Android + Web)

### Meta — Facebook Developers
- Application Facebook pour Login
- Lien avec compte Business Meta si publication ads plus tard

---

## 3. Textes de fiche store (a adapter / valider juridiquement)

### 3.1 Nom de l'application
- **Maximum** : 30 caracteres (App Store), 50 (Play Store)
- Proposition : **Boîte à cœur**

### 3.2 Sous-titre iOS (30 caracteres max)
Propositions :
- `Des mots d'amour a distance`
- `Messages sur ta boite connectee`

### 3.3 Description courte Play Store (80 caracteres max)
Proposition :
`Envoie des petits mots et des images sur la boite a coeur de tes proches.`

### 3.4 Description longue (FR)

```
Boîte à cœur te permet d'envoyer des messages, des dessins et des photos sur une boite connectee offerte a quelqu'un que tu aimes.

FONCTIONNALITES
- Composer des messages visuels (texte, emojis, images, GIF)
- Envoyer instantanement ou programmer un message
- Recevoir les messages que tes proches t'envoient
- Configurer le WiFi de ta boite via Bluetooth
- Scanner le QR code WiFi de ta box
- Gerer plusieurs boites et contacts
- Mettre a jour le firmware de ta boite (OTA)

CONFIGURATION SIMPLE
1. Cree ton compte (e-mail ou connexion Google / Apple / Facebook)
2. Active le mode configuration sur ta boite
3. Connecte le WiFi en 2,4 GHz depuis l'application
4. Envoie ton premier message

Boîte à cœur necessite une connexion Internet sur le telephone et sur la boite pour l'envoi des messages. Le provisioning WiFi utilise le Bluetooth a proximite de la boite.

Support : support@boite-a-coeur.fr
Politique de confidentialite : https://boite-a-coeur.fr/confidentialite
```

### 3.5 Mots-cles iOS (100 caracteres max, virgules)
Proposition :
`lovebox,boite,coeur,message,cadeau,couple,famille,connectee,wifi,bluetooth`

### 3.6 Categorie
- **App Store** : Style de vie (principale) ou Social Networking (secondaire)
- **Play Store** : Style de vie

### 3.7 Classification de contenu
- Pas de contenu choquant genere par l'editeur
- Contenu utilisateur : messages prives entre contacts approuves
- **Age** : 4+ / Tout public (ajuster si moderation insuffisante)
- Pas de gambling, pas d'achats in-app prevus en v1

---

## 4. Assets graphiques obligatoires

### 4.1 Icone
- Source actuelle : `assets/images/logo-lovebox.png`
- **iOS App Store** : 1024 x 1024 px, PNG, sans transparence, sans coins arrondis (Apple arrondit)
- **Play Store** : 512 x 512 px, PNG 32 bits
- Verifier lisibilite sur fond clair et fonce

### 4.2 Feature Graphic Android
- **1024 x 500 px**, JPG ou PNG 24 bits
- Bandeau horizontal avec logo + baseline marketing

### 4.3 Captures d'ecran

Preparer **6 a 8 captures** par plateforme, en **francais**, sur vrais appareils :

| Ecran | Message marketing suggere |
|-------|----------------------------|
| Accueil / liste boites | Toutes tes boites au meme endroit |
| Composition message | Cree un message unique |
| Envoi / planification | Envoie maintenant ou plus tard |
| Reception | Recois les mots de tes proches |
| Config WiFi BLE | Configure le WiFi en quelques secondes |
| Scan QR WiFi | Scanne le QR de ta box |
| Compte / profil | Gere ton compte en toute simplicite |
| Historique | Retrouve tes messages envoyes |

**Tailles iOS (iPhone 6,7")** : 1290 x 2796 px (ou equivalent generation recente)
**Tailles iPad** : si `supportsTablet: true`, ajouter captures 13" iPad
**Android** : minimum 2 captures, recommande 1080 x 1920 px (phone)

Astuce : utiliser le simulateur + export, ou Fastlane snapshot, ou captures manuelles sur device.

### 4.4 Video preview (optionnel mais recommande)
- **App Store** : 15–30 s, formats Apple (H.264, resolutions par device)
- **Play Store** : jusqu'a 30 s, YouTube ou upload direct
- Scenario : ouvrir app → composer message → boite qui affiche (filmage reel de la boite si possible)

---

## 5. Informations legales et conformite

### 5.1 URLs obligatoires
| Champ | URL |
|-------|-----|
| Politique de confidentialite | https://boite-a-coeur.fr/confidentialite |
| Conditions d'utilisation | https://boite-a-coeur.fr/cgu |
| Support | mailto:support@boite-a-coeur.fr ou page contact |
| Suppression de compte | https://boite-a-coeur.fr/delete-me |

### 5.2 App Store — App Privacy (nutrition labels)
Declarer les donnees collectees :

| Donnee | Usage | Liee a l'identite | Tracking |
|--------|-------|-------------------|----------|
| Adresse e-mail | Compte, auth | Oui | Non |
| Prenom | Personnalisation | Oui | Non |
| Identifiants OAuth | Connexion | Oui | Non |
| Contenu utilisateur (messages, images) | Fonctionnalite core | Oui | Non |
| Identifiants appareil (boite) | Pairing | Oui | Non |
| Donnees diagnostics (si ajoutees) | Stabilite | Selon implementation | Non |

### 5.3 Checklist conformite Apple (etat actuel)

| Exigence Apple | Etat actuel | Action |
|----------------|-------------|--------|
| Sign In with Apple si Google actif | OK | Maintenir |
| Suppression compte in-app ou URL | Lien Compte > Supprimer mon compte + `/delete-me` | OK |
| Privacy Nutrition Labels | Partiel (BLE, localisation, OAuth a mapper) | Completer avant soumission |
| Permission strings | OK | Revoir textes FR localisation/BLE |
| Access WiFi Information | Entitlement present, rebuild dev client requis | Une seule capability sur Apple Developer |
| Guideline 4.8 (login tiers) | OK avec Apple | Maintenir |
| Compte demo reviewer | Manquant | Creer dans App Store Connect |
| CGU / confidentialite accessibles | OK via legal-hub | Maintenir |
| OAuth register prenom + CGU | OK | Maintenir |
| Migration compte Apple relay | OK via e-mail contact verifie | Maintenir |

Permissions iOS a justifier dans la fiche :
- **Bluetooth** : configuration WiFi de la boite
- **Camera** : scan QR WiFi
- **Photos** : ajout d'images aux messages
- **Localisation (When In Use)** : lecture du SSID WiFi connecte (iOS l'exige)
- **Sign In with Apple** : authentification

### 5.3 Play Store — Data safety
Formulaire equivalent :
- Collecte : e-mail, nom, photos, messages, identifiants appareil
- Chiffrement en transit : Oui (HTTPS)
- Suppression de compte possible : Oui (URL delete-me)
- Donnees partagees avec tiers : OAuth providers uniquement si l'utilisateur choisit cette methode

### 5.4 Chiffrement export (App Store)
`ITSAppUsesNonExemptEncryption: false` deja dans app.json — repondre **Non** au questionnaire annuel sauf ajout de crypto custom.

### 5.5 RGPD
- DPO / contact : adresse Techalchemy
- Base legale : execution du contrat, consentement OAuth
- Hebergement : preciser hebergeur (OVH, etc.) dans la politique

---

## 6. Permissions Android — declarations Play Console

| Permission | Justification utilisateur |
|------------|---------------------------|
| BLUETOOTH_SCAN / CONNECT | Trouver et configurer la boite |
| ACCESS_FINE_LOCATION | Requis par Android pour scan BLE et SSID WiFi |
| CAMERA | Scanner QR code WiFi |
| READ_MEDIA / photos (via picker) | Ajouter des images aux messages |

Remplir le **Permission Declaration Form** pour Bluetooth et localisation si Google le demande (appareils connectes / geolocalisation approximative pour SSID).

---

## 7. Authentification OAuth — prerequis store

Voir `OAUTH_SETUP.fr.md` pour la configuration technique complete.

Regles App Store :
- Si **Google** ou **Facebook** sont proposes sur iOS, **Sign In with Apple** doit l'etre aussi (deja implemente).
- Tester les 3 flows sur device reel avant soumission.

Variables backend production a renseigner avant review :
- Google Client ID + Secret
- Apple Team ID, Key ID, cle privee, Services ID, Bundle ID natif
- Facebook App ID + Secret

Endpoint de verification :
`GET https://boite-a-coeur.fr/api/v1/auth/oauth/providers`
→ doit retourner `{"providers":["google","apple","facebook"]}` quand tout est configure.

---

## 8. Build et soumission

### 8.1 Versionning
- `app.json` → `version` : version marketing (ex. 1.0.0)
- iOS `CFBundleVersion` / Android `versionCode` : incrementer a chaque upload store

### 8.2 EAS Build
```bash
cd applications/mobile-rn
npx eas-cli build --platform ios --profile production
npx eas-cli build --platform android --profile production
```

Apres ajout de modules natifs (`expo-camera`, `expo-location`, `expo-apple-authentication`, `@react-native-community/netinfo`), **reconstruire le dev client et le build store**.

### 8.3 Test avant soumission
Checklist :
- [ ] Inscription e-mail + verification
- [ ] Connexion Google / Apple / Facebook
- [ ] Mot de passe oublie
- [ ] Provisioning BLE + pre-remplissage SSID
- [ ] Scan QR WiFi (format `WIFI:T:WPA;S:...;P:...;;`)
- [ ] Envoi message texte + image
- [ ] Reception message
- [ ] Suppression compte (delete-me)
- [ ] Liens legaux depuis l'app
- [ ] Comportement offline / erreurs reseau

### 8.4 Notes pour le reviewer Apple
```
Cette application accompagne une boite a coeur connectee (hardware ESP32).

Compte de test :
- E-mail : reviewer@... 
- Mot de passe : ...

Pour tester le WiFi/BLE sans hardware :
- La connexion OAuth et la navigation principale restent testables sans boite.

La boite necessite un reseau 2,4 GHz. Le scan QR WiFi accepte les codes standard WIFI:...
```

Fournir un **compte demo** avec au moins une boite deja associee si possible.

---

## 9. Fiche Play Store — champs specifiques

| Champ | Contenu |
|-------|---------|
| Titre | Boîte à cœur |
| Description courte | (voir 3.3) |
| Description complete | (voir 3.4) |
| Email developpeur | support@boite-a-coeur.fr |
| Site web | https://boite-a-coeur.fr |
| Politique de confidentialite | URL confidentialite |
| Categorie | Style de vie |
| Public cible | Tous publics |
| Contient des annonces | Non |
| Achats in-app | Non |
| Classification du contenu | Questionnaire IARC |
| Pays de distribution | France + pays cibles |

---

## 10. Fiche App Store Connect — champs specifiques

| Section | Contenu |
|---------|---------|
| Nom | Boîte à cœur |
| Sous-titre | (voir 3.2) |
| Texte promotionnel | 170 caracteres — message saisonnier modifiable sans nouvelle version |
| Description | (voir 3.4) |
| Mots-cles | (voir 3.5) |
| URL assistance | https://boite-a-coeur.fr ou mail support |
| URL marketing | https://boite-a-coeur.fr |
| Copyright | 2026 Techalchemy |
| Build | Upload via EAS ou Transporter |
| Tarification | Gratuit |
| Disponibilite | Pays souhaites |

---

## 11. Materiel marketing externe (hors store mais utile)

- Logo vectoriel SVG + PNG haute resolution
- Photo produit boite (packshot notice)
- QR code notice / manuel web
- Page `/manual` deja disponible sur le site
- Communiqué presse / fiche produit Amazon ou boutique si applicable

---

## 12. CE / conformite hardware (reference notice papier)

Elements deja sur notice — a harmoniser avec la fiche si vente UE :
- Marquage CE, DEEE, FCC (selon marche)
- Fabricant : Techalchemy, adresse
- Alimentation USB, 2,4 GHz WiFi, Bluetooth LE

---

## 13. Calendrier type de publication

1. Finaliser OAuth production + tests
2. Generer captures + feature graphic
3. Build production iOS + Android
4. Test interne (TestFlight + Play internal testing)
5. Beta fermee (optionnel)
6. Soumission review (prevoir 24–72 h Apple, quelques heures a jours Google)
7. Publication phased release recommandee

---

## 14. Maintenance post-publication

- Surveiller crash reports (ajouter Sentry/Firebase si souhaite)
- Repondre aux avis store sous 48 h
- Incrementer version a chaque correctif soumis
- Renouveler cle Apple Sign In (JWT) — expiration ~6 mois max par token genere, cle Apple valide 6 mois renouvelable dans le portail
- Verifier chaque annee questionnaire confidentialite Apple et Data safety Google

---

## 15. Contacts et liens utiles

- [App Store Connect](https://appstoreconnect.apple.com)
- [Google Play Console](https://play.google.com/console)
- [Apple Human Interface Guidelines — Sign in with Apple](https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple)
- [Expo EAS Submit](https://docs.expo.dev/submit/introduction/)
- Documentation OAuth projet : `OAUTH_SETUP.fr.md`
