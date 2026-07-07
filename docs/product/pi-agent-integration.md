# Pi Agent Integration Plan

## Purpose

Make Typio feel agent-native by adding **Pi Agent** as a first-class Agent Host provider inside the existing VS Code Sessions/Agents architecture.

This is the first major Typio product feature after documentation and branch setup. It should prove that Typio can differentiate through agent workflow, not just branding.

## One-Line Goal

A user can open Typio, choose **Pi Agent**, start a session in the current workspace, send prompts, watch streamed output/tool activity, stop/resume the session, and keep using their existing Pi subscription/login state rather than configuring model API keys in Typio.

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

| Pi RPC event | Typio/Agent Host rendering target |
|--------------|------------------------------------|
| `message_update.text_delta` | Assistant text response part |
| `tool_execution_start` | Tool call started/progress item |
| `tool_execution_update` | Tool output/progress update |
| `tool_execution_end` | Tool result completed/failed |
| `turn_end` | Persist completed assistant turn |
| process error/exit | Session error signal |

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

### Stage 0 — Planning and Scaffolding

- Document this plan.
- Confirm branch target and PR flow.
- Verify Pi RPC resume/session commands from Pi docs/source.
- Decide setting namespace.

Exit criteria:

- Plan reviewed.
- Implementation branch is based on `develop` or rebased after docs PR lands.

### Stage 1 — Provider Discovery Skeleton

- Add `PiAgent` class implementing `IAgent` with conservative no-op behavior.
- Register it in `agentHostMain.ts` behind an enable flag.
- Expose descriptor: `Pi Agent`.
- Confirm it appears in session type picker.

Exit criteria:

- No prompt sending yet.
- Typecheck passes.
- Pi Agent appears only when enabled.

### Stage 2 — RPC Client and Session Creation

- Implement `PiRpcClient` subprocess wrapper.
- Locate/spawn `pi --mode rpc`.
- Implement `get_state` handshake.
- Create Agent Host session metadata.
- Implement clear install/auth/startup errors.

Exit criteria:

- Creating a Pi session starts Pi RPC and creates a session item.
- Failure states are understandable.

### Stage 3 — Send, Stream, Abort

- Implement prompt send.
- Map text deltas into assistant response.
- Map basic tool start/update/end into progress parts.
- Implement abort.
- Persist final turn history.

Exit criteria:

- User can hold a basic working conversation with Pi in Typio.
- Streaming works.
- Abort works.

### Stage 4 — Persistence and Resume

- Persist session mapping.
- List prior Typio-created Pi sessions.
- Rehydrate messages from Pi/Typio state.
- Resume existing Pi session if supported.

Exit criteria:

- Reload Typio and reopen a Pi session.
- Continue conversation without losing visible history.

### Stage 5 — UX Polish

- Add final display labels/icons.
- Improve status and empty states.
- Add “Open Pi logs” or “Export Pi debug info”.
- Add setting for executable path.
- Decide whether Pi becomes the Typio default agent.

Exit criteria:

- Feature is usable by a normal Typio user without knowing implementation details.

## Open Questions

1. Which exact Pi CLI/RPC command resumes an existing session file?
2. Can Pi RPC expose current provider/model/login state clearly enough for Typio status text?
3. Does Pi RPC expose structured diffs/file edits, or do we infer from tool output/file changes?
4. Should Typio use `typio.piAgent.*` settings or inherited `chat.agentHost.piAgent.*` settings?
5. Should Pi be enabled by default in dev builds only, or in all Typio builds?
6. Should quick chat be supported in the first implementation?
7. Should Pi sessions be isolated in worktrees, or initially run directly in the selected workspace?
8. How much of Pi's TUI-only UX should be represented in Typio versus intentionally omitted?

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
