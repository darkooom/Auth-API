# Auth-API

Einbettbares Authentifizierungsmodul für Express-Anwendungen mit PostgreSQL, Argon2id sowie kurzlebigen JWT Access Tokens und rotierenden Refresh Tokens. Das Paket startet beim Import keinen Server und kann ähnlich einem Auth-Provider als Router und Middleware in eine vorhandene Anwendung eingebunden werden. Der mitgelieferte Standalone-Server ist lediglich ein optionales Beispiel.

## Als Modul verwenden

```js
const express = require('express');
const { Pool } = require('pg');
const { createAuthModule } = require('auth-api');

const app = express();
app.use(express.json());

const auth = createAuthModule({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  apiKey: process.env.AUTH_API_KEY,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  appUrl: 'https://app.example.com',
  smtp: {
    host: process.env.SMTP_HOST,
    port: 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  authPath: '/v1/auth',
  adminPath: '/v1/admin',
  exposeAdminApi: true,
});

await auth.initialize();
app.use(auth.router);

app.get('/private', auth.middleware.authenticate, (req, res) => {
  res.json({ userId: req.user.sub });
});
```

`createAuthModule()` liefert:

- `router`: frei mountbarer Express-Router mit allen Auth-Endpunkten
- `initialize()`: idempotente Initialisierung des Schemas
- `middleware.authenticate`: Bearer-Token-Prüfung für eigene Routen
- `middleware.authorize(...roles)`: rollenbasierter Schutz für eigene Routen
- `middleware.validateApiKey`: API-Key-Schutz für eigene Routen
- `close()`: beendet den intern erzeugten Pool; ein injizierter Pool bleibt Eigentum der Host-Anwendung

Mit `exposeAdminApi: false` kann die mitgelieferte Admin-HTTP-API vollständig deaktiviert werden. `authPath` und `adminPath` sind frei konfigurierbar. Alternativ können die Middleware über `require('auth-api/middleware')` importiert werden.

## Sicherheitsfunktionen

- Registrierung mit normalisierten E-Mail-Adressen und strenger Eingabevalidierung
- Argon2id-Passwort-Hashing und Passwortregeln (12–128 Zeichen, Groß-/Kleinbuchstaben, Zahl, Sonderzeichen)
- E-Mail-Verifizierung mit einmal verwendbaren, nur als SHA-256-Hash gespeicherten Tokens
- Login per Benutzername oder E-Mail; generische Antwort bei ungültigen Zugangsdaten
- Getrennte JWT-Secrets, Audience/Issuer-Prüfung und Refresh-Token-Rotation
- Erkennung wiederverwendeter Refresh Tokens mit Sperrung aller Sessions
- Passwort-vergessen/reset-Flow; Reset sperrt alle bestehenden Sessions
- Session-Verwaltung (anzeigen, einzeln oder vollständig widerrufen)
- Profil bearbeiten, Passwort ändern und eigenes Konto löschen
- Rollenbasierte Admin-Autorisierung mit aktueller Datenbankprüfung (`user`/`admin`)
- API-Key, Helmet, CORS-Allowlist und Rate Limits auf Auth-Endpunkten
- Parameterisierte SQL-Abfragen, eindeutige Datenbank-Constraints und keine Klartext-Speicherung sensibler Tokens

## Installation

```bash
npm install
cp .env.example .env
npm start
```

PostgreSQL muss erreichbar sein. Beim Start werden die benötigten Tabellen und Indizes idempotent angelegt. Der Start bricht bei fehlenden Variablen, Secrets unter 32 Zeichen, identischen JWT-Secrets oder fehlendem SMTP in Produktion bewusst ab. Setze in Produktion lange, unabhängige Werte für `API_KEY`, `JWT_ACCESS_SECRET` und `JWT_REFRESH_SECRET`, `NODE_ENV=production`, eine explizite `CORS_ORIGIN`-Allowlist und die SMTP-Variablen. Mehrere CORS-Origins werden kommasepariert angegeben.

