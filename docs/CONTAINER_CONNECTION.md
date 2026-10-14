# Private connection when Hermes runs in a container

The browser needs a trusted HTTPS endpoint for the native integration. The container itself does not need a Tailscale interface if the owner already has an appropriate private ingress or SSH path. Keep the integration loopback-only inside its own namespace and keep its files/configuration in the correct Hermes home.

Prefer an existing owner-controlled private ingress that can reach the container. A host's loopback is not the container's loopback. If SSH terminates on the outer host, confirm how that host reaches the container's loopback service; do not assume a forwarding command crosses namespaces or expose a new public container port to make it work.

## Existing reverse SSH path to the owner's Mac (test recipe)

For the current test, the owner proposed using the Mac's private Tailscale HTTPS endpoint with an existing SSH path from their Hermes pod. This is a user-controlled transport arrangement, not a vendor relay or a product requirement. The web app can remain at its existing HTTPS port while the bridge uses a different unused HTTPS port.

1. Inspect existing SSH/Serve routes and listeners first. Preserve the existing app route and unrelated services. Choose unused ports; the examples below use container bridge port 8788, Mac loopback port 18788 and private HTTPS port 8445.
2. From the namespace that actually reaches the bridge at `127.0.0.1:8788`, use the owner's existing authenticated SSH target/key/host-verification arrangement to create a **loopback-only reverse forward**:

```sh
ssh -NT -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -R 127.0.0.1:18788:127.0.0.1:8788 "$EXISTING_MAC_SSH_TARGET"
```

`EXISTING_MAC_SSH_TARGET` is an already authorized SSH destination, not a credential embedded in a URL or an example to invent. Do not disable SSH host verification, change sshd policy, expose the reverse port on all interfaces, or install broad new access merely to satisfy this preview. If the existing path is a forward initiated from the Mac instead, its usual `-L 127.0.0.1:18788:127.0.0.1:8788` is suitable only when the SSH destination's namespace reaches that bridge.

3. On that same Mac, point a **new unused** private Serve route at the forwarded port:

```sh
tailscale serve --bg --https=8445 http://127.0.0.1:18788
```

Use the HTTPS URL Serve actually reports as `BRIDGE_URL`. Do not enable Funnel or replace an existing route. The owner/browser must have tailnet access. The web app's existing URL/port remains `APP_ORIGIN`; these are two separate values even though their proxy hostnames can be the same.

4. In Hermes's own runtime/home context, configure the integration using that bridge URL and exact web origin. Run `hermes bot-web doctor` first. The tested `af0cd4df` Docker source intentionally has Python distribution metadata `0.0.0`; the doctor matches the native files rather than rejecting that label.
5. Supervise the bridge and SSH forward using their hosts' existing mechanisms so they survive the setup terminal closing. Do not create a second unmanaged tunnel that silently conflicts with the first. Keep request/header/body logging disabled. The HTTPS proxy terminates TLS on the Mac and forwards bytes over SSH; traffic transits the Mac, while persistent conversations/stores remain on Hermes. No new content store is created by this route.
6. Verify the complete path from the owner's device, not only from the pod: trusted HTTPS, exact allowed Origin preflight, denied unapproved Origin, owner-supplied approval code, and real native roster while the browser stays on the web app. Report any browser step awaiting the owner instead of claiming success.

The code and fixture tests validate the adapter/native contract, including the exact Docker source. They do not establish SSH credentials, namespace reachability, certificate trust or service supervision for the owner's actual deployment; the installing agent must verify those locally. The existing web app needs no relocation or redeployment to support this bridge update.
