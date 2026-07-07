# Pi Agent Integration Plan

## Purpose

Make Typio feel agent-native by adding **Pi Agent** as a first-class Agent Host provider inside the existing VS Code Sessions/Agents architecture.

This is the first major Typio product feature after documentation and branch setup. It should prove that Typio can differentiate through agent workflow, not just branding.

## One-Line Goal

A user can open Typio, choose **Pi Agent**, start a session in the current workspace, send prompts, watch streamed output/tool activity, stop/resume the session, and keep using their existing Pi subscription/login state rather than configuring model API keys in Typio.

## Current Implementation Status

Typio now has a working Pi Agent provider path:

```txt
Typio workbench / Sessions UI
  -> AgentHost IAgent provider: PiAgent
    -> pi --mode rpc subprocess
      -> Pi auth/provider/session/tool runtime
```

Completed implementation:

- Pi Agent provider skeleton and registration.
- Enable flag/env forwarding:
  - `chat.agentHost.piAgent.enabled`
  - `VSCODE_AGENT_HOST_PI_AGENT_ENABLED`
- Pi is no longer gated behind Copilot entitlement/sign-in/custom-model requirements.
- Pi supports the AgentHost synthetic Auto model path.
- RPC client for `pi --mode rpc` with JSONL request/response/event handling.
- Session startup with `get_state` handshake.
- Prompt send and abort.
- Prompt while busy queues as `streamingBehavior: 'followUp'` instead of surfacing raw Pi busy errors.
- Text stream mapping:
  - `message_update.text_start`
  - `message_update.text_delta`
- Thinking/reasoning stream mapping:
  - `message_update.thinking_start`
  - `message_update.thinking_delta`
- Tool lifecycle mapping:
  - `tool_execution_start`
  - `tool_execution_update`
  - `tool_execution_end`
- Runtime status/event mapping:
  - `queue_update`
  - `compaction_start`
  - `compaction_end`
  - `auto_retry_start`
  - `auto_retry_end`
- Final answer fallback from `agent_end.messages` when Pi did not stream text deltas.
- Usage mapping from final assistant message usage metadata.
- Basic `extension_ui_request` handling for input/select/confirm/editor/notify/status/title/widget/editor-text events.
- Friendly setup/runtime errors for missing Pi CLI, auth/provider/subscription failures, prompt failures, abort, and process exit during active turns.
- Tests for provider registration, RPC client, event mapper, session startup, errors, tool events, busy queueing, and runtime mappings.

Important limitation: this is still a **runtime bridge**, not yet a full native Pi product surface. Session persistence, transcript hydration, model controls, image attachments, command discovery, and file-change review remain to be built.

## Product Architecture Stance

Typio should be a VS Code-based shell for pluggable agent engines. Pi is the first/default deep integration, but not the only possible future engine.

```txt
Typio shell / IDE substrate
  -> AgentHost provider seam
    -> Pi provider
    -> Copilot provider
    -> Claude provider
    -> Codex provider
    -> future local/cloud/company agents
```

Pi-specific code should stay isolated under:

```txt
src/vs/platform/agentHost/node/pi/
```

Generic Typio UX should remain provider-agnostic where possible: Agent, Task, Session, Engine, Model, Tools. Pi-specific language belongs in setup/provider-specific surfaces.

## Non-Goals for the First Slice

- Do not replace the VS Code editor/workbench shell.
- Do not remove Copilot/Claude/Codex providers yet.
- Do not implement model-provider OAuth in Typio.
- Do not require model API keys in Typio.
- Do not build a custom chat UI from scratch.
- Do not deeply rebrand package names, app IDs, or marketplace metadata.
- Do not change Pi internals unless the integration exposes a Pi-side gap.

## Existing VS Code Architecture to Reuse

VS Code already has the correct integration seam.

```txt
Sessions UI / Agents window
  -> ISessionsManagementService
    -> ISessionsProvidersService
      -> LocalAgentHostSessionsProvider
        -> IAgentHostService / IAgentConnection
          -> AgentService
            -> registered IAgent implementations
               - CopilotAgent
               - ClaudeAgent
               - CodexAgent
               - PiAgent (new)
```

