# Agent-managed updates and recovery

Use published immutable upstream releases. Ordinary users do not need a fork; a
fork is appropriate only for maintained custom code.

Keep private state outside release/code directories: app settings/signing keys and
owner auth/session SQLite or D1, plus Hermes connection/trust/workspace state and
all native profiles/history/assets/credentials. Back these up privately before
maintenance. Never commit them to Git or include them in software packages.

Stage new artifacts/dependencies in a new release directory, verify checksums and
compatibility, run the relevant checks, and confirm native work is idle. Switch
only versioned app/plugin code and restart the supervised services. Do not rotate
issuer/audience/signing keys or overwrite connection config during routine updates.
Run `hermes bot-web sync-runtime` after replacing the main integration to refresh
its enrolled profile copies with private rollback backups. A mismatched runtime
copy is an update problem, not permission to silently overwrite unrelated code.

Verify the actual HTTPS route and trust with `hermes bot-web probe`, check owner
login persists and the browser reconnects to its canonical chat. Roll back code and
compatible app/workspace schema state when necessary, preserving unrelated native
conversations and credentials. Do not claim rollback was tested simply because a
backup directory exists.

For Node login recovery, the operator runs the bundled owner CLI `recover --state
PRIVATE_STATE_DIRECTORY`, then privately delivers the new one-use proof. Existing
app sessions are revoked. Already minted Hermes tickets have a maximum five-minute
lifetime. Recovery keeps the installation's signing binding. Cloudflare recovery
requires account access and a reviewed D1 transaction, never a public reset link.

There is no unattended automatic update channel or release signing/provenance
claim yet. SHA256SUMS plus the release manifest verify the published package set;
keep production certification separate from development preview evidence.

0.5.0 adds optional presentation/read-cursor tables without changing the workspace
schema. Old code ignores them; keep them during rollback. Profile incarnation
witnesses and the separate `pebble-crew` native metadata namespace must survive
code-only updates. Pending 0.5 Delete/Hide requests are unsupported by older code;
never approve them after downgrade. Return to the matching release to review
them. A same-name profile restored by copying to a new directory receives a new
incarnation and does not inherit a destructive approval or retired public handle.
