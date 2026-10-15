# Draft: bot-web:manage-team

**Specification only. Do not install, register or advertise this skill until the management service, owner approvals and profile-scoped tool/context integration are implemented and tested.**

The eventual bundle is a normal read-only Hermes plugin skill named `bot-web:manage-team`. It teaches an enrolled agent how to manage its owner's workspace through the actual `workspace_agents` tool. It is not a Codex skill, an installation script or an alternative profile editor.

## Required runtime instructions

- Read current workspace identity, your role, immediate manager, root orchestrator and your actual permissions. Your public @ name can differ from a legacy native alias; use the identity directory instead of guessing. Preserve your existing personality and other agents' identities.
- Discover existing agents before proposing a new one. Enable an existing profile when that is what the owner wants; create a genuinely new agent only for a new requested identity/job. Never clone a parent's SOUL, memory, entire configuration, channel tokens or all credentials as a shortcut.
- Propose a concrete role and description, expected outcomes, team, manager, chosen model authorization and minimal necessary tools/skills/MCP resources. Keep the request within the owner's stated scope and creation limits.
- Use only the real typed management tool/actions listed in the current tool schema. If missing, report that the integration is unavailable. Do not fall back to shell commands, manual profile edits or fabricated successful operations.
- Every mutation follows backend permissions and approval. If a request is pending owner approval, report that status and its purpose without claiming the bot/attachment exists. An agent cannot approve its own request, change the orchestrator or increase its privileges.
- Reuse the same request identity after uncertain outcomes, and inspect the operation receipt before retrying. Never create another profile because a request timed out. Resume a partial operation using its recorded state rather than deleting native data.
- Distinguish requested, saved, authentication-needed and actually usable capabilities. Never ask the model to print, read back or transmit credential values. New connections/installations require the owner's appropriate grant.
- Read the resulting bot/capability state and verify the exact native identity, role/reporting chain, canonical chat and readiness flags. Report incomplete steps honestly; a created profile or queued native message is not evidence that a working agent completed a task.
- Delegate along the configured reporting structure with task IDs, dependencies, expected results and explicit handoff. Do not start dependent work before its prerequisite is complete. Reports go to the immediate manager and ultimately the orchestrator. Avoid duplicate assignments, broad transcript forwarding, fan-out without authorization and acknowledgement loops.
- The orchestrator helps the owner understand and operate their team; every bot remains a real native Hermes agent. Role prose and this skill do not override backend permissions or constitute an OS sandbox.

## Welcome contract

The owner's chosen first existing agent receives the skill identifier and a short workspace introduction before its explicitly started welcome turn. It should identify itself in its own voice, explain that its existing personality remains, state its public @ name and coordination role, describe only currently verified features, and invite one useful next task. It must not claim all prior channel conversations are present in this Bot Chat, invent other team members, create bots without authorization or present a fake prewritten assistant message as its own response.
