"""Build reviewable positive-allowlist archives. Never include local secrets/state."""
from pathlib import Path
from hashlib import sha256
import json
import shutil
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
release = json.loads((root / "release.json").read_text())
destination = root / "artifacts/packages"
destination.mkdir(parents=True, exist_ok=True)


def archive(name, files):
    with ZipFile(destination / name, "w", ZIP_DEFLATED) as output:
        for path, target in sorted(files):
            if path.is_file() and not path.is_symlink():
                output.write(path, target)


web = [(path, str(path.relative_to(root / "apps/web/dist"))) for path in (root / "apps/web/dist").rglob("*")]
web += [(root / "scripts/serve-static.mjs", "serve-static.mjs"), (root / "LICENSE", "LICENSE"),
        (root / "docs/SETUP.md", "SETUP.md")]
archive("workspace-web-preview.zip", web)
# Installed-owner Node distribution. Dependencies are installed from the pinned lock;
# runtime state is never packaged. Keep repository-relative paths used by the CLI.
owner = [(path, "apps/web/dist/" + str(path.relative_to(root / "apps/web/dist")))
         for path in (root / "apps/web/dist").rglob("*")]
for name in ("apps/owner-node/dist/main.mjs", "apps/owner-worker/migrations/0001_owner.sql",
             "package.json", "package-lock.json", "release.json", "LICENSE", "docs/AGENT_INSTALL.md",
             "scripts/provision-worker.mjs"):
    owner.append((root / name, name))
for directory in ("apps", "packages"):
    for package in (root / directory).glob("*/package.json"):
        owner.append((package, str(package.relative_to(root))))
for example in (root / "deploy").glob("*.example"):
    owner.append((example, str(example.relative_to(root))))
archive("workspace-owner-preview.zip", owner)

import runpy
payload_paths = runpy.run_path(str(root / "plugins/bot-web/payload.py"))["payload_paths"]
plugin = [(path, "bot-web/" + str(path.relative_to(root / "plugins/bot-web")))
          for path in payload_paths(root / "plugins/bot-web")]
plugin += [(root / "LICENSE", "LICENSE")]
plugin += [(root / "docs/SETUP.md", "SETUP.md")]
archive("workspace-plugin-preview.zip", plugin)
source = []
for directory in ("apps", "packages", "plugins", "scripts", "test", "docs", ".github", "deploy"):
    for path in (root / directory).rglob("*"):
        if (path.is_file() and not path.is_symlink() and not {"dist", "node_modules", "__pycache__", "artifacts", ".wrangler", ".local", ".superdesign"}.intersection(path.parts)
                and path.suffix in {".ts", ".tsx", ".css", ".html", ".md", ".json", ".mjs", ".py", ".yml", ".yaml", ".txt", ".sql", ".jsonc", ".example"}
                and not path.name.startswith(".env") and path.name not in {"auth.json", "credentials.json", "config.yaml"}):
            source.append((path, str(path.relative_to(root))))
for name in ("README.md", "PROGRESS.md", "IMPLEMENTATION_PLAN.md", "WEB_APP_PLAN.md", "LICENSE", "release.json",
             "package.json", "package-lock.json", "tsconfig.json", "eslint.config.mjs", "vitest.config.ts",
             "playwright.config.ts", "playwright.avatar.config.ts", "playwright.owner.config.ts", "vite.client.config.ts", "vite.web.config.ts", ".nvmrc", ".gitignore",
             ".prettierrc.json", ".prettierignore"):
    source.append((root / name, name))
archive("workspace-source-preview.zip", source)
print("Created web, optional plugin and source preview archives in artifacts/packages.")

manifest = {"schema": 1, **release, "artifacts": []}
for name in ("workspace-owner-preview.zip", "workspace-web-preview.zip", "workspace-plugin-preview.zip", "workspace-source-preview.zip"):
    data = (destination / name).read_bytes()
    manifest["artifacts"].append({"name": name, "bytes": len(data), "sha256": sha256(data).hexdigest()})
(destination / "workspace-manifest.json").write_text(json.dumps(manifest, indent=2)+"\n")

# A standalone static deployment, with working agent-guide downloads and no Hermes runtime.
site = root / "artifacts/site"
if site.exists():
    shutil.rmtree(site)
shutil.copytree(root / "apps/web/dist", site)
shutil.copyfile(root / "scripts/serve-static.mjs", site / "serve-static.mjs")
(site / "downloads").mkdir()
for name in [item["name"] for item in manifest["artifacts"]] + ["workspace-manifest.json"]:
    shutil.copyfile(destination / name, site / "downloads" / name)

# Portable deployment bundle, without recursive inclusion of itself.
archive("workspace-site-preview.zip", [(path, str(path.relative_to(site))) for path in site.rglob("*")])
checksummed = [item["name"] for item in manifest["artifacts"]] + ["workspace-manifest.json", "workspace-site-preview.zip"]
(destination / "SHA256SUMS").write_text("".join(f"{sha256((destination / name).read_bytes()).hexdigest()}  {name}\n" for name in checksummed))
