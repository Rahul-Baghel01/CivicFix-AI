# CivicFix independence migration

The existing React/Vite/Express/tRPC/Drizzle/MySQL product is preserved. No pages or visual identity were replaced. Civic tables, numeric user references, public report IDs, duplicate matching, tracking, timelines, notifications, assignment/status/resolution workflows, analytics and demo seeding remain in place. Authentication is a native dialog, preserving report drafts when sign-in is needed. Manual coordinates are editable when maps cannot load.

The missing civic analyzer was recovered from the archived server bundle before rebuilding it. All fourteen issue profiles, the analysis schema, hint fallback, issue analysis and before/after verification are now TypeScript source. The fallback was corrected to use zero AI confidence and manual resolution review. Generated output is rebuilt from source and is not used as a source dependency.

## Important files added

- `server/services/auth.ts`: registration, bcrypt login, safe user projection, signed sessions and logout revocation.
- `server/services/ai/provider.ts`: server-only vision adapter with configured model and validated structured results.
- `server/services/ai/civicIssueAnalyzer.ts`: recovered profiles, civic analysis schema, deterministic hint routing and conservative resolution comparison.
- `server/services/images.ts`: supported image types, size and content-signature/base64 validation.
- `server/services/storageAdapter.ts`: local and S3 storage, safe keys, signed/public GET, authorized local prepared uploads and S3 presigned PUT.
- `server/_core/storageRoutes.ts`: neutral evidence serving and authenticated authority uploads.
- `server/_core/security.ts`: same-origin mutation enforcement.
- `server/_core/static.ts`: production frontend serving without development dependencies.
- `client/src/components/CivicAuthDialog.tsx`: native sign-in/registration using existing UI primitives.
- `scripts/set-account-password.ts`: hidden-input operator password setup for migrated accounts, with session revocation.
- `drizzle/0003_fluffy_warpath.sql`, `drizzle/meta/0003_snapshot.json`: preserving identity migration and new session table.
- `server/auth.test.ts`, `server/ai.test.ts`, `server/storage.test.ts`, `server/workflow.test.ts`, `server/config.test.ts`: new regression coverage.
- `.env.example`, `README.md`, `MIGRATION.md`: complete configuration, commands, operational guidance and change inventory.

## Important files removed

Unused external-platform infrastructure was audited and removed: OAuth callback/SDK, platform user types, heartbeat scheduling, generic data APIs, owner notification, image generation, voice transcription, server maps proxy, generic LLM/model discovery and the storage proxy. The old branded login dialog, browser debug collector/version assets and obsolete Vite backup were removed. Dependency and lock entries for the runtime/debug plugins were removed. No civic business module or civic table was deleted.

## Important files modified

- `package.json`, `pnpm-lock.yaml`: runtime dependencies, portable Node scripts, explicit migration commands, password operator command and independent build.
- `vite.config.ts`: normal React/Tailwind configuration, localhost hosts, removal of injected runtime/debug infrastructure.
- `server/_core/index.ts`: validated startup, connectivity check, deterministic seeding, independent routes, rate limits and conditional development-server import.
- `server/_core/context.ts`, `server/_core/cookies.ts`, `server/_core/env.ts`, `server/_core/systemRouter.ts`: native session context, requested cookie behavior, configuration validation and neutral health procedure.
- `server/_core/vite.ts`: localhost development host handling.
- `server/db.ts`: native user queries and explicit database requirements.
- `server/routers.ts`: native auth procedures, validated storage evidence and preserved civic/authority routing and authorization.
- `server/storage.ts`: stable exports over the new storage adapter.
- `server/civicDb.ts`: idempotent demo/department seeds; the civic workflows are retained.
- `drizzle/schema.ts`, `drizzle/meta/_journal.json`, `drizzle.config.ts`: native user/session schema, migration tracking and dotenv loading.
- `client/src/App.tsx`, `client/src/main.tsx`, `client/src/const.ts`, `client/src/_core/hooks/useAuth.ts`: native dialog integration and cookie-based sessions without browser token mirrors.
- `client/src/components/Map.tsx`: direct official maps loading, missing-key/error/authentication/timeout fallback.
- `client/src/pages/ReportIssue.tsx`: editable fallback coordinates; existing layout and report builder retained.
- `client/src/pages/AuthorityDashboard.tsx`: native administrator access language.
- `client/index.html`: obsolete injected analytics variables removed; viewport zoom accessibility preserved.
- `shared/const.ts`, `template.json`, `.gitignore`: independent session/constants/metadata and uploads exclusion.
- `server/auth.logout.test.ts`, `server/civic.test.ts`, `server/cookies.test.ts`: native fixtures and development/production cookie expectations.
- `tsconfig.json`: check tests and operator scripts in addition to application source.
- `dist/index.js`, `public/*`: regenerated independent local server and CDN-ready browser production output.

## Architecture and migration

Authentication uses normalized unique email, bcrypt cost 12 and seven-day signed HTTP-only cookies. Database session records provide logout revocation; current roles are loaded server-side. Registration cannot accept an arbitrary admin role. The configured admin-email allowlist supports bootstrap. Password hashes never enter session or API user objects. Bcrypt's UTF-8 byte limit is validated, following the [password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

