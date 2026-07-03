# Deployment checklist — boite-a-coeur.techalchemy.fr

## 1. MariaDB 10.6 (Plesk)

- Database: `techalch_bac_prod`
- User: `backend`
- Import [`backend/migrations/001_initial.sql`](backend/migrations/001_initial.sql) via phpMyAdmin or Databases panel
- `.env`: `DB_PORT=3306`

## 2. Backend files

Upload [`web/backend/`](backend/) to `httpdocs/boiteacoeur/` via SFTP (VS Code context `web`).

On server:

```bash
cd httpdocs/boiteacoeur
composer install --no-dev
```

## 3. Environment

Create `httpdocs/boiteacoeur/.env` from [`.env.example`](backend/.env.example):

- `DB_PASSWORD` — use server credentials (rotate if exposed in chat)
- `JWT_SECRET` — random 64+ chars
- `APP_URL=https://boite-a-coeur.techalchemy.fr`

## 4. Plesk Apache

**Critical:** the subdomain must not serve the Plesk default page.

1. Plesk → **Websites & Domains** → `boite-a-coeur.techalchemy.fr`
2. **Hosting Settings** → Document root: `httpdocs/boiteacoeur` (repo bootstrap via root `index.php`)
   - Alternative: `httpdocs/boiteacoeur/public` → then sim is `/sim/` (no `/public/` prefix)
3. PHP **8.1+** FPM enabled for this vhost

With document root **`httpdocs/boiteacoeur`** (not `public/`):

| URL | Files on disk |
|-----|----------------|
| `/public/sim/` | `public/sim/` |
| `/public/updates/` | `public/updates/` (admin OTA UI) |
| `/updates/1.0.1/firmware.bin` | `updates/1.0.1/firmware.bin` (device download) |
| `/api/v1/...` | Slim API via `index.php` |

OTA env (filesystem path, not URL):

```env
OTA_STORAGE_PATH=
OTA_PUBLIC_URL=https://boite-a-coeur.techalchemy.fr
OTA_ADMIN_KEY=<random-secret>
```

Empty `OTA_STORAGE_PATH` → defaults to `updates/` next to `index.php`.

Admin OTA UI (`/public/updates/`) and API routes `/api/v1/updates/*` require header `X-Ota-Admin-Key` matching `OTA_ADMIN_KEY`. The browser UI stores the key in `localStorage` after first prompt.

4. After upload, verify:

```bash
curl https://boite-a-coeur.techalchemy.fr/health
```

Expected: `{"ok":true,"service":"boite-a-coeur-api"}`

If you still see the Plesk default page, the document root is wrong or files were not uploaded to the path Plesk uses.

## 5. Smoke tests

```bash
curl -X POST https://boite-a-coeur.techalchemy.fr/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

curl https://boite-a-coeur.techalchemy.fr/invite/test-token
```

## 6. Firmware

Flash updated firmware with `BacCloudClient`. After WiFi connect, serial should show `Bac: cloud registered`.

## 7. Android app

Point `AppConfig.API_BASE` to production URL (default already set).

Build: `applications/mobile` → `./gradlew :androidApp:assembleDebug`

## 8. End-to-end

1. Register in app
2. BLE provision WiFi
3. Claim device by name (shown on box screen during setup)
4. Partner invite link or request
5. Send message from composer
6. Box receives via long poll → `new_message` screen
