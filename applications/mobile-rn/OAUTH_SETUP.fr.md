# Configuration OAuth — Boîte à cœur

Guide technique pour activer **Google**, **Apple** et **Facebook** en production (backend + mobile).

---

## Architecture

```
App mobile                    Backend API                      Provider
    |                              |                              |
    |-- Google/Facebook --------->| /auth/oauth/{p}/start        |--> OAuth web
    |   (Safari/Chrome custom)    |                              |
    |<-- boiteacoeur://oauth-callback?access_token=... ----------|
    |                              |                              |
    |-- Apple iOS (natif) -------->| POST /auth/oauth/apple/native|
    |   expo-apple-authentication |                              |
    |<-- JSON access_token ---------|                              |
```

Scheme natif : `boiteacoeur://oauth-callback`

Verification des providers actifs :
```
GET https://boite-a-coeur.fr/api/v1/auth/oauth/providers
→ {"providers":["google","apple","facebook"]}
```

---

## Variables d'environnement backend (.env)

```env
APP_URL=https://boite-a-coeur.fr

OAUTH_GOOGLE_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_SECRET=

OAUTH_APPLE_CLIENT_ID=
OAUTH_APPLE_NATIVE_CLIENT_ID=
OAUTH_APPLE_TEAM_ID=
OAUTH_APPLE_KEY_ID=
OAUTH_APPLE_PRIVATE_KEY=
OAUTH_APPLE_PRIVATE_KEY_PATH=

OAUTH_FACEBOOK_CLIENT_ID=
OAUTH_FACEBOOK_CLIENT_SECRET=
```

Notes :
- `OAUTH_APPLE_CLIENT_SECRET` n'est **plus utilise** : le backend genere un JWT ES256 automatiquement.
- `OAUTH_APPLE_PRIVATE_KEY` : contenu PEM avec `\n` echappes, OU laisser vide et utiliser `OAUTH_APPLE_PRIVATE_KEY_PATH`.
- `OAUTH_APPLE_NATIVE_CLIENT_ID` : Bundle ID iOS (`fr.techalchemy.boiteacoeur`). Si vide, fallback sur `OAUTH_APPLE_CLIENT_ID`.

---

## Google

### 1. Google Cloud Console
1. Creer un projet (ou utiliser existant)
2. **APIs & Services → OAuth consent screen**
   - Type : Externe
   - Nom : Boîte à cœur
   - E-mail assistance : support@boite-a-coeur.fr
   - Domaines autorises : `boite-a-coeur.fr`
   - Scopes : `openid`, `email`, `profile`
3. **Credentials → Create OAuth client ID**

### 2. Client Web (backend)
- Type : **Web application**
- Authorized redirect URIs :
  ```
  https://boite-a-coeur.fr/api/v1/auth/oauth/google/callback
  ```
- Copier **Client ID** → `OAUTH_GOOGLE_CLIENT_ID`
- Copier **Client secret** → `OAUTH_GOOGLE_CLIENT_SECRET`

### 3. Client Android (optionnel pour future auth native)
- Type : Android
- Package : `fr.techalchemy.boiteacoeur`
- SHA-1 : fingerprint du keystore release (EAS fournit le SHA-1 du build)

### 4. Tests
```
https://boite-a-coeur.fr/api/v1/auth/oauth/google/start?app=native&redirect_uri=boiteacoeur%3A%2F%2Foauth-callback
```

---

## Apple Sign In

### 1. Apple Developer — Identifiers

#### App ID (deja existant)
- Identifier : `fr.techalchemy.boiteacoeur`
- Capability : **Sign In with Apple** ✓
- Capability : **Access WiFi Information** ✓ (SSID pre-fill)

#### Services ID (flow web + callback backend)
1. Identifiers → **+** → Services IDs
2. Identifier : ex. `fr.techalchemy.boiteacoeur.web`
3. Activer **Sign In with Apple → Configure**
   - Primary App ID : `fr.techalchemy.boiteacoeur`
   - Domains : `boite-a-coeur.fr`
   - Return URLs :
     ```
     https://boite-a-coeur.fr/api/v1/auth/oauth/apple/callback
     ```
4. → `OAUTH_APPLE_CLIENT_ID` = Services ID

#### Key (.p8)
1. Keys → **+** → Sign In with Apple
2. Telecharger `AuthKey_XXXXXXXXXX.p8` (une seule fois)
3. Noter **Key ID** → `OAUTH_APPLE_KEY_ID`
4. Noter **Team ID** → `OAUTH_APPLE_TEAM_ID`

