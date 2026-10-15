# Set up your private workspace

Give your Hermes agent the [installation guide](AGENT_INSTALL.md), along with the
web host you want to use (or ask them to help choose one). Your web app and Hermes
can run on different hosts. Olares is simply one possible Hermes host.

Your installation agent should finish routing, verification and service startup,
then give you two things privately: **the web app URL** and **a one-use setup code**.
Open that web URL, create your administrator login, and confirm your detected
primary agent's @ handle and avatar. You can choose an animated shape/color or
supply your own photo. Your existing agent remains the same personality with the
same Hermes memory and configuration.

Subsequent visits use your workspace login. Refreshes, idle time, a new device or a
service restart should not require asking an agent for another pairing code. You
can add other existing profiles from **Add existing agents**, organize them into
teams, edit roles/reporting and appearances in **Workspace settings**, and review
management requests your agents submit there.

The Hermes bridge URL is an API address, not the app. Opening it directly may say
“Request denied”; open the web app URL instead. Never paste a Hermes administrator
credential into the browser or a public setup page.

The old static technical preview uses temporary pairing. It needs the new owner
service plus plugin enrollment to gain persistent login; changing the frontend
alone cannot make an old bridge trust a new login service.
