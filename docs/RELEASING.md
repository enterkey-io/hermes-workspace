# Publish a preview release

Maintainers publish source and packages in `enterkey-io/hermes-workspace`. Normal users install from explicit tags; they do not need to fork.

1. Update `release.json`, root package version/lockfile, plugin metadata and guide download references together. Keep the release channel honest; a preview is not full public-production certification.
2. Run Node checks, Python boundary tests, separate-origin browser/native tests and downloaded-package installation against disposable Hermes. Preserve compatibility evidence and unresolved gates.
3. Run `npm run package`. Inspect positive-allowlist archives and staged repository files for private configuration, credentials, endpoints, screenshots, fixture state, caches and local workspace metadata.
4. Commit the reviewed source and create/push the explicit release tag. Do not overwrite an existing published tag/version or change its assets silently; publish a new version for fixes.
5. Publish the matching manifest, `SHA256SUMS`, web/plugin/source and complete-site archives using GitHub Releases, marking preview versions as prereleases. Use `--notes-file` with a saved human-readable release description.
6. Download the public assets again and verify hashes, installer links and package identity. Record the actual repository, release/tag and validation result. Do not label unsigned previews as signed/provenance-attested releases.

The source CI workflow runs checks without deployment keys or access to personal Hermes. Release publishing is currently a maintainer action; automatic publishing/updating is not implemented.
