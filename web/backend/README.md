# Boite a Coeur API

PHP 8.1+ Slim 4 backend for mobile app and ESP32 cloud messaging.

## Local setup

```bash
cd web/backend
composer install
cp .env.example .env
```

Edit `.env` with MariaDB credentials and a strong `JWT_SECRET`.

## Database

MariaDB 10.6+ (InnoDB, utf8mb4). Import via phpMyAdmin or CLI:

```bash
mysql -u backend -p techalch_bac_prod < migrations/001_initial.sql
```

## Deployment (PulseHeberg / Plesk)

1. Upload `web/backend/` to `httpdocs/boiteacoeur/` via SFTP (see `.vscode/sftp.json`, context `web`).
2. Set Plesk document root to `httpdocs/boiteacoeur/public`.
3. Create `.env` on the server (never commit it).
4. Run migration SQL in Plesk MariaDB / phpMyAdmin panel.
5. SSH/FTP: `cd httpdocs/boiteacoeur && composer install --no-dev`.

### No SSH (Plesk Composer only)

1. Re-upload `composer.json` (uses `firebase/php-jwt ^7.0` — v6 is blocked by Composer security audit).
2. Plesk → domain → **PHP Composer** → directory `httpdocs/boiteacoeur` → **Install**.
3. If Composer is not available in Plesk: install deps on any machine with PHP+Composer, then upload the generated `vendor/` folder via SFTP.

`JWT_SECRET` in `.env` must be at least **32 characters** (64+ recommended) for php-jwt v7.

PHP limits on hosting: long poll max 25s, uploads up to 2 MB BACM payloads.

## API base

`https://boite-a-coeur.techalchemy.fr/api/v1`

## Device headers

- `X-Device-Uuid`: 128-digit uuid
- `X-Device-Secret`: secret from first register response

## Mobile auth

`Authorization: Bearer <access_token>`
