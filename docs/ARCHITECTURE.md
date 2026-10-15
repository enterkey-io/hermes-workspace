# Independent web app and Hermes integration

14 October 2026. This describes the implemented technical preview. It corrects the earlier assumption that agent-led installation meant co-locating the web app and Hermes. Product naming remains undecided.

**Product target correction:** the owner installs a private instance and creates its administrator login on first opening. Owner-controlled login/configuration persistence is allowed. The [owner instance plan](OWNER_INSTANCE_PLAN.md) is the binding next architecture; it adds a small owner-hosted authentication runtime and automatic reconnection while retaining separate Hermes hosting and direct conversation traffic. The static, memory-only protocol below is the current preview, not the required launch experience. No login service or durable reconnect has been implemented yet.

## The three separate parts

| Part               | Where it runs                                                                        | Responsibility                                                                | Data it holds                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Static web app     | Any chosen HTTPS web host: Cloudflare Pages, DigitalOcean, an ordinary static server | Serve the same HTML/CSS/JS to the owner's browser                             | Software assets and documentation; no Hermes keys, endpoints, conversations or account database on a shared host |
| Browser client     | Owner's device                                                                       | Pair directly, render bots/conversations, send native actions, consume events | Endpoint, verifier, short-lived credential and displayed contents in tab memory                                  |
| Native integration | Owner's existing Hermes host, wherever Hermes runs                                   | Expose authenticated allowlisted operations backed by actual native Bot Mode  | Private operator configuration plus ephemeral grants/connections; Hermes retains its own native stores           |

The web host serves software to the browser. The browser then communicates directly with the Hermes integration over HTTPS. The web host does not connect to Hermes, join the tailnet, proxy requests, handle authentication callbacks, or receive user contents. Installing the app with an agent does not change those boundaries.

The integration is optional in the product architecture. It is required for the current tested Hermes build because the stock interfaces do not provide the needed external-web-client Bot Mode contract. It is a compatibility adapter using normal plugin registration, not a replacement agent runner or a Hermes core modification. Future native APIs can replace the adapter behind the shared client interface.

## Two independent addresses

`APP_ORIGIN` identifies the web app (for example `https://app.example`). `BRIDGE_URL` identifies the user's Hermes connection (for example a private trusted HTTPS tailnet hostname). These can be on different providers and machines. The bridge configuration separately records the allowed app origins and its own allowed Host. Neither is inferred from the other.

The shared app asks for the Hermes address on a separate connection screen. It neither stores it nor puts it into a URL/query/referrer. An owner-controlled deployment can optionally publish its own non-secret `bridgeUrl` in `connection.json` to prefill the field; that is a deliberate public site configuration, never a per-user setting on our shared host. The app does not contact that endpoint until the owner requests access. It never redirects the owner to the bridge.

## Direct browser approval

1. Browser generates a random verifier and sends only its SHA-256 challenge directly to the selected bridge, using `credentials: omit`, redirect rejection and bounded requests.
2. Bridge allows only the configured Host and exact app Origin. It creates a bounded five-minute request and short code. No credential is returned yet.
3. Owner sends the visible code to their own Hermes agent. The agent runs local `hermes bot-web approve CODE --app-origin APP_ORIGIN` with the private operator configuration, approving that exact browser/web origin.
4. Browser claims with its private verifier. The bridge issues a single-use, origin-bound one-hour credential. Only its hash is held in the bridge grant table. The administrator key is never delivered to the browser or web host.
5. Native roster/history, scoped bot/room operations and event streaming use that bridge directly. Browser grants cannot approve other browsers or reuse another connection's lease. Disconnect revokes the tab's grant; local revoke clears all grants. Reload requires new pairing.

CORS is an additional browser boundary, not authentication. A non-browser program can spoof Origin; the scoped bearer credential and explicit local approval remain necessary. Unapproved origins fail preflight and pairing; a known code does not replace verifier proof. Limits bound pending requests, grants, bodies, connections and streams. Mutation results are never retried automatically after an uncertain outcome.

## Existing agents and identity

The integration exposes read-only `agents.list` for all native profiles and a narrow `agent.enable` operation for an owner-selected existing profile. Registration adds only an absent native managed-bot metadata namespace with compare-and-swap and initializes/reuses its canonical Bot Chat. It never invokes `profiles.create`, copies SOUL, changes model/provider configuration or clones channel credentials. The owner chooses profiles in the app; zero managed bots must not trigger creation of a placeholder.