Important distinction:

- **Sessions providers** are the UI/list/session-management layer.
- **Agents** are runtime backends registered inside the Agent Host process.

Therefore, Pi should be added as a new `IAgent` backend, not by rewriting the Sessions UI.

## Proposed User Experience

### First Slice UX

1. User opens a workspace in Typio.
2. User opens the Agents/Sessions flow.
3. New session picker includes:
   - Copilot / existing agents where enabled
   - **Pi Agent**
4. User selects **Pi Agent**.
5. Typio starts a local Pi RPC process in the selected workspace.
6. User sends a prompt.
7. Typio displays:
   - assistant text streaming
   - tool calls / bash output as activity
   - errors in plain language
8. The session appears in the Sessions list and can be reopened.

### Desired Empty/Auth States

If Pi is not installed:

```txt
Pi Agent is not installed.
Install it with: npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

If Pi is installed but not authenticated/configured:

```txt
Pi Agent needs a model login.
Run `pi /login` in a terminal, or configure your Pi provider/API key.
```

If Pi is available:

```txt
Pi Agent ready
Using your existing Pi login/configuration.
```

### Subscription/Auth Stance

Typio should not directly authenticate with Anthropic, OpenAI, GitHub Copilot, etc. in the first slice.

Instead:

```txt
Typio -> local Pi RPC process -> Pi auth/provider/session layer -> model provider
```

This lets users use existing Pi-supported auth paths, including subscriptions and API keys already configured in Pi.

## Integration Strategy

### Recommended First Implementation: Pi RPC Subprocess

Use Pi's documented RPC mode:

```bash
pi --mode rpc
```

Pi RPC is designed for IDE/custom UI embedding and uses LF-delimited JSONL over stdin/stdout.

Benefits:

- Keeps Typio independent from Pi internal APIs.
- Avoids bundling Pi as a library at first.
- Reuses Pi auth/provider/session behavior.
- Keeps crash boundaries clear: if Pi fails, the Agent Host can report a provider/session error.
- Matches how Codex-style integrations often wrap an external agent runtime.

### Later Option: Pi SDK Embedding

Pi also exposes an SDK. We should consider it only after the RPC slice works.

Use SDK embedding if we need:

- tighter lifecycle control
- lower process overhead
- direct access to richer typed objects
- better session import/export integration

Keep the first slice subprocess-based unless there is a blocking RPC limitation.

## New Code Shape

Proposed files:

```txt
src/vs/platform/agentHost/node/pi/piAgent.ts
src/vs/platform/agentHost/node/pi/piRpcClient.ts
src/vs/platform/agentHost/node/pi/piEventMapper.ts
src/vs/platform/agentHost/node/pi/piSessionStore.ts
src/vs/platform/agentHost/node/pi/piSessionConfig.ts
```

Registration point:

```txt
src/vs/platform/agentHost/node/agentHostMain.ts
```

Proposed registration:

```ts
agentService.registerProvider(instantiationService.createInstance(PiAgent));
```

Eventually gate behind a setting/env var:

```txt
chat.agentHost.piAgent.enabled
```

Default for Typio can be on. Upstream VS Code compatibility can keep it off if needed.

## Agent Identity

Provider descriptor:

```ts
{
  provider: 'pi',
  displayName: 'Pi Agent',
  description: 'Use Pi as a local coding agent with your existing Pi login and provider configuration.',
  capabilities: { ... }
}
```

Expected session scheme from existing Agent Host machinery:

```txt
agent-host-pi
```

## Minimal `IAgent` Surface

`PiAgent` should implement the same `IAgent` interface as Copilot/Claude/Codex.

### Required for First Slice

- `id = 'pi'`
- `getDescriptor()`
- `createSession(config)`
- `resolveSessionConfig(params)`
- `sessionConfigCompletions(params)`
- `chats.sendMessage(...)`
- `chats.abort(...)`
- `getSessionMessages(session)`
- `disposeSession(session)`
- `respondToPermissionRequest(...)`
- `respondToUserInputRequest(...)`
- `models`
- `listSessions()`
- `getProtectedResources()`

Some methods can be no-op or conservative in the first slice, but they should fail gracefully and with clear logs.

### Likely First-Slice Capability Choices

- Single default chat per session.
- No multi-chat peer tabs initially.
- No subagents initially.
- No custom model list unless Pi RPC exposes it cleanly.
- No Typio-managed provider auth.
- Workspace-backed sessions supported.
- Quick chat optional; can defer if workspace-less Pi behavior is unclear.

## Pi RPC Client Responsibilities

`piRpcClient.ts` owns the subprocess and JSONL protocol.

Responsibilities:

- Locate `pi` executable.
- Spawn `pi --mode rpc` with selected working directory.
- Send JSON commands with ids.
- Parse stdout as strict LF-delimited JSONL.
- Correlate `type: "response"` messages by id.
- Emit Pi events for stream mapping.
- Capture stderr for diagnostics.
- Enforce startup timeout.
- Handle process exit and restart policy.
- Avoid Node `readline`; Pi docs warn generic line readers can split on Unicode separators.

Pseudo-flow:

```txt
createSession(workspace)
  -> spawn pi --mode rpc --name <title?>
  -> get_state
  -> create Agent Host session metadata

