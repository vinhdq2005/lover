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
