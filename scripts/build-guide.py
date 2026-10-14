"""Produce an agent-readable static page and plain-text guide without JS rendering."""
from pathlib import Path
import html
import re

root = Path(__file__).resolve().parents[1]
source = (root / "docs/AGENT_INSTALL.md").read_text()
public = root / "apps/web/public"
(public / "install.md").write_text(source)


def inline(text):
    text = html.escape(text)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\[([^\]]+)\]\((https://[^)\s]+)\)", r'<a href="\2" rel="noreferrer">\1</a>', text)
    return text


parts, fenced, code = [], False, []
for line in source.splitlines():
    if line.startswith("```"):
        if fenced:
            parts.append("<pre><code>" + html.escape("\n".join(code)) + "</code></pre>")
            code = []
        fenced = not fenced
    elif fenced:
        code.append(line)
    elif line.startswith("#"):
        level = len(line) - len(line.lstrip("#"))
        parts.append(f"<h{level}>" + inline(line[level:].strip()) + f"</h{level}>")
    elif line.startswith("- "):
        parts.append('<p class="bullet">• ' + inline(line[2:]) + '</p>')
    elif re.match(r"\d+\. ", line):
        parts.append('<p class="bullet">' + inline(line) + '</p>')
    elif line.startswith("> "):
        parts.append("<blockquote>" + inline(line[2:]) + "</blockquote>")
    elif line:
        parts.append("<p>" + inline(line) + "</p>")

page = '''<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Agent installation guide · Hermes workspace preview</title><link rel="stylesheet" href="/install.css"></head><body><header><a href="/">← Workspace preview</a><span>Product name undecided</span></header><main><section class="owner-note"><p class="eyebrow">FOR THE OWNER</p><h1>Give this page to your Hermes agent.</h1><p>For this test, keep using the web app hosted here. Your agent connects your separate Hermes installation and gives you its HTTPS connection address. Return to this web app, choose Connect my Hermes, and request browser access.</p><p>You can also host your own copy on Cloudflare, DigitalOcean or another web host. Only the integration plugin needs to run on the Hermes host. No API key is entered here.</p><a href="/install.md">Read or copy the plain-text instructions ↗</a></section><nav aria-label="Installer downloads"><a href="/downloads/workspace-manifest.json">Package manifest</a><a href="/downloads/workspace-web-preview.zip">Web app files</a><a href="/downloads/workspace-plugin-preview.zip">Hermes integration plugin</a><a href="/downloads/workspace-source-preview.zip">Source code</a></nav><article>'''
page += "\n".join(parts)
page += '</article></main><footer>This page contains installation instructions and public software packages. No owner credentials are requested here.</footer></body></html>'
(public / "install.html").write_text(page)
(public / "connection.json").write_text('{"bridgeUrl":null}\n')
(public / "version.json").write_text((root / "release.json").read_text())
