# Agent-managed installation updates

Web UI preview 0.2.4-preview.2 keeps plugin 0.2.4 unchanged. Updating only the web files does not require a bridge restart or plugin reinstall. The preview still has temporary pairing; owner login and automatic recovery are pending in the [owner instance plan](OWNER_INSTANCE_PLAN.md).

## Do users need a fork?

No. Normal installations consume versioned releases from `https://github.com/enterkey-io/hermes-workspace`. A fork is useful only for local source modifications or a hosting-provider workflow that needs a repository under the owner's account. GitHub does not update a fork or merge upstream changes on the owner's behalf.

Use an explicit release tag and its checked packages. Avoid tracking `main`, blindly running `git pull`, overwriting a modified working tree, or using an unversioned download URL as an update policy. The current version is **v0.2.4-preview.2**, a prerelease; the production-certification gate remains closed. GitHub's `releases/latest` skips prereleases, so it is not the correct selector for this preview.

## Record what was installed

The installed web directory includes `version.json`; the plugin has its version in `plugin.yaml`, and an authenticated `/v1/connect` handshake reports the bridge version/protocol. The release manifest records the matching web release, bridge version, protocol, supported Hermes revision and package hashes.

At installation, the agent should keep a private local receipt in its own workspace with the selected GitHub repository/tag, downloaded artifact digests, web-deployment identifier and previous version, plugin path/version, Hermes revision, service-restart method and rollback locations. Private addresses belong only in that private receipt/configuration, never in GitHub, a shared web deployment, analytics or a support report. Do not put operator keys in the receipt. Web-host deployment credentials stay in the owner's own account/secret mechanism.

## Check for an update

On the owner's request, or on a schedule the owner chooses for their own agent, inspect the repository's releases and compare with the installed receipt. The web app itself does not contact our infrastructure or GitHub in the background. GitHub is needed to fetch/check an update, not to authorize normal Bot Mode use.

For an agent with GitHub CLI:

```sh
gh release list --repo enterkey-io/hermes-workspace
gh release view "$TARGET_TAG" --repo enterkey-io/hermes-workspace
```

`TARGET_TAG` is the owner-selected/reviewed release, not literal text. Public releases can also be read/downloaded without a GitHub login through their release page and asset URLs. Do not downgrade implicitly. Read the release notes and manifest, distinguish stable releases from previews, and identify which components changed. Never upgrade Hermes itself simply to make this app update installable.

## Stage and verify the selected packages

1. Download the selected release's manifest, `SHA256SUMS`, and required archives into a new staging directory from the **same explicit tag**.
2. Verify byte counts and SHA-256 digests, and inspect ZIP entries for absolute paths, traversal or symlinks before extraction. A checksum confirms the published files agree; the trusted publisher/tag remain part of the software trust decision.
3. Read the selected release's protocol/Hermes compatibility requirements. Keep the current functioning version if native compatibility is untested. A healthy generic Hermes API does not prove Bot Mode compatibility.
4. Build/test in staging only if using source. A normal prebuilt installation needs no fork or source build. Do not mix downloaded manifests/archives from different releases.

A GitHub CLI download example, before local verification/extraction:

```sh
gh release download "$TARGET_TAG" --repo enterkey-io/hermes-workspace --dir "$STAGING_DIR" --pattern 'workspace-*.zip' --pattern 'workspace-manifest.json' --pattern 'SHA256SUMS'
```

Do not pipe downloaded installation code into a shell. Ask the owner about an interruption before stopping an active agent turn or replacing a live bridge; otherwise schedule the change while idle. Installing the software does not authorize sending bot messages or running routines.

## Deploy without losing private configuration

- **Web app:** retain the old deploy/version, publish the new static files to the same chosen web host/origin, and preserve an owner-controlled `connection.json` only if the owner deliberately configured it. It must contain no secret. The complete site archive carries its own guide/downloads; managed hosting can roll back a deployment. A conventional server should stage a versioned directory, then switch its existing document-root/symlink using its normal atomic-deploy mechanism.
- **Hermes plugin:** stop only the integration service when idle, back up its previous plugin code locally, and replace only that plugin's code with the verified version. Keep `<HERMES_HOME>/bot-web/connection.json` and Hermes's native stores untouched. Do not rerun setup or rotate the operator key for an ordinary code update. Apply a configuration migration only when that release documents one, with a private backup and rollback procedure. Restart using the same runtime, home/profile and supervisor.
- **Both:** install a release pair whose manifest/protocol supports the combination. Re-pair the browser after a bridge restart; grants are intentionally ephemeral. Keep the old pair available for rollback.

Verify the web page still loads on its original origin, the bridge allows that exact origin while rejecting another, local code approval works, and the real managed roster/history appears while the browser stays on the web host. Watch the authenticated event stream for at least 50 seconds: expect immediate readiness and heartbeats around every 15 seconds, including when no bot is selected. Clean up only each probe's own lease with DELETE `/v1/connect`; global `hermes bot-web revoke` is not probe cleanup. Do not invent a pass for an owner's browser you cannot control. If validation fails, restore the previous web deployment/plugin code and any documented configuration backup; do not touch Hermes conversation stores.

## Source customizations

An owner who intentionally customizes source may fork and configure the original repository as `upstream`, then fetch an explicit upstream tag, review/merge it in a branch, run checks and deploy their own artifact. This creates maintenance work for the owner and is not the default installer. Never merge upstream automatically over private settings or local changes.

A one-command automatic updater, signed release provenance, and unattended coordinated updates are not implemented in this preview. This is an executable agent procedure using real release assets and existing deployment tools, not a claim of background auto-update. Future updater work must preserve the same version/compatibility/rollback contract without introducing a vendor data service.
