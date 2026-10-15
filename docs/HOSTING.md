# Web hosting requirements and choices

> This page describes the current static preview. The private owner-installed product must first create an administrator login and preserve its Hermes connection. That requires a small owner-hosted runtime: Node with local SQLite, or a Cloudflare Worker and owner-account storage. See the [owner instance plan](OWNER_INSTANCE_PLAN.md). Plain static hosting alone does not implement that login. App and Hermes hosting remain independent.

The application is a static website. Its host needs:

- HTTPS with a certificate trusted by the owner's browser.
- A site root that can serve `index.html`, `assets/`, JSON, CSS, plain-text instructions and optional downloadable release archives.
- The security headers included in `_headers`, or their equivalents on a conventional web server.
- A way for the owner or their agent to replace a deployed static version and roll back to the previous one.

The host serves software assets. The browser on the owner's device performs the separate HTTPS connection to Hermes. The host needs no connection to the user's VPN, no Hermes or model runtime, no credentials/database and no application backend. Static managed hosting requires no continuously running server process. A conventional server can use the included Node convenience server behind its normal TLS ingress. Building from source currently requires Node 26.0.0/npm 11.12.1 and Python 3 for the static guide generator; prebuilt archives avoid build-time tooling.

A custom hostname is optional. Keep the chosen app at a stable origin: changing domain/port requires updating the Hermes plugin's exact allowlist and pairing again. The current preview serves at the site root; mounting under a subdirectory is not yet verified.

## When no host is preferred

Ask whether the owner wants to use an existing web deployment or host their own copy. For the current tailnet test, reuse the existing web preview. For a new independent installation, suggest these options with links rather than buying resources without authorization:

| Choice                                              | Fits                                                                       | Setup reference                                                                                                                  |
| --------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare Pages                                    | A straightforward managed static deployment from the prebuilt site archive | [Create a Pages deployment](https://developers.cloudflare.com/pages/get-started/direct-upload/)                                  |
| DigitalOcean App Platform static site               | Owners who prefer DigitalOcean managed hosting                             | [Static-site guide](https://docs.digitalocean.com/products/app-platform/how-to/manage-static-sites/)                             |
| Existing DigitalOcean droplet or other HTTPS server | Owners with a server they already manage                                   | [DigitalOcean web-hosting tutorials](https://www.digitalocean.com/community/tags/web-server) and the included Node static server |
| Existing static hosting provider                    | Any provider meeting the requirements above                                | Apply the supplied headers and deploy the extracted site files                                                                   |

These are ordinary reference links, not affiliate links. Keep future commercial/affiliate destinations and disclosure here, separate from connection/authentication code. No provider account is a product dependency. Do not promise current prices or capacity limits without checking the provider's own information.

## Packages

The GitHub preview release publishes `workspace-site-preview.zip`, a complete deployable static site with its installer-download directory; `workspace-web-preview.zip`, the app files and standalone Node server; `workspace-plugin-preview.zip`, only the Hermes integration; and `workspace-source-preview.zip`, reviewable source. All have published checksums. Neither the web nor site archive contains a Hermes installation, operator credential or user state.

The plugin runs on the existing Hermes host using its own Python runtime, FastAPI/Uvicorn dependencies and service supervisor. The connection requires trusted HTTPS ingress to that separate API service and network access from the owner's browser. Those requirements are independent of the chosen web host.
