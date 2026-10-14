# Private connection when Hermes runs in a container

The browser needs a trusted HTTPS endpoint for the native integration. The container itself does not need a Tailscale interface if the owner already has an appropriate private ingress or SSH path. Keep the integration loopback-only inside its own namespace and keep its files/configuration in the correct Hermes home.

Prefer an existing owner-controlled private ingress that can reach the container. A host's loopback is not the container's loopback. If SSH terminates on the outer host, confirm how that host reaches the container's loopback service; do not assume a forwarding command crosses namespaces or expose a new public container port to make it work.

## Existing reverse SSH path to the owner's Mac (test recipe)

For the current test, the owner proposed using the Mac's private Tailscale HTTPS endpoint with an existing SSH path from their Hermes pod. This is a user-controlled transport arrangement, not a vendor relay or a product requirement. The web app can remain at its existing HTTPS port while the bridge uses a different unused HTTPS port.

1. Inspect existing SSH/Serve routes and listeners first. Preserve the existing app route and unrelated services. Choose three ports independently: `BRIDGE_PORT` inside the container, `FORWARD_PORT` on the Mac loopback, and `BRIDGE_HTTPS_PORT` on Tailscale Serve. Set each variable to its inspected, unused numeric value before using the commands below. Check in each relevant network namespace; a free port on the Mac says nothing about the container. The bridge requires a port from 1024 to 65535. In one reported installation, 8788 was an existing MCP socket and the bridge correctly used 8798 instead. Do not stop unrelated services or assume the bridge uses its default.
2. From the namespace that actually reaches the bridge at `127.0.0.1:$BRIDGE_PORT`, use the owner's existing authenticated SSH target/key/host-verification arrangement to create a **loopback-only reverse forward**:

```sh
ssh -NT -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -R "127.0.0.1:$FORWARD_PORT:127.0.0.1:$BRIDGE_PORT" "$EXISTING_MAC_SSH_TARGET"
```

`EXISTING_MAC_SSH_TARGET` is an already authorized SSH destination, not a credential embedded in a URL or an example to invent. Do not disable SSH host verification, change sshd policy, expose the reverse port on all interfaces, or install broad new access merely to satisfy this preview. If the existing path is a forward initiated from the Mac instead, use `-L "127.0.0.1:$FORWARD_PORT:127.0.0.1:$BRIDGE_PORT"` only when the SSH destination's namespace reaches that bridge. In either direction, use the same container port passed to `hermes bot-web setup --port`.

3. On that same Mac, point a **new unused** private Serve route at the forwarded port:

```sh
tailscale serve --bg --https="$BRIDGE_HTTPS_PORT" "http://127.0.0.1:$FORWARD_PORT"
```

Use the HTTPS URL Serve actually reports as `BRIDGE_URL`. Do not enable Funnel or replace an existing route. The owner/browser must have tailnet access. The web app's existing URL/port remains `APP_ORIGIN`; these are two separate values even though their proxy hostnames can be the same.

4. In Hermes's own runtime/home context, configure the integration using that bridge URL and exact web origin. Run `hermes bot-web doctor` first. The tested `af0cd4df` Docker source intentionally has Python distribution metadata `0.0.0`; the doctor matches the native files rather than rejecting that label.
5. For a permanent installation, supervise **both** the bridge and SSH forward using their hosts' existing mechanisms. Cover process failure and startup after the relevant gateway, pod/container and host restarts, with correct runtime/home context and persistent configuration/startup definitions. A tunnel keeper or tracked background process can survive the setup terminal closing while still disappearing on a pod restart. If that is all that has been configured, explicitly report **temporary test ready, not restart-safe**, identify what restart interrupts it, and record private local relaunch steps. Do not reboot live infrastructure just to prove recovery, or create a second unmanaged tunnel that silently conflicts with the first. State whether recovery is configured or actually tested.
6. Verify the actual HTTPS bridge URL through this route: the exact allowed Origin preflight returns 204, an unapproved Origin is denied, and unauthenticated GET is denied without exposing a page or roster. Verify the static app still loads independently and existing routes are intact. Then verify the complete path from the owner's device: trusted HTTPS, owner-supplied approval code, and real native roster while the browser stays on the web app. HTTP probes from the pod alone do not prove the owner's browser can connect. Report infrastructure checks, browser pairing and restart durability separately. If pairing expires after five minutes, ask the owner to request a fresh code.

Keep request/header/body logging disabled. The HTTPS proxy terminates TLS on the Mac and forwards bytes over SSH; traffic transits the Mac, while persistent conversations/stores remain on Hermes. No new content store is created by this route. Do not describe the proxy as unable to see traffic. The Mac route is an optional test transport, not a requirement for users deploying the web app elsewhere.

The code and fixture tests validate the adapter/native contract, including the exact Docker source. They do not establish SSH credentials, namespace reachability, certificate trust or service supervision for the owner's actual deployment; the installing agent must verify those locally. The existing web app needs no relocation or redeployment to support this bridge update.
