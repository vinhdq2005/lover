# Optional partner email operations

Email is disabled by default. In-app partner notifications remain available without a sender.
No real email has been sent by automated validation. Both users may opt in/out of email on the
inbox page; opt-in defaults off and never replays past disabled events.

Before enabling production, an operator must verify the actual Brevo account's sender approval,
From identity, applicable domain authentication rules and current free allowance in its dashboard.
Owning a Netlify netlify.app site does not provide DNS control of that sender domain. Free mailbox
domains cannot be authenticated by the user. Brevo may substitute a sending domain; do not treat
this as proof of account-specific approval. If eligible sending cannot be demonstrated, stay disabled.
Never purchase a domain/upgrade or enable a paid fallback automatically.

Only after eligibility is established, set server-only BREVO_API_KEY, BREVO_FROM_EMAIL,
BREVO_FROM_NAME, EMAIL_PROVIDER=brevo, EMAIL_DELIVERY_ENABLED=true, EMAIL_SENDER_VERIFIED=true,
APP_ORIGIN=https://the-actual-app-origin and WORKER_SECRET. An operator must also enable the
server-only private.notification_config row. The recipient must opt in. All three gates are
required; no browser may set the global flag or arbitrary recipient. Historical disabled rows
remain disabled. No VITE_ mail/service/worker keys. Auth SMTP is a separate configuration.

The internal budget is at most 100 attempts/day UTC, across categories. One upload batch emits
one event/notification/disposition at first successful file; later summaries never resend email.
The worker claims at most 20 rows/run, locks claims, rechecks current verified membership and
uses stable provider UUID keys. Unknown acceptance is retried only within the same first-attempt
30-minute dedupe window and five-attempt ceiling. After expiry it remains quarantined unknown;
inspect/reconcile via trusted provider evidence, never blindly resend. Accepted is not delivered.

Immediate post-commit signals and one-minute pg_cron recovery share the same claims. Populate
Vault lover_edge_base_url and lover_worker_secret only through trusted operator tooling, matching
WORKER_SECRET. No Vault credentials are created by migrations. Missing values make recovery
network-inactive; disabled mode performs no provider requests. The five-minute target depends on
sender eligibility, provider availability and remaining free quota. Signals never roll back content.

Review usage weekly. If quota/availability fails, leave core content/inbox functional and delay email.
While email is disabled, use the private invitation handoff and identity-verified operator password
recovery in operator-enrollment.md. Notification retry never sends invitations or accepts addresses.

Primary documentation checked 2026-11-10:
- [Brevo batch idempotency, 30-minute TTL](https://developers.brevo.com/docs/heterogenous-versions-batch-emails)
- [Transactional send API](https://developers.brevo.com/reference/send-transac-email)
- [Sender setup](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email)
- [Domain authentication](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC)
- [Domain substitution/troubleshooting](https://help.brevo.com/hc/en-us/articles/16045394674066-Troubleshooting-Domain-authentication)

These documents do not establish this project's sender approval. No external test or activation
is authorized by implementation. A future explicitly approved real test must target only the other
verified partner, use generic content and be recorded separately from mock/local results.
