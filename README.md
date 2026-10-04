# CivicFix AI

CivicFix helps citizens report civic issues with photos and locations, track public report IDs and timelines, receive private notifications, and see community impact. Municipal authorities triage reports, assign departments and officers, add operational notes, and record completion evidence. Analytics and seeded demo reports retain the existing interface.

## Architecture

React/Vite → tRPC → Express → Drizzle → MySQL. Native authentication, provider-based vision analysis and local/S3 storage run on the server. Google Maps loads directly in the browser. Citizen report creation requires authentication; authority operations require an admin role on the server.

## Prerequisites and installation

Use Node.js 22.12+ (Node 24 is supported), pnpm 10, and MySQL 8.0+. Commands work in PowerShell and typical Unix shells unless marked otherwise.

```sh
npm install --global pnpm@10.4.1
pnpm install --frozen-lockfile
```

Create the database using the MySQL client:

```sh
mysql -u root -p
```

```sql
CREATE DATABASE civicfix CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'civicfix'@'localhost' IDENTIFIED BY 'replace-with-a-strong-password';
GRANT ALL PRIVILEGES ON civicfix.* TO 'civicfix'@'localhost';
```

PowerShell environment setup:

```powershell
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

On Unix, use `cp .env.example .env` instead. Edit `.env`: set the actual MySQL credentials and paste the generated secret into `JWT_SECRET`. URL-encode special characters in the database password. The placeholder secret is intentionally rejected at startup.

```sh
pnpm db:migrate
pnpm dev
```

Open `http://localhost:3000`. Development can select the next free port; production uses the configured port exactly. Database connectivity and demo seeding are checked before accepting requests. Public demo content is stored in the same database; persistence failures surface as errors.

## Authentication and first administrator

Click **Sign in**, then **Create an account**. Passwords require at least 12 characters and at most 72 UTF-8 bytes; they are stored as bcrypt hashes with cost 12. Sessions are HS256 JWTs with issuer, audience, expiration and a database session record. Cookies are HTTP-only, SameSite=Lax, Path=/ and Secure in production. Logout deletes the session record and clears the cookie. Password hashes never enter API responses. API mutations enforce same-origin browser requests; authentication and upload requests are rate-limited.

Set `ADMIN_EMAILS=admin@civicfix.local` (comma-separated normalized addresses) before registering your first admin. Only explicitly listed addresses receive the bootstrap admin role. Use addresses controlled by your deployment operator and register them before exposing the deployment publicly: email verification is not implemented. Role values are read from MySQL for every authenticated request.

## Database migrations and existing installations

```sh
pnpm db:migrate
# For future schema changes only:
pnpm db:generate
```

`db:push` is retained as an alias for applying checked-in migrations; it no longer generates migrations during deployment. Drizzle tracks applied migrations in MySQL. Back up an existing database before applying schema changes; MySQL DDL is not fully transactional.

Migration `0003_fluffy_warpath.sql` adds `authSessions`, replaces external user identity columns with `passwordHash`, normalizes emails, and makes email unique. User numeric IDs and every civic table are preserved. Missing emails and duplicate email accounts receive `legacy-<id>@migration.invalid`; the oldest account keeps its normalized email. Inspect these accounts and establish ownership before assigning real addresses. Existing users are disabled for password login until the operator sets a hash. Existing roles are reset to user; the allowlist can bootstrap verified administrators again. No default passwords are created and duplicate registration cannot take over existing accounts.

For an existing migrated account, use this interactive server-side command (password input is hidden):

```sh
pnpm account:password admin@civicfix.local
```

This preserves the user's ID, sets a new hash, applies the bootstrap admin allowlist, and revokes prior sessions. It requires database credentials on the operator's machine. There is no public password-reset endpoint.

Existing externally hosted evidence must be downloaded into the new storage backend and its database keys/URLs updated by the operator. This code migration cannot retrieve old private objects without the original storage credentials. Report records and original evidence references are preserved in the database. Such images cannot be automatically compared until moved into controlled storage.

## AI configuration