In der Entwicklung werden E-Mail-Links in der Konsole protokolliert und das jeweilige Einmal-Token zusätzlich in der API-Antwort geliefert. In Produktion werden Tokens niemals ausgeliefert; ein SMTP-Server ist dort erforderlich.

## Authentifizierungsablauf

Alle `/auth`- und `/admin`-Aufrufe brauchen `x-api-key: <API_KEY>`. Geschützte Benutzer-Endpunkte brauchen zusätzlich `Authorization: Bearer <accessToken>`.

1. `POST /auth/register`
2. Token aus der E-Mail an `POST /auth/verify-email` senden
3. `POST /auth/login` und Access-/Refresh-Token sicher speichern
4. Access Token für geschützte Aufrufe nutzen
5. Nach Ablauf mit `POST /auth/refresh` beide Tokens ersetzen (das alte Refresh Token sofort verwerfen)
6. Beim Abmelden `POST /auth/logout` oder `POST /auth/logout-all` aufrufen

## Endpunkte

### Öffentlich

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/` | API-Status |
| `GET` | `/health` | Healthcheck |

### Auth

| Methode | Pfad | Bearer | Body / Beschreibung |
|---|---|---:|---|
| `POST` | `/auth/register` | Nein | `{ "username", "email", "password" }` |
| `POST` | `/auth/verify-email` | Nein | `{ "token" }` |
| `POST` | `/auth/resend-verification` | Nein | `{ "email" }` |
| `POST` | `/auth/login` | Nein | `{ "identifier", "password" }` |
| `POST` | `/auth/refresh` | Nein | `{ "refreshToken" }` |
| `POST` | `/auth/forgot-password` | Nein | `{ "email" }` |
| `POST` | `/auth/reset-password` | Nein | `{ "token", "newPassword" }` |
| `POST` | `/auth/logout` | Nein | `{ "refreshToken" }` |
| `POST` | `/auth/logout-all` | Ja | Sperrt alle Refresh Sessions |
| `GET` | `/auth/me` | Ja | Eigenes Profil |
| `PATCH` | `/auth/me` | Ja | `{ "username"?, "email"? }`; neue E-Mail muss erneut verifiziert werden |
| `DELETE` | `/auth/me` | Ja | `{ "password" }` |
| `POST` | `/auth/change-password` | Ja | `{ "currentPassword", "newPassword" }` |
| `GET` | `/auth/sessions` | Ja | Aktive Refresh Sessions |
| `DELETE` | `/auth/sessions/:id` | Ja | Eigene Session widerrufen |

### Admin

Admin-Routen prüfen die aktuelle Rolle bei jedem Aufruf in der Datenbank. Ein Access Token allein kann eine entzogene Adminrolle daher nicht behalten.

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/admin/users` | Benutzer auflisten |
| `GET` | `/admin/users/:id` | Benutzer laden |
| `PATCH` | `/admin/users/:id` | `username`, `email`, `isActive` und/oder `role` ändern |
| `DELETE` | `/admin/users/:id` | Benutzer und seine Tokens löschen |

Der erste Admin wird bewusst nicht über eine öffentliche Route erstellt. Weise die Rolle einmalig direkt in PostgreSQL zu:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

## Beispiel

```bash
curl -X POST http://localhost:5000/auth/login \
  -H 'content-type: application/json' \
  -H 'x-api-key: replace-with-random-api-key' \
  -d '{"identifier":"demo@example.com","password":"StrongPassword123!"}'
```

## Qualität

```bash
npm test
npm run check
```

Für horizontale Skalierung sollte das In-Memory-Rate-Limit durch einen gemeinsamen Store (zum Beispiel Redis) ersetzt werden. HTTPS, Secret Rotation, zentralisiertes Audit Logging und regelmäßige Dependency-/Datenbank-Backups bleiben Aufgaben der Deployment-Umgebung.