sendMessage(session, text)
  -> send { id, type: "prompt", message: text }
  -> receive response accepted
  -> stream events:
       agent_start
       message_update text_delta
       tool_execution_start/update/end
       turn_end
       agent_end
  -> map into Agent Host signals/turns
```

## Mapping Pi RPC to Agent Host

### Pi Prompt Command

Pi input:

```json
{"id":"req-1","type":"prompt","message":"Implement the parser"}
```

VS Code side source:

- User chat request text from Agent Host chat handler.
- Context attachments can be deferred; send plain text first.

### Pi Abort Command

Pi input:

```json
{"id":"req-2","type":"abort"}
```

Map from Agent Host abort/stop request.

### Pi Streaming Events

Pi event examples:

- `agent_start`
- `message_update` with `assistantMessageEvent.type = "text_delta"`
- `tool_execution_start`
- `tool_execution_update`
- `tool_execution_end`
- `turn_end`
- `agent_end`

Map to Agent Host `AgentSignal` / `Turn` structures.

First pass should prioritize correctness over richness:

| Pi RPC event | Typio/Agent Host rendering target | Status |
|--------------|------------------------------------|--------|
| `message_update.text_start` | Assistant text response part | Done |
| `message_update.text_delta` | Assistant text delta | Done |
| `message_update.thinking_start` | Reasoning response part | Done |
| `message_update.thinking_delta` | Reasoning delta | Done |
| `tool_execution_start` | Tool call started/ready | Done |
| `tool_execution_update` | Tool output/progress update | Done |
| `tool_execution_end` | Tool result completed/failed | Done |
| `turn_end` | Internal turn boundary only; do not complete Typio request | Done |
| `agent_end` | Complete Typio turn; fallback final text; usage | Done |
| `queue_update` | Activity/status for queued messages | Partial |
| `compaction_start` | Activity/status | Done |
| `compaction_end` | Activity/status + system notification | Done |
| `auto_retry_start` | Activity/status | Done |
| `auto_retry_end` | Clear activity/status | Done |
| `extension_ui_request` | Basic input/select/confirm/notify/status mapping | Partial |
| process error/exit | Session error signal | Done |

## Remaining Pi Capability Coverage

### Highest Priority

1. **Session persistence and resume**
   - Persist Typio session URI ↔ Pi `sessionId` / `sessionFile` / `sessionName`.
   - Use Pi `switch_session`, `fork`, `clone`, `new_session`, and/or CLI session options after verifying exact support.
   - Reopen a prior Pi session after Typio reload.

2. **Transcript hydration**
   - Implement `getSessionMessages()` and chat `getMessages()` using Pi `get_messages` or AgentHost persisted state.
   - Render historical user, assistant, reasoning, tool, and system messages.

3. **Native file-change surface**
   - Detect Pi-created file edits and map them into VS Code-native change review/apply/revert surfaces.
   - Avoid relying only on tool output text.

4. **Model and thinking controls**
   - `get_available_models`
   - `set_model`
   - `cycle_model`
   - `set_thinking_level`
   - `cycle_thinking_level`
   - Surface current Pi provider/model/thinking level in Typio.

5. **Image/context attachments**
   - Translate Typio image attachments into Pi `prompt.images` / content blocks.
   - Preserve workspace/file/context attachments in prompts.

6. **Slash commands, skills, and templates**
   - Use Pi command discovery (`get_commands`) to power input autocomplete or a command picker.
   - Make Pi skills/templates discoverable without requiring users to know Pi CLI syntax.

### Medium Priority

7. **Steering vs follow-up UX**
   - Current busy prompt behavior uses `streamingBehavior: 'followUp'`.
   - Add explicit “steer current run” affordance using `steer` / `streamingBehavior: 'steer'`.
   - Consider exposing `set_steering_mode` and `set_follow_up_mode`.

8. **Compaction controls**
   - `compact`
   - `set_auto_compaction`
   - Show context usage/token pressure and let user manually compact.

9. **Auto-retry controls**
   - `set_auto_retry`
   - `abort_retry`
   - We show retry status now; users cannot control it yet.

10. **Session stats and cost/context meter**
    - `get_session_stats`
    - Show current context usage, token usage, and cost where available.

11. **Session tree / fork visualization**
    - `get_entries`
    - `get_tree`
    - Show Pi's branch/fork structure in a Typio-native session/tree UI.

12. **Session title sync**
    - Map Pi `session_info_changed` or equivalent state updates to Typio session labels.
    - Use `set_session_name` where appropriate.

### Lower Priority / Later

13. **Direct Pi bash command controls**
    - `bash`
    - `abort_bash`
    - Useful for explicit user-driven terminal actions, separate from LLM tool calls.

14. **HTML export**
    - `export_html`

15. **Full native extension UI**
    - Current `extension_ui_request` handling is basic.
    - Build tasteful native surfaces for `setWidget`, `setStatus`, `editor`, and `set_editor_text` instead of representing most as notifications.

16. **Advanced Pi launch configuration**
    - `--provider`
    - `--model`
    - `--name`
    - `--session-dir`
    - `--no-session`
    - explicit executable path and extra args.

## Session Persistence Strategy

There are two persistence layers:

1. VS Code Agent Host session catalog/state.
2. Pi's own session files/config.

First slice should keep a lightweight Typio-side mapping:

```txt
Agent Host session URI -> Pi session file/path/id, cwd, title, createdAt, updatedAt
```

Potential implementation file:

```txt
piSessionStore.ts
```

Use existing Agent Host data paths where possible via `ISessionDataService` rather than inventing a new global store.

### Resume Behavior

First acceptable resume:

- Sessions list shows previous Pi sessions created by Typio.
- Opening a session reconstructs visible history from stored Agent Host turns and/or Pi `get_messages`.
- Sending a new message resumes the same Pi session if Pi RPC supports loading it cleanly; otherwise record as a limitation and create a new Pi process bound to the prior session file.

Open question for implementation:

- Which Pi RPC command/CLI option should load an existing session file for true continuation?
- If only session file paths are exposed via `get_state`, can a new `pi --mode rpc --session <path>` style resume be used? Verify from Pi docs/source before coding.

## Configuration

First slice configuration should be intentionally small.

Potential session config fields:

| Field | Default | Notes |
|-------|---------|-------|
| `workingDirectory` | selected workspace | Already passed by Agent Host create session config. |
| `model` | Pi default | Do not duplicate Pi's model picker yet. |
| `approval/trust` | Pi default | Pi owns tool behavior initially. |
| `sessionName` | first prompt/title | Can pass `--name` at process start if known. |

Future config fields:

- Pi model selection
- thinking level
- approval mode
- session directory
- custom Pi executable path
- extra CLI args
- use local npm package vs global `pi`

## Install/Discovery Strategy

Search order for `pi` executable:

1. User setting: explicit Pi executable path.
2. Bundled/dev path if Typio ships Pi later.
3. `PATH` lookup for `pi`.
4. Helpful unavailable state.

Proposed setting names:

```txt
typio.piAgent.enabled
typio.piAgent.executablePath
typio.piAgent.extraArgs
typio.piAgent.sessionDirectory
```

If we want to align with inherited Agent Host naming:

```txt
chat.agentHost.piAgent.enabled
chat.agentHost.piAgent.executablePath
```

Decision pending: use `typio.*` for product-owned settings, or `chat.agentHost.*` for consistency with existing Agent Host toggles.

## Error Handling Requirements

Errors must be product-quality, not raw stack traces.

Minimum cases:

| Case | User-facing message |
|------|---------------------|
| `pi` not found | Pi is not installed; show install command. |
| Pi exits immediately | Pi Agent failed to start; show stderr/log action. |
| Not logged in / no model | Pi needs login or provider configuration. |
| Prompt rejected while streaming | Queue as steering/follow-up or ask user to wait. |
| Workspace unavailable | Start as quick chat or ask user to select a folder. |
| JSON parse error | Pi RPC protocol error; include log export path. |
| Long startup | Pi Agent is taking longer than expected; offer retry. |

## Security and Trust

- Treat Pi as a local tool-running agent with filesystem and shell access.
- Preserve VS Code workspace trust behavior before starting workspace sessions.
- Do not silently grant broader permissions than Pi would normally request.
- Do not store model provider tokens in Typio.
- Do not echo secrets from env/stderr into UI logs without redaction review.
- Keep subprocess environment minimal but compatible with user auth/config.

## Testing Plan

### Unit Tests

Add focused tests around:

- JSONL parser with LF-only framing.
- response correlation by id.
- Pi event -> Agent Host signal/turn mapping.
- process exit/error states.
- session metadata persistence.

Potential test location:

```txt
src/vs/platform/agentHost/test/node/pi/
```

### Integration Tests

Use a fake Pi executable/script that emits deterministic RPC events.

Scenarios:

1. Session starts and descriptor appears.
2. Prompt accepted and text delta renders.
3. Tool execution events map to progress/result.
4. Abort command is sent.
5. Process exits mid-turn and session enters error state.
6. Prior session metadata lists after restart.

### Manual Validation

```bash
npm run watch
./scripts/code.sh --user-data-dir /tmp/typio-pi-user --extensions-dir /tmp/typio-pi-exts
```

Manual checklist:

- Pi Agent appears in new-session picker.
- Start Pi session in current workspace.
- Send: `summarize this project`.
- Text streams into chat.
- Tool calls are visible enough to understand what happened.
- Stop/abort works.
- Reload window; prior session still appears.
- If `pi` is unavailable, error is clear.

## Staged Implementation

### Stage 0 — Planning and Scaffolding — Done

- Document this plan.
- Confirm branch target and PR flow.
- Verify Pi RPC docs/types enough for first integration.
- Decide initial setting namespace: `chat.agentHost.piAgent.enabled`.

Exit criteria: met.

### Stage 1 — Provider Discovery Skeleton — Done

- Add `PiAgent` class implementing `IAgent` with conservative behavior.
- Register it in AgentHost main/server entry points behind enable flag/env forwarding.
- Expose descriptor: `Pi Agent`.
- Confirm it appears in session type picker.
- Remove Copilot entitlement/sign-in/custom-model gating for Pi.

Exit criteria: met.

### Stage 2 — RPC Client and Session Creation — Done

- Implement `PiRpcClient` subprocess wrapper.
- Locate/spawn `pi --mode rpc`.
- Implement `get_state` handshake.
- Create Agent Host session metadata.
- Implement clear install/auth/startup errors.

Exit criteria: met for live sessions. Persistent session metadata remains Stage 4.

### Stage 3 — Send, Stream, Abort — Mostly Done

- Implement prompt send.
- Map text deltas into assistant response.
- Map thinking deltas into reasoning response.
- Map tool start/update/end into tool call parts.
- Implement abort.
- Queue busy prompts as follow-ups.
- Complete only on `agent_end`, not `turn_end`.
- Fallback to final assistant text from `agent_end.messages`.
- Map usage metadata.
- Map basic compaction/retry/queue/activity events.

Exit criteria: met for basic conversation, streaming, tools, abort, and reliability. Persistent final turn history remains Stage 4.

### Stage 4 — Persistence and Resume — Next

- Persist session mapping.
- List prior Typio-created Pi sessions.
- Rehydrate messages from Pi/Typio state.
- Resume existing Pi session if supported.
- Sync Pi session title/name.

Exit criteria:

- Reload Typio and reopen a Pi session.
- Continue conversation without losing visible history.

### Stage 5 — Native Pi Capability Surface — Next

- Model picker from Pi `get_available_models`.
- Thinking level controls.
- Manual/auto compaction controls.
- Steering vs follow-up control.
- Session stats/context usage/cost meter.
- Image/context attachment translation.
- Slash command/skill/template discovery.
- Native file-change review/apply/revert.

Exit criteria:

- Pi feels like a native Typio engine, not a subprocess text bridge.

### Stage 6 — UX Polish

- Add final display labels/icons.
- Improve status and empty states.
- Add “Open Pi logs” or “Export Pi debug info”.
- Add setting for executable path and extra args.
- Decide whether Pi becomes the Typio default agent.
- Keep provider-agnostic UI language so future agents can plug into the same shell.

Exit criteria:

- Feature is usable by a normal Typio user without knowing implementation details.

## Open Questions

1. Which exact Pi CLI/RPC command should Typio use to resume an existing session file in a fresh RPC process?
2. Should Typio persist AgentHost state, Pi session state, or both as the transcript source of truth?
3. Can Pi RPC expose current provider/model/login state clearly enough for Typio setup/status text?
4. Does Pi RPC expose structured diffs/file edits, or should Typio watch workspace changes and infer change sets?
5. Should Typio use `typio.piAgent.*` settings for product-owned configuration, while keeping `chat.agentHost.piAgent.enabled` for the inherited provider toggle?
6. Should Pi be enabled by default in dev builds only, or in all Typio builds?
7. Should quick chat be supported in the first implementation?
8. Should Pi sessions be isolated in worktrees, or initially run directly in the selected workspace?
9. How much of Pi's TUI-only UX should be represented in Typio versus intentionally omitted?
10. What provider-agnostic capability contract is needed so future non-Pi agents can reuse the same Typio UI surfaces?

## Risks

| Risk | Mitigation |
|------|------------|
| Agent Host `IAgent` contract is broad | Implement the narrowest safe subset; copy patterns from Codex/Claude. |
| Pi RPC lacks resume details | Use Typio-side visible history first; add true Pi resume after verifying support. |
| Tool event mapping is lossy | Start with text/tool progress; improve structured diffs later. |
| Auth failures are provider-specific | Let Pi own auth; Typio surfaces Pi's status and suggests `pi /login`. |
| Subprocess lifecycle bugs | Build a fake Pi test harness before real Pi integration gets complex. |
| Upstream VS Code churn | Keep Pi code isolated under `node/pi/` with one registration touchpoint. |

## Recommended First PR Breakdown

1. **Plan PR**
   - Add this document.
   - No runtime code.

2. **Skeleton PR**
   - Add `PiAgent` descriptor and enable setting.
   - Prove picker integration.

3. **RPC Client PR**
   - Add subprocess client and fake-Pi tests.
   - No full UI send yet.

4. **Conversation PR**
   - Prompt/send/stream/abort.

5. **Persistence PR**
   - List/reopen/resume sessions.

6. **Polish PR**
   - Error states, settings, logs, defaults.

## Definition of Done for First Major Feature

Pi Agent integration is considered first-slice complete when:

- Pi appears as a first-class agent option.
- A Pi session can be created in the current workspace.
- Basic input/output works.
- Streaming text is visible.
- Tool activity is visible enough to trust what happened.
- Abort works.
- Sessions appear in the Sessions list.
- A session can be reopened after reload with history intact.
- Missing install/auth/config states are plain-language and actionable.
- No product changes are merged into `vscode/main`.
