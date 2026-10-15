# Hosting requirements

The installed-owner application supports two adapters: Node/SQLite and the owner's
Cloudflare Worker/D1. The web host and Hermes host are independent. The web host
stores owner login/configuration/signing material; user conversations, agent
personality/memory and service credentials stay on Hermes. Browser traffic goes
directly to the HTTPS Hermes bridge; there is no vendor content relay.

For Node, use Node 26, a persistent private state directory/volume and a real HTTPS
reverse proxy plus supervisor. The process binds loopback. Read-only release code
and separately writable state make staged upgrades/rollback straightforward. A
Docker/container host, home server or VPS is suitable when those requirements are
met. The SQLite file is part of the app, not a separate database service.

For Cloudflare, use Workers static assets, D1 and Worker secrets in the owner's
account. Plain static hosting alone cannot implement the required administrator
login. The example adapter uses nodejs_compat, explicit Worker-first API routes and
no request observability. Local Workerd/D1 acceptance is automated; verify the
owner's real domain, account and HTTPS route before declaring their installation
ready.

The browser must be able to reach both HTTPS origins. A public Cloudflare app can
connect to an owner's private VPN/tailnet bridge when their browser/device has that
route and grants any required local-network permission. The Cloudflare server does
not need VPN membership. A private bridge is not made public merely by hosting the
app publicly. Certificate trust, browser local-network policy and proxy buffering
must be checked on the actual supported topology; loopback tests alone do not
certify every public-to-private browser configuration.

The [agent installation guide](AGENT_INSTALL.md) contains deployment, enrollment,
verification and maintenance steps. Optional reference hosts include
[Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/) and
[DigitalOcean Droplets](https://docs.digitalocean.com/products/droplets/getting-started/quickstart/).
No affiliate identifiers or automated purchases are included.
