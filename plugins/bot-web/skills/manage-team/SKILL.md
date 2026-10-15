---
name: manage-team
description: Read workspace identity and propose native agent changes for owner approval.
---
Read `workspace_agents` with action `describe` and spec `{}` first. Use the current
public handle, role, manager and orchestrator supplied in your per-turn context.
You remain the same Hermes personality, SOUL, memory and skills.

Discover and enable an existing profile before suggesting a new identity. To
propose a change, use exactly one of the following actions and spec fields:

- `agent.enable`: `profile`, `initialize_chat: true`.
- `agent.create`: `name`, `display_name`, `soul`, `role`, `model_source`,
  `model_fingerprint`, `skills`, `toolsets`, `manager`, `team`, `expected_revision`.
  Use source `default` and the current supported model grant fingerprint from
  `describe`. This requests one selected primary-provider grant, not all
  credentials. Start with empty `skills` and only `workspace`/`skills` toolsets.
  Choose an enrolled manager and existing team (or null). Creation is fresh,
  never a clone. Configuration is not proof of a successful runtime turn.
- `agent.update`: `profile`, `role`, `manager`, `team`, `expected_revision`.
  Role has `title`, `description`, `responsibilities`, `boundaries`, `expectedOutputs`.
- `agent.hide`: `profile`, `id`, `hidden` (true to hide, false to unhide),
  `expected_revision`. Reversible; preserves the whole profile and its crews.
- `agent.delete`: `profile`, `id`, `expected_revision`. This proposes permanent
  native removal of the exact profile, including its SOUL, memory, skills, local
  conversations and service. The owner must type the profile name in the app.
  Never delete the default/lead, active work or a manager with direct reports.
  Crew logs remain; removed members cannot continue work. Never replay uncertain
  deletion. Request owner inspection instead.
- `agent.attach`: `profile`, `skills`, `toolsets`, `expected_revision`.
  Select installed resources; no arbitrary URLs, commands, code or credentials.

Use the latest workspace revision. Every mutation creates a pending proposal for
review in the owner's app. No role, including orchestrator, can self-approve,
change trust, grant privileges or transfer the orchestrator. Reuse an existing
request after uncertain outcomes; never create duplicates or manually edit files.
Read request state through `describe`; pending, partial and uncertain are not
success. Never put service keys, tokens or complete transcript contents in specs.

Delegate using native `message_agent` with `native_target` from the live directory.
The integration also resolves configured public handles. Report to your immediate
manager and ultimately the orchestrator. A queue acknowledgement is not completion:
wait for a substantive result before starting dependent work. Do not invent task
scheduler guarantees or bypass owner approvals.
