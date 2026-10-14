# Use the web app with your Hermes

This is an independent interface to Hermes's native Bot Mode. The name is undecided. The **web app** and your **Hermes installation** can live on completely different hosts.

You can use an existing hosted copy, or have your agent install your own copy on Cloudflare Pages, a DigitalOcean droplet, or another HTTPS web host. The web app is static files; that host needs no Hermes installation or access to your private network.

## Test using the current web app

1. Open the app's **Agent setup guide** and give its URL to your existing Hermes agent:

   > Please connect this existing web app to my Hermes following these instructions. Keep the web app where it is. Install only the integration plugin on my Hermes host if needed, configure access from the web app's exact origin, and give me the separate HTTPS Hermes connection address. Keep administrator credentials on my Hermes host.

2. Your agent checks your Hermes version, installs/configures the native integration, and establishes a private connection address your device can reach. It returns **two clearly labeled addresses**: the web app you already use and the Hermes connection address.
3. Return to the **original web app**. Click **Connect my Hermes**, enter the connection address, and click **Request browser access**. You do not enter an API key.
4. Send the displayed code to your Hermes agent. It approves that browser locally. Your existing bots and Bot Chats appear here; the page does not redirect to your Hermes server.

Codes last five minutes. If yours expires, click **Request browser access** again and send the new code to your agent.

If Hermes is on your tailnet/VPN, connect your device to that network first. Your browser may ask to allow local-network access. The web host itself does not join the VPN or relay your traffic.

Your agent should tell you what it verified, what still needs your browser, and whether startup after a restart is configured. “Running in the background” may be enough to test, but does not mean it will recover after a server or container restart. For a temporary installation, get the restart limitation and recovery steps from your agent. Opening the Hermes connection address directly may show 403; return to the web app and connect there.

## If you want your own web deployment

Tell your agent where to host the **web app**. The web package contains the app files; the plugin package contains only the integration installed on Hermes. [Agent installation instructions](AGENT_INSTALL.md) cover both deployment choices. Hosting the app beside Hermes is optional, not required.

Your own static site can optionally prefill its Hermes connection address. A shared copy asks for it on a separate connection screen and keeps it only in tab memory. Neither approach puts an administrator key into the website. Use a build/host you trust: browser app code can access its own session credential and displayed conversations.

## What stays where

The static host serves code, styles, documentation and downloads. Your browser connects directly to your Hermes integration for approval, bots, chats, tools, rooms and activity. Our systems have no user account, credential vault, content storage or Hermes relay. Ordinary static hosting can still see asset-request network metadata; your model-provider policy remains the choice configured in Hermes.

Browser credentials expire after one hour and are held only in tab memory. Refreshing requires pairing again. Disconnect revokes that browser grant; your agent can revoke all browser grants locally. Stop asks Hermes to stop a running turn; closing a tab does not stop your agents.

## Preview requirements and limits

The current adapter supports tested gateway bundles at `29112bef` (Hermes 0.21.0) and `af0cd4df` (the Docker source reported as 0.21.7). It accepts that build’s intentional `0.0.0` package metadata when its gateway files match. Your agent runs `hermes bot-web doctor` to check the actual native surface; unknown files remain unsupported. Your agent should not downgrade Hermes or patch core files. The plugin is needed by this preview because the tested stock interfaces do not expose the required separate-origin Bot Mode contract; future supported native APIs can replace it.

Existing managed bots and their native Bot Chats must already exist. The app supports those conversations, streaming/tool activity, exact approvals and Stop, existing room history/send, and routine listing. Bot creation, uploads, routine editing/execution, room creation/recovery, later Hermes versions and full production network/browser certification remain release work.

## Downloads and updates

The public [GitHub repository](https://github.com/enterkey-io/hermes-workspace) and [versioned preview release](https://github.com/enterkey-io/hermes-workspace/releases/tag/v0.2.1-preview.1) provide the web app, complete static site, integration plugin, source and checksums. Your agent can install them without a fork. [Hosting requirements and choices](HOSTING.md) explain what a web host needs and suggest providers if you have no preference.

Your agent should record which version it installed and follow [the update/rollback procedure](UPDATES.md) when you request an update or choose a checking schedule on your own Hermes. Updates replace software files while preserving your private settings and Hermes conversations. There is no automatic background updater in this preview.

The [integration assessment](HERMES_INTEGRATION.md) explains that the plugin currently accesses native Bot Mode directly; it is not yet a registered Telegram-style gateway channel. Proactive channel delivery is follow-up work.
