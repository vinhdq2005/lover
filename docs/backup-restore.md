# Manual encrypted export and isolated restore

No managed backup is assumed on the free tier. Before trusting personal data, the operator must
make an encrypted DB and private-media export and successfully restore it into an isolated test
project. Never test restores against development/production. No export is automatically uploaded.

1. Verify the explicitly intended source project in trusted operator tooling. Export PostgreSQL
   schemas/data (including required Auth identities and membership dependencies) using a compatible
   pg_dump/Supabase export. Supabase managed schemas/roles need its documented restore preparation;
   do not assume a public-schema-only dump contains identities or private Storage bytes.
2. List and download all private staging/media objects with server-only operator credentials into
   an access-controlled temporary folder outside Git. Record object paths, bytes and SHA-256 hashes
   inside the encrypted archive, never public logs. Include migration version and schema dump.
3. Archive DB+media together, then encrypt before persistent storage. backup-manifest.ts exports
   authenticated AES-256-GCM seal/unseal helpers with scrypt-derived keys and random salt/nonce.
   Obtain a >=16-character passphrase through a secure prompt/secret manager, never shell history
   or VITE_ env. Store the passphrase separately. The manifest exposes only encrypted-byte hash,
   size and creation/expiry times. Do not save unencrypted relationship content in the repository.
4. Delete transient plaintext only after verifying decryption/integrity in the controlled temp
   location. On Windows verify exact absolute paths before recursive cleanup; never compute an
   unchecked delete target. Keep encrypted exports and manifests in ignored backups/ or protected
   offline storage; rotate/remove expired copies within 30 days, including deleted content.
5. Restore into a fresh explicitly disposable project. Apply the same migrations/managed-role
   prerequisites, then restore identities, DB rows and private media paths without public buckets.
   Verify counts/hashes, both-member reads, outsider denial, login, ready-photo downloads and no
   real email/Vault sender settings. Disable recovery dispatch before importing operational rows.
   Never promote a test restore to production implicitly or replay old disabled emails.

Release validation must distinguish the automated encrypted-format/integrity/synthetic round trip
from an actual operator DB+media export/restore. Do not claim a complete disaster-recovery test
based solely on cryptographic unit tests or a manifest. Record any unexecuted restore as blocked.

Weekly: check actual free-tier DB/storage/egress/function/email meters; warning at 350 MB DB,
nonessential growth blocked at 400 MB and media reservation cap 800 MiB. Pause/outage/quota is
degraded availability, not authorization for paid upgrades. Keep credentials, backups and private
paths out of Netlify output. Recheck current provider limits before release.