### 2. Backend .env
```env
OAUTH_APPLE_CLIENT_ID=fr.techalchemy.boiteacoeur.web
OAUTH_APPLE_NATIVE_CLIENT_ID=fr.techalchemy.boiteacoeur
OAUTH_APPLE_TEAM_ID=XXXXXXXXXX
OAUTH_APPLE_KEY_ID=XXXXXXXXXX
OAUTH_APPLE_PRIVATE_KEY_PATH=/chemin/securise/AuthKey_XXXXXXXXXX.p8
```

Ou inline (echapper les retours ligne) :
```env
OAUTH_APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGT...\n-----END PRIVATE KEY-----"
```

### 3. iOS natif
- `expo-apple-authentication` utilise le Bundle ID automatiquement
- `app.json` : `"usesAppleSignIn": true`
- Rebuild dev client / production apres activation capability

### 4. App Store Connect
- Activer **Sign In with Apple** sur la fiche app
- Obligatoire si Google ou Facebook sont visibles sur iOS

### 5. Endpoint natif
```
POST /api/v1/auth/oauth/apple/native
Content-Type: application/json

{
  "code": "<authorizationCode>",
  "id_token": "<identityToken>",
  "user": { "email": "..." }
}
```

---

## Facebook Login

### 1. Meta for Developers
1. [developers.facebook.com](https://developers.facebook.com) → Create App → Type **Consumer**
2. Ajouter produit **Facebook Login**

### 2. Settings → Basic
- App Domains : `boite-a-coeur.fr`
- Privacy Policy URL : `https://boite-a-coeur.fr/confidentialite`
- User Data Deletion : `https://boite-a-coeur.fr/delete-me`

### 3. Facebook Login → Settings
- Valid OAuth Redirect URIs :
  ```
  https://boite-a-coeur.fr/api/v1/auth/oauth/facebook/callback
  ```
- Client OAuth Login : Yes
- Web OAuth Login : Yes

### 4. .env
```env
OAUTH_FACEBOOK_CLIENT_ID=<App ID>
OAUTH_FACEBOOK_CLIENT_SECRET=<App Secret>
```

### 5. Mode Live
- Completer **App Review** si scopes au-dela du mode developpement
- Scopes utilises : `email`, `public_profile`
- Ajouter comptes test dans Roles → Test Users

---

## Mobile — fichiers concernes

| Fichier | Role |
|---------|------|
| `app.json` | scheme, plugins Apple/Camera/Location |
| `src/config/AppConfig.ts` | API_BASE, OAUTH_CALLBACK_PATH |
| `src/data/api/oauth.ts` | flows web + Apple natif iOS |
| `src/app/auth.tsx` | boutons OAuth dynamiques |

Rebuild obligatoire apres modification native :
```bash
npx eas-cli build --profile development --platform ios
npx eas-cli build --profile development --platform android
```

---

## Depannage

| Symptome | Cause probable | Action |
|----------|----------------|--------|
| Boutons OAuth absents | Providers non configures | Verifier GET `/auth/oauth/providers` |
| Google `redirect_uri_mismatch` | URI callback absente du client Google | Ajouter URL exacte callback |
| Apple `invalid_client` | JWT mal forme ou mauvais Team/Key ID | Verifier .p8 et variables |
| Apple pas d'e-mail | Deuxieme connexion Apple | E-mail dans id_token ou compte deja lie |
| Facebook app inactive | App en mode dev | Passer Live ou ajouter test user |
| Retour app sans tokens | state/redirect natif invalide | Verifier scheme `boiteacoeur` |
| `error=` dans callback | Provider a refuse | Lire message dans query error |

---

## Securite production

- Ne jamais committer `.p8`, secrets OAuth, mots de passe BDD
- Restreindre acces SSH / .env serveur
- HTTPS obligatoire sur `APP_URL`
- Renouveler cle Apple avant expiration (portail Developer)
- Monitorer `/auth/oauth/*` via logs rate-limit (deja 30 req/min)

---

## Checklist activation

- [ ] Google Web client + redirect URI
- [ ] Apple Services ID + Return URL + Key .p8
- [ ] Apple native client ID = Bundle ID
- [ ] Facebook app Live + redirect URI + privacy URL
- [ ] `.env` production rempli
- [ ] `GET /auth/oauth/providers` retourne les 3 providers
- [ ] Test iOS : Apple natif + Google web + Facebook web
- [ ] Test Android : Google web + Facebook web + Apple web (Safari/Chrome)
- [ ] Compte reviewer Apple documente dans App Store Connect
