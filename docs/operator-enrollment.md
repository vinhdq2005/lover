# Controlled account setup

Only the two approved email accounts may be provisioned. Disable public/anonymous signup. Verify
mailbox control out of band before using --mailbox-verified; auto-confirming alone proves nothing.
Do not grant the partner Supabase project administration rights.

Set SUPABASE_URL, server-only SUPABASE_SERVICE_ROLE_KEY, LOVER_FIRST_EMAIL, LOVER_PARTNER_EMAIL and
LOVER_PROVISION_PASSWORD in the operator process environment (never VITE_, never Git or shell history
containing passwords). Password minimum: 12 characters. Execute node --experimental-strip-types scripts/provision-user.ts first
--mailbox-verified, then partner --mailbox-verified with the partner's independently delivered password.
Run this locally for tests; hosted provisioning requires separate operator configuration and is not
automatic. Provisioning a partner grants no couple access: matching invitation acceptance is required.
First user logs in, creates the singleton and copies a 48-hour invitation via a private channel.
Invitation token is shown once and stored only as a hash; if lost, revoke and issue a replacement.
Accepted partner replacement is outside MVP. Email remains disabled.

Recovery while email is disabled: operator re-verifies mailbox/identity, locates the exact approved
Auth identity and resets its password through the trusted Auth admin dashboard. Never bypass couple
membership or create a replacement third account. Revoke active sessions after recovery.

## Local demo accounts (no real registration)

With Docker/local Supabase running, create or restore only synthetic local accounts without a DB
reset using:

```powershell
node --experimental-strip-types --input-type=module -e "import { provisionCoupleLocal } from './tests/helpers/localStack.ts'; await provisionCoupleLocal();"
```

The helper checks the CLI API URL is loopback and never provisions a hosted project. Local accounts
are first@example.test and partner@example.test, password Local-Only-Test-Password-2026!.
Open http://127.0.0.1:5173 after npm run dev. These are disposable fixtures, not real mailboxes.
Integration/enrollment browser tests reset the local database. Do not use those tests with personal
data. The helper reuses existing local users and does not reset their changed passwords; use the
local Auth administration UI for a changed fixture password rather than resetting the database.

Local Edge serving must use --env-file .env.edge.local; Supabase injects SUPABASE_URL,
SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY into that runtime. Never copy a service key into
VITE_ configuration. Nothing in this procedure activates email or provisions production.

## Admin key formats and safe diagnosis

Prefer SUPABASE_SECRET_KEY containing a newly generated sb_secret_ key from the exact target
project. The existing SUPABASE_SERVICE_ROLE_KEY variable remains compatible with modern secret
keys and structurally valid legacy service_role JWTs. Set only one variable; conflicting values
are rejected. This does not authorize reuse of any exposed legacy credential. Public publishable
keys, anon JWTs, account access tokens, database passwords and JWT signing secrets are not admin
API keys. Length alone cannot identify a credential. Shape checks are not authentication; the
Supabase server must still validate the key, project and permissions.

The operator script reads the current process environment; it does not automatically load
.env.local or .env.edge.local. Frontend VITE_ settings do not configure this script. Supply secrets
through a trusted process/secret manager, never paste them in command arguments or logs.

After independently verifying both mailbox owners, use the non-mutating diagnostic mode:

```powershell
npm.cmd run operator:provision -- first --mailbox-verified --check
```

This only performs Auth admin listUsers (up to 3 accounts, enough to reject a third), checks the
approved account allowlist and exits. It does not create users, update passwords or call
bootstrap_operator. No provisioning password is needed for --check. No remote check was executed
as part of this remediation; automated tests use injected local HTTP responses only.

Errors expose only a fixed stage, numeric HTTP status, allowlisted error code and safe category:
- OPERATOR_INVALID_ADMIN_KEY_FORMAT: rejected locally, no network request made.
- status=401: invalid/revoked key or key/project mismatch; not enough information to distinguish.
- status=403: admin permission denied; check intended project and privileged key selection.
- status=404: incorrect project/API endpoint or endpoint unavailable.
- status=0: no usable HTTP response/unclassified transport error; check DNS, TLS, proxy and network.
- status>=500: upstream service unavailable; do not retry provisioning blindly.
- code=UNAVAILABLE: the provider supplied no recognized safe code. Raw messages/bodies are omitted.

An existing 60-character value without sb_secret_ cannot be a valid legacy HS256 service-role JWT
and does not match the supported modern admin key format. Replace it with a new project secret
API key; do not guess its type or reuse the exposed credential. The old generic listUsers failure
hid its HTTP status, so its precise server rejection cannot be recovered from that message alone.
Modern keys are supported by the installed supabase-js SDK through createClient(url, key); no
manual Authorization override or user session should be added to this admin client.

A replacement key does not revoke an exposed legacy key. Follow Supabase's compromised-key
rotation/revocation procedure separately, reviewing existing Edge dependencies on injected legacy
keys before disabling them. No key rotation, remote check or user provisioning is performed here.