Set `AI_API_KEY`, `AI_BASE_URL` (the versioned API base, e.g. your provider's `/v1` URL), and `AI_MODEL`. The provider must support vision chat completions and JSON-schema structured responses. `server/services/ai/provider.ts` isolates the wire protocol; other providers can be implemented here without changing civic business logic. No model discovery or browser-visible AI credentials are used.

Issue and verification results are validated with Zod against CivicFix enums, numeric ranges and text limits. Missing configuration, provider outages or invalid model JSON produce deterministic guided routing with zero AI confidence and an explicit review message. An unknown hint routes to Other/Public Works. Original/after evidence is compared by the configured vision model. Unavailable or uncertain verification produces a zero-score manual-review state; it never fabricates successful verification. Authorities can still close reports with a note, while the verification panel continues to show manual review.

## Maps configuration

Set `VITE_GOOGLE_MAPS_API_KEY` to enable the official Google Maps JavaScript API, markers, geocoding and selection. Enable the necessary Google APIs and restrict the browser key by allowed website referrers and API scope. This is the only browser configuration variable. Refer to [Google's setup guide](https://developers.google.com/maps/documentation/javascript/get-api-key).

Missing keys or loading failures show the existing location preview. Manual address, latitude/longitude, device location, duplicate detection and submission remain available. Rebuild the client after changing the maps key. Never put database, session, AI or storage secrets in `VITE_` variables.

## Local and private Supabase S3 storage

Local development defaults to `STORAGE_DRIVER=local`, `UPLOAD_DIR=./uploads`. Evidence uses UUID filenames in a server-controlled directory. JPEG, PNG and WebP are limited to 5 MB and validated by MIME type, size and content signature. Keys reject traversal and absolute paths. Persist and back up the upload directory; do not allow other processes to add symbolic links or modify it.

For Supabase, keep the existing `civicfix-evidence` bucket **private**, enable its S3 connection and generate an S3 access-key pair in Storage settings. Use this exact server configuration, replacing only the project reference and credential placeholders:

```dotenv
STORAGE_DRIVER=s3
S3_BUCKET=civicfix-evidence
S3_REGION=ap-northeast-1
S3_ENDPOINT=https://<project-ref>.storage.supabase.co/storage/v1/s3
S3_ACCESS_KEY_ID=<generated-supabase-s3-access-key-id>
S3_SECRET_ACCESS_KEY=<generated-supabase-s3-secret-access-key>
AWS_REQUEST_CHECKSUM_CALCULATION=WHEN_REQUIRED
```

Copy the endpoint and region from the project's S3 configuration; the region above must match that project. Supply the generated S3 keys, not a Supabase publishable/anon/service-role API key. S3 access keys bypass Supabase RLS and stay server-side; CivicFix enforces permissions using its own MySQL-backed sessions and report ownership. No Supabase Auth integration or database migration is needed for this storage configuration. See [Supabase S3 authentication](https://supabase.com/docs/guides/storage/s3/authentication).

The AWS client preserves `/storage/v1/s3` and enables path-style addressing for custom endpoints. Request checksums default to `WHEN_REQUIRED` so presigned browser PUTs do not contain the SDK's empty-body CRC32. `AWS_REQUEST_CHECKSUM_CALCULATION=WHEN_REQUIRED` is explicitly supported; `WHEN_SUPPORTED` remains an override for providers that need it and should not be used for this Supabase configuration. See [AWS checksum configuration](https://docs.aws.amazon.com/sdkref/latest/guide/feature-dataintegrity.html).

Evidence URLs remain `/uploads/<key>`. Each request validates the current login session and checks that the requester is the report owner or an administrator. S3 requests redirect to a five-minute signed GET URL, so evidence bytes bypass Vercel's function response limit. Local requests serve the validated file after the same permission check. Responses use `private, no-store`; redirects also use `Referrer-Policy: no-referrer`. Anonymous requests return 401, and unauthorized or unlinked keys return 404. Signed S3 URLs are temporary bearer links: anyone given one can use it until it expires, so do not share them or log their query strings.

Public dashboard, tracking and duplicate queries retain report details but remove evidence URLs and keys unless the viewer is the owner or an admin. Existing stored public URLs are replaced in API responses by authenticated application URLs derived from the stored keys. Legacy evidence records without a storage key are hidden until an operator restores the correct key. `S3_PUBLIC_URL` is no longer consumed or required, including on Vercel; remove it from deployment configuration.

Citizen images retain direct browser-to-S3 presigned PUT uploads (five-minute expiry, signed image type and length). A one-hour signed upload receipt binds draft analysis and submission to the issued key, preserving analysis before sign-in without allowing arbitrary private-key reads. If the receipt expires during review, analyze/upload the photo again. The receipt never enters the database or public report queries. Local development retains inline image upload. Authority resolution evidence uses the existing authenticated optimized server upload, with presigned PUT support still available through the authority API.

Before analysis/submission, the server reads and validates the stored image. AI analysis and authority before/after verification receive five-minute signed private-object GET URLs; local evidence becomes a server-side data URL. The vision provider must support HTTPS image URLs and fetch them before expiry. Missing configuration or provider failures retain the existing conservative routing/manual-review fallback. For direct browser uploads, the endpoint must allow CORS for `PUT` and the `Content-Type` request header from production and enabled preview origins. Supabase implements [S3 uploads and query-signed requests](https://supabase.com/docs/guides/storage/s3/compatibility); verify browser preflight and PUT behavior on the deployed origin. Do not attempt to manage Supabase CORS using AWS `PutBucketCors`, which that compatibility table marks unsupported.

## Production

Provision MySQL, set `.env` or real process environment, choose durable storage, and run:

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm check
pnpm test
pnpm build
pnpm start
```

Terminate HTTPS at your reverse proxy and preserve the browser Host/Origin. Production session cookies require HTTPS. Install build dependencies for the build stage; the bundled server imports runtime dependencies. Configure your process manager's working directory to this project so `.env`, static assets and local uploads resolve correctly. Deploy the newly generated `dist` alongside runtime dependencies and environment configuration.

## Environment reference

Required: `DATABASE_URL`, `JWT_SECRET`. Defaults: `NODE_ENV=development`, `PORT=3000`, `STORAGE_DRIVER=local`, `UPLOAD_DIR=./uploads`. Optional admin: `ADMIN_EMAILS`. Optional vision: `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` together. S3: `S3_BUCKET`, `S3_REGION`, optional `S3_ENDPOINT` (required for Supabase), credential pair, and optional `AWS_REQUEST_CHECKSUM_CALCULATION` (defaults to `WHEN_REQUIRED`). `S3_PUBLIC_URL` is ignored. Browser: optional `VITE_GOOGLE_MAPS_API_KEY`. `.env.example` contains every variable consumed by this implementation, with no real secrets.

## Tests and troubleshooting

```sh
pnpm check
pnpm test
pnpm build
```

Tests cover authentication, cookie/session behavior, owner/admin evidence authorization, public API evidence redaction, upload receipts, Supabase endpoint/region/path-style signing, checksum defaults, private Vercel startup, civic routing and tracking, duplicates, structured AI validation/fallbacks and image/storage safety. Unit tests use database/provider doubles; they do not substitute for applying migrations and exercising workflows against your own MySQL and configured cloud services.

- Startup configuration error: copy `.env.example`, set a real database URL and a random secret; migrations are explicit.
- MySQL access/connectivity failure: verify service, credentials, database name and network permissions. Apply `pnpm db:migrate` before starting.
- Existing login fails after migration: confirm ownership and run `pnpm account:password <email>`.
- Admin controls unavailable: check normalized `ADMIN_EMAILS` and sign in again, or use the operator password command for a migrated account.
- AI manual review: check that all three AI variables are set and the provider supports vision and JSON schema. Reports remain usable.
- Map preview fallback: check the restricted browser key and Google billing/API settings; use manual coordinates meanwhile.
- Upload failure: check MIME/content/size, local directory permissions, or S3 bucket/credentials and CORS for direct PUT.
- Production cookies missing: serve over HTTPS. Cross-origin browser API requests are intentionally denied.
- Build dependency script warning: dependencies may require approved native build scripts on your platform; approve only the installed packages you trust.

## Vercel deployment

The root `index.ts` is Vercel's recognized Express entrypoint; it exports the app without listening on a port. `vercel.json` selects Express, runs `pnpm build`, and rewrites SPA routes to `/index.html` while leaving API/evidence paths untouched. Vite emits frontend files into root `public/`, which Vercel serves from its CDN. The local server remains `server/_core/index.ts`, and the local production bundle remains `dist/index.js`. No Vercel Start Command, custom adapter, separate API project, or continuously running server is required. Select Node.js 24.x (22.x is also supported). Do not override the Output Directory; Express uses root `public/` for static assets.

Provision a reachable MySQL database and keep the Supabase `civicfix-evidence` bucket private. Apply the checked-in migrations with `pnpm db:migrate` from an operator machine configured with the production `DATABASE_URL`; do not run migrations on every function invocation. Set these variables in Vercel **Production** before deployment:

```text
DATABASE_URL
JWT_SECRET
ADMIN_EMAILS
STORAGE_DRIVER=s3
S3_BUCKET=civicfix-evidence
S3_REGION=ap-northeast-1
S3_ENDPOINT=https://<project-ref>.storage.supabase.co/storage/v1/s3
S3_ACCESS_KEY_ID=<generated-supabase-s3-access-key-id>
S3_SECRET_ACCESS_KEY=<generated-supabase-s3-secret-access-key>
AWS_REQUEST_CHECKSUM_CALCULATION=WHEN_REQUIRED
AI_API_KEY, AI_BASE_URL, AI_MODEL (together, if using vision)
VITE_GOOGLE_MAPS_API_KEY (optional; exposed in the browser at build time)
```

Use production credentials only in the Production environment. If enabling Preview deployments, provide separate Preview database, storage, JWT and provider credentials; never point previews at production data. Do not set `UPLOAD_DIR` or rely on local uploads. `NODE_ENV` is set to production by the Vercel entrypoint; `PORT` and `pnpm start` are not used there. A missing required secret/database/S3 configuration fails clearly at function initialization.

Do not set `S3_PUBLIC_URL` or make the bucket public. Vercel startup requires S3 storage and validates bucket/region and credential pairing; it no longer requires a public evidence URL. Verify browser CORS/preflight for `PUT` with `Content-Type` from the production origin and each enabled Preview origin. The browser sends up to 5 MB directly to S3, then the API validates the stored object and analyzes it. Authenticated evidence requests return a short-lived signed S3 redirect rather than proxying image bytes through the function. These paths avoid Vercel's function body/response size limits. The existing authority upload remains optimized to at most 100 KB. Restrict the Maps key to production/preview origins in Google Cloud.

Set the Vercel project Root Directory to the repository root, Framework Preset to Express, Build Command to `pnpm build`, and leave Output Directory and Start Command unset. Deploy from the Vercel dashboard or `vercel --prod` after configuration. The first request validates MySQL connectivity and seeds demo data. Function instances reuse a bounded MySQL pool; startup state does not rely on a persistent process. Existing evidence stored only on a previous server's local disk must be moved to the private bucket using the same stored object keys. Records with keys need no URL rewrite in the database; the API derives authenticated URLs when reading them. Records lacking keys need operator reconciliation before their images can be retrieved securely.

After deployment, verify owner and admin image access, anonymous/wrong-owner denial, citizen presigned PUT and AI analysis, and authority resolution comparison against the real services. Unit tests and a local production build do not prove live Supabase credentials, CORS, MySQL connectivity or Vercel operation.

See `MIGRATION.md` for the implementation inventory and verification results.

## Backend ESM import convention

Backend relative imports, re-exports and dynamic imports use explicit `.js` specifiers in TypeScript source. TypeScript and `tsx` resolve these to the matching `.ts` sources locally; emitted JavaScript resolves directly in native Node. Backend imports must not use frontend `@/` or `@shared/` aliases. Node requires [explicit extensions for relative ESM imports](https://nodejs.org/api/esm.html#mandatory-file-extensions); TypeScript documents [extension substitution](https://www.typescriptlang.org/docs/handbook/modules/reference#file-extension-substitution).

`pnpm check` includes the separate NodeNext backend configuration in `tsconfig.server.json`, while frontend checking retains bundler resolution. `pnpm test` includes an unbundled native-Node serverless-entrypoint smoke test and a local `tsx`/Vite import check. `pnpm build` emits `dist/index.js` and its optional `dist/vite.js` companion; Vercel continues using the root `index.ts` Express entrypoint. See MIGRATION.md for the complete import audit and changed-file inventory.