Hermes resumes the same profile's session and loads that profile's own SOUL, memory and skills. Existing native Bot Chats keep their identity/history; other channel/CLI sessions remain distinct. A read-only stored-title guard prevents a missing/retired canonical lookup from becoming an accidental replacement. Errors fail closed, local enrollment is serialized, and another native writer's canonical winner is adopted instead of forcing a rename. Discovery returns only names/descriptions/status, not paths, credentials or SOUL contents. New capability negotiation leaves older integrations' existing chat usable while explaining that selection requires an update.

## Network and hosting requirements

The web host needs only static HTTPS hosting with the supplied security headers. It needs no Hermes credentials, backend, function, database or private-network route. `npm run package` creates separate web/plugin/source archives plus `artifacts/site`, a complete static deployment directory with agent-download assets. The standalone Node static server works from an extracted web package without the source tree or installed npm dependencies.

The owner's device must reach the Hermes endpoint, using their existing VPN/tailnet or their chosen public HTTPS arrangement. The bridge listens only on loopback behind the owner's trusted HTTPS ingress. A private route is not automatically reachable just because the web app loads. Local browser permission and certificate trust are separate from CORS and approval. Chrome documents a permission gate for public-to-local requests; do not disable it or add a vendor relay as a workaround. Extra login redirects at an Access/reverse-proxy layer need separate compatibility testing.

Sources checked for deployment/network guidance: [Cloudflare static HTML](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/), [Pages direct upload](https://developers.cloudflare.com/pages/get-started/direct-upload/), [Pages security headers](https://developers.cloudflare.com/pages/configuration/headers/), and [Chrome Local Network Access](https://developer.chrome.com/blog/local-network-access). Browser/provider behavior must be tested for each production topology; a local fixture does not certify every browser or home network.

## Review against what was built

| Finding                                                                  | Correction                                                                                                                                                |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Latest plan amendment contradicted original independent hosting contract | Both root plans now state independent deployment and separate app/bridge addresses; this document is the current contract                                 |
| Setup required web files alongside Hermes                                | Setup now accepts `--bridge-url` and repeated exact `--app-origin`; no web directory or app files are needed on Hermes                                    |
| Frontend treated an external URL as a navigation target                  | It stays on the web origin and pairs/streams directly with that separate endpoint                                                                         |
| Integration doubled as static app host                                   | Static routes/assets removed; it serves only the authenticated native API and direct pairing                                                              |
| Browser tests used a combined origin                                     | Acceptance now runs a standalone static app and an API-only real Hermes fixture on different HTTPS origins, including code approval and native operations |
| Instructions installed an unnamed app in the wrong place                 | Guides identify the web app package and integration plugin separately, with an existing-app test path and an optional independent deployment path         |
| Packaged Node server assumed the repository layout                       | Extracted web package serves its own directory; source package also produces a complete static deployment folder with working guide downloads             |

The native adapter itself remains useful: real managed bots, normal canonical resume, native teammate/room execution, event/tool progress, exact approvals and Stop stay in Hermes. The correction changes deployment and connection responsibilities, not native execution semantics.

## Acceptance and remaining scope

The [one-agent installation contract](INSTALLATION_CONTRACT.md) is a separate required launch gate. The installer must complete native readiness, independent hosting, connection configuration and durable service recovery before the normal owner handoff. Server-setting entry, developer-mediated repairs and renewed agent involvement on ordinary refresh/reconnect are preview limitations, not launch behavior. The current manual code/address handoff and memory-only grant lifecycle need a tested enrollment/discovery design; security and the prohibition on vendor user-data storage remain binding. Partial native or seeded-fixture tests cannot certify this owner experience.

The separate-origin browser suite, Python security/configuration suite and downloaded-package CLI smoke are the acceptance checks for this correction. Record completed run results in `PROGRESS.md` and `docs/compatibility/integration-evidence.json`. The fixtures use unmodified pinned Hermes, disposable homes and a deterministic local model. They do not touch the owner's server or production provider.

User testing uses the existing private web preview with a bridge installed on the user's separate Hermes server. That personal installation and browser approval still need the owner's Hermes agent; this development machine has no credentials/access to configure it. The guide makes this handoff explicit and reports checks awaiting the owner rather than inventing success.

Full production certification for public hosting to home networks, more browsers, native compaction under pressure, routine execution and later Hermes builds remains pending. Mac/Windows/iOS can share the protocol contract; OS networking, secure credential storage and lifecycle need their own implementation. Sales/licensing and any future opt-in content-free statistics remain separate from Hermes identity and user contents.
