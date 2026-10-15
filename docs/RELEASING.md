# Publish a preview release

Pebble Crew uses `enterkey-io/pebble-crew` and the project domain `pebblecrew.com`.
The repository was previously `enterkey-io/hermes-workspace`. Keep that old name
unused so GitHub's redirects remain available. Published tags, assets and
checksums are unchanged; older manifests can legitimately name the old repo.

Installed technical identifiers remain stable: plugin/CLI `bot-web`, existing
state directories, service IDs, trust URL and `workspace-*.zip` asset filenames.
They are compatibility contracts, not product branding. Rename them only through
an explicit tested migration, never as part of a cosmetic update. Repository
branding does not move an owner's app to the project domain or create a vendor
runtime dependency.

Maintainers publish source and packages in `enterkey-io/pebble-crew`. Normal users install from explicit tags; they do not need to fork.

1. Update `release.json`, root package version/lockfile and guide download references together. Change plugin metadata/handshake version only when that component changes; `bridge_version` records the required component version separately from the web release. State which components need updating. Keep the release channel honest; a preview is not full public-production certification.
2. Run Node checks, Python boundary tests, separate-origin browser/native tests and downloaded-package installation against disposable Hermes. Preserve compatibility evidence and unresolved gates.
3. Run `npm run package`. Inspect positive-allowlist archives and staged repository files for private configuration, credentials, endpoints, screenshots, fixture state, caches and local workspace metadata.
4. Commit the reviewed source and create/push the explicit release tag. Do not overwrite an existing published tag/version or change its assets silently; publish a new version for fixes.
5. Publish the matching manifest, `SHA256SUMS`, owner/web/plugin/source and complete-site archives using GitHub Releases, marking preview versions as prereleases. Use `--notes-file` with a saved human-readable release description.
6. Download the public assets again and verify hashes, installer links and package identity. Record the actual repository, release/tag and validation result. Do not label unsigned previews as signed/provenance-attested releases.

The source CI workflow runs checks without deployment keys or access to personal Hermes. Release publishing is currently a maintainer action; automatic publishing/updating is not implemented.

Installation guidance can be corrected on `main` between releases. The app's copied agent message links to that maintained guide, whose software downloads must still name one explicit release tag. Refresh the development site's generated guide with `npm run build`; this does not update release ZIPs. Keep published tags, assets and checksums unchanged. Documentation corrections reach packaged sites when their owners update the documentation or deploy the next release; never imply every existing copy was automatically updated.