Vision uses the configured provider/model with no discovery service. Application functions use CivicFix constants and Zod validation. Local evidence is converted to data URLs server-side; private S3 GET URLs are signed. Invalid output and outages fall back conservatively without blocking submission.

Storage supports UUID local files and S3-compatible buckets using the existing AWS SDK. File type/size/signatures and storage paths are checked. Authority evidence must belong to that account's namespace and is validated before use. S3 credentials remain server-side. Local prepared-upload tickets preserve their issued keys and reject mismatched user/type/length and repeat writes.

Maps loads the official browser JavaScript endpoint using the restricted browser key. Markers/geocoding/selection remain. Without it, address and coordinate entry and report submission continue.

Migration 0003 preserves every user numeric ID and all civic tables. It normalizes/uniquifies emails, replaces external identity columns with nullable hashes for disabled legacy accounts, resets legacy authority roles for explicit bootstrap, and adds session records. Missing/duplicate/reserved-placeholder emails receive unique reserved migration addresses. A server operator must verify ownership and initialize migrated passwords; report ownership remains tied to original IDs. See README for exact setup/production commands and all environment variables.

## Verification and limitations

Dependency installation succeeded; frozen lockfile validation also succeeded. Migration generation completed and a second generation reports no schema changes. Type checking includes source, tests and the password operator script. Unit tests cover registration/login/logout, invalid credentials and tokens, session revocation, authority denial, report routing/tracking, duplicate matching, AI schema failures/fallbacks, manual verification, image validation, path safety and prepared uploads.

Live MySQL migration and browser workflows were not executed: no database/environment was supplied and the Docker daemon is unavailable. Cloud integrations were validated through code/tests and require real S3, vision-provider and Google Maps credentials for live verification. Old private evidence cannot be transferred without source object access; existing report records/references are retained. Existing accounts need operator password initialization. Email verification, public password reset and MFA are not implemented. The frontend retains its existing bundle size warning; chunk splitting would be a separate performance change.

Final results:

| Check                                                                                   | Result                                                                             |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm install`                                                                          | Passed                                                                             |
| Frozen lockfile validation (`pnpm install --lockfile-only --frozen-lockfile --offline`) | Passed                                                                             |
| `pnpm check`                                                                            | Passed, including tests and operator script                                        |
| `pnpm test`                                                                             | 56 tests passed across 9 files after Vercel readiness checks                      |
| `pnpm build`                                                                            | Passed; server and browser output regenerated                                      |
| `pnpm db:generate`                                                                      | Passed; follow-up generation found no schema changes                               |
| Production configuration guard                                                          | Confirmed: unconfigured startup exits with explicit missing database/secret errors |
| Live MySQL migration/startup                                                            | Not run: no configured database; Docker daemon unavailable                         |
| Final obsolete-platform identifier and filename scan                                    | Zero matches, including generated output                                           |

The final scan includes hidden/ignored project files, source, configuration, lockfile, documentation, tests, public assets and regenerated `dist`. Only installed third-party dependencies and version-control internals are excluded. Production startup without configuration fails explicitly rather than accepting requests or pretending to persist data.

## Private Supabase storage and Vercel follow-up

Storage now keeps evidence behind the existing `/uploads/<key>` URLs. Report owners and authenticated admins may retrieve evidence; anonymous requests return 401 and other accounts/unlinked keys return 404. Private S3 retrieval redirects to a five-minute signed GET, while local retrieval validates and serves bytes after the same authorization. Public civic queries remove evidence keys and URLs for other viewers. No database schema migration or UI redesign is required. Existing rows use their stored image keys; legacy rows without keys require operator reconciliation.

Vercel still requires `STORAGE_DRIVER=s3` but no longer requires or consumes `S3_PUBLIC_URL`. Use the private `civicfix-evidence` bucket, region `ap-northeast-1`, the project endpoint ending `/storage/v1/s3`, and its generated server-side S3 credential pair. Set `AWS_REQUEST_CHECKSUM_CALCULATION=WHEN_REQUIRED`; the client uses this safe default even when the variable is absent. Exact configuration and Vercel deployment steps are in README.

Direct browser presigned PUT uploads remain in place. A scoped one-hour upload receipt permits pre-login draft analysis and later authenticated submission only for its issued original-image key. Existing report evidence also requires report ownership/admin authorization. Receipts are not stored in report rows. AI analysis and authority verification continue using short-lived signed private URLs; local development retains inline uploads/data URLs.

Regression coverage includes HTTP GET/HEAD evidence denial, owner/admin redirects, local serving, public-query redaction, receipt tampering/expiry/key binding, analysis/submission authorization, private before/after verification, Supabase signature endpoint/region/headers/checksums, and private Vercel startup. Live Supabase, Vercel and production MySQL validation remain separate deployment checks; no live verification is claimed by these regressions.

Follow-up validation: `pnpm check` passed; `pnpm test` passed **79 tests across 10 files**; `pnpm build` passed and regenerated `public/` and `dist/index.js`. The build retains the existing large-chunk warning. The source diff was reviewed against pre-change snapshots because this workspace has no Git metadata. No live Supabase upload, Vercel deployment or production MySQL verification was performed.
