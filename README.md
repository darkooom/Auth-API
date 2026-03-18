# Auth-API (Secure JWT Authentication)

Produktionsnahe Auth-API mit Node.js, Express und PostgreSQL.

## Features

- Registrierung mit Argon2 Password Hashing
- Login via Username **oder** E-Mail
- JWT Access + Refresh Token Flow (inkl. Rotation)
- Logout (Revocation des Refresh Tokens)
- Authenticated `me` Endpoint
- Passwortwechsel mit Session-Invalidierung
- API-Key Schutz für alle Auth/Admin Endpoints
- Parameterisierte SQL Queries (SQL-Injection Schutz)
- Auto-Setup der benötigten Tabellen beim Start

## Setup

1. Abhängigkeiten installieren:

```bash
npm install
```

2. Konfiguration erstellen:

```bash
cp .env.example .env
```

3. `.env` Werte setzen (insb. DB + JWT Secrets + API_KEY).

4. Server starten:

```bash
npm run dev
```

## Endpoints

### Public

#### `GET /`
- API Basisstatus

#### `GET /health`
- Healthcheck

---

### Auth (alle benötigen `x-api-key` Header)

#### `POST /auth/register`
```json
{
  "username": "demo_user",
  "email": "demo@example.com",
  "password": "VeryStrongPassword123!"
}
```

#### `POST /auth/login`
```json
{
  "identifier": "demo_user",
  "password": "VeryStrongPassword123!"
}
```
Response enthält:
- `accessToken`
- `refreshToken`
- `user`

#### `POST /auth/refresh`
```json
{
  "refreshToken": "<refresh-token>"
}
```
Gibt neues `accessToken` + rotiertes `refreshToken` zurück.

#### `POST /auth/logout`
```json
{
  "refreshToken": "<refresh-token>"
}
```

#### `GET /auth/me`
Benötigt:
- `x-api-key: <API_KEY>`
- `Authorization: Bearer <access-token>`

#### `POST /auth/change-password`
Benötigt:
- `x-api-key: <API_KEY>`
- `Authorization: Bearer <access-token>`

```json
{
  "currentPassword": "VeryStrongPassword123!",
  "newPassword": "AnotherStrongPassword456!"
}
```

---

### Admin (zusätzlich Bearer Token)

Alle `/admin/*` Endpoints benötigen:
- `x-api-key`
- `Authorization: Bearer <access-token>`

#### `GET /admin/users`
Liste aller Benutzer.

#### `GET /admin/users/:id`
Einzelnen Benutzer abrufen.

#### `PATCH /admin/users/:id`
```json
{
  "username": "new_username",
  "email": "new@example.com",
  "isActive": true
}
```

#### `DELETE /admin/users/:id`
Benutzer löschen.

## Security Hinweise

- Nutze lange, zufällige Secrets (`JWT_*_SECRET`, `API_KEY`)
- Nutze HTTPS in Produktion
- Begrenze Token-Laufzeiten in sicherheitskritischen Umgebungen
- Ergänze optional Rate Limiting und Audit Logging
