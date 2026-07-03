# Boite a Coeur API

PHP 8.1+ Slim 4 backend for the Expo mobile app, browser sim, and ESP32 cloud client.

## Local setup

```bash
cd web/backend
composer install
cp .env.example .env
```

Edit `.env` with MariaDB credentials and a strong `JWT_SECRET`.

## Database

MariaDB 10.6+ (InnoDB, utf8mb4). Apply migrations in order:

```bash
mysql -u backend -p techalch_bac_prod < migrations/001_initial.sql
mysql -u backend -p techalch_bac_prod < migrations/002_password_reset.sql
mysql -u backend -p techalch_bac_prod < migrations/003_message_lifecycle.sql
```

On MariaDB, if `003` fails on `DROP CHECK`, use `DROP CONSTRAINT` instead (see comments in the migration file).

Admin helpers (manual ops only): `migrations/admin/`.

## Deployment (PulseHeberg / Plesk)

1. Upload `web/backend/` to `httpdocs/boiteacoeur/` via SFTP.
2. Set Plesk document root to `httpdocs/boiteacoeur/public`.
3. Create `.env` on the server (never commit it).
4. Run migration SQL in Plesk MariaDB / phpMyAdmin.
5. SSH/FTP: `cd httpdocs/boiteacoeur && composer install --no-dev`.

### No SSH (Plesk Composer only)

1. Re-upload `composer.json` (uses `firebase/php-jwt ^7.0`).
2. Plesk → domain → **PHP Composer** → directory `httpdocs/boiteacoeur` → **Install**.
3. If Composer is not available in Plesk: install deps locally, then upload `vendor/` via SFTP.

`JWT_SECRET` in `.env` must be at least **32 characters** (64+ recommended).

PHP limits on hosting: long poll max 25s, uploads up to 2 MB BACM payloads.

## API base

`https://boite-a-coeur.techalchemy.fr/api/v1`

## Mobile auth

`Authorization: Bearer <access_token>`

- `POST /auth/login`, `/auth/register`, `/auth/refresh`
- `POST /auth/forgot-password` — sends reset email when SMTP is configured

## Messages (mobile)

- `POST /messages?target_device_id={id}` — raw BACM body (`application/octet-stream`)
- `POST /messages?target_device_id={id}&ephemeral=1` — 10 s display, no sent log entry
- `GET /messages/sent` — history with `status`, `received_at`, `opened_at`, `seen_at`

Message statuses: `queued` → `delivering` → `received` → `opened` → `seen`.

## Device cloud client

Headers on every device request:

- `X-Device-Uuid`: 128-digit uuid
- `X-Device-Secret`: secret from first register response

| Endpoint | Role |
| --- | --- |
| `GET /devices/poll?timeout=25` | Long-poll next queued message (BACM body + `X-Message-Id`, `X-Display-Duration-Sec`) |
| `POST /devices/messages/{id}/ack` | Device received BACM |
| `POST /devices/messages/{id}/opened` | User opened on box |
| `POST /devices/messages/{id}/seen` | User dismissed / ephemeral timeout |
| `POST /devices/messages/{id}/nack` | Parse failure, requeue |

Only one active message per device at a time (`delivering`, `received`, or `opened`).

## Browser sim

Static UI under `public/sim/` — login, pairing, BACM composer, send to linked box.
