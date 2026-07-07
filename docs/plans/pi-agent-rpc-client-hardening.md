# Pi Agent RPC Client Hardening Plan

## Branch

`product/pi-agent-rpc-client-hardening`

## Context

The Pi Agent provider is integrated under the Agent Host provider boundary and uses `@earendil-works/pi-coding-agent` in RPC mode. Recent manual testing surfaced startup failures like:

```text
Pi CLI was not found ... Details: Agent process error: spawn node ENOENT
```

A related UI-side follow-on error was also observed:

```text
No AHP chat URI mapped for agent-host-pi:/...
```

That UI error is a secondary symptom when a backend session fails to hydrate; it should be fixed independently by not installing chat sync machinery until a chat channel is resolved.

## Non-goals / constraints

- Do **not** replace Pi's SDK `RpcClient` with a custom RPC subprocess client.
- Keep Pi behind the existing Agent Host provider abstraction (`IAgent`).
- Keep this as a local provider using the user's existing Pi auth/provider configuration.
- Avoid broad Agent Host protocol changes unless required.

## Relevant Pi docs findings

From `node_modules/@earendil-works/pi-coding-agent/docs/rpc.md`:

- RPC mode starts with:

  ```bash
  pi --mode rpc [options]
  ```

- RPC is JSONL over stdin/stdout.
- Node/TypeScript integrations can use Pi's typed subprocess client from `src/modes/rpc/rpc-client.ts`.
- `prompt` accepts `streamingBehavior` while the agent is streaming:
  - `"steer"`
  - `"followUp"`
- Pi also exposes dedicated commands:
  - `steer`
  - `follow_up`
- `follow_up` queues a message to be processed after the current agent run finishes.

The bundled `RpcClient` implementation currently spawns:

```ts
spawn("node", [cliPath, "--mode", "rpc", ...])
```

So even though the integration uses the bundled package CLI path, runtime startup still depends on a `node` executable being discoverable in the Agent Host process environment.

## Problems to solve

### 1. Runtime PATH / `node` discovery

Current failure mode:

```text
Agent process error: spawn node ENOENT
```

Likely cause: the Agent Host process is launched from the app/GUI environment, not from a shell initialized by `nvm`/`fnm`, so `node` is unavailable on `PATH`.

Required direction:

- Continue using Pi's `RpcClient`.
- Make the `RpcClient` spawn environment robust enough that `spawn("node", ...)` succeeds in dev and packaged scenarios.

Candidate approaches to investigate:

1. Provide `env.PATH` to `RpcClient` containing a stable Node location when one is known.
2. Support an explicit `VSCODE_AGENT_HOST_PI_NODE_PATH` override for the Pi child process environment.
3. Add common Node version-manager candidates (`nvm`, `fnm`) and Homebrew/system paths to the Pi child process `PATH` without replacing Pi's `RpcClient`.
4. If Pi's package can support it later, upstream/request/use a `nodePath` option in `RpcClientOptions`; do not block this branch on replacing the client.

### 2. Follow-up command semantics

Current code queues follow-ups using:

```ts
record.client.request('prompt', { message: prompt, streamingBehavior: 'followUp' })
```

Docs say this is accepted during streaming, but Pi also provides a dedicated `follow_up` command and the typed `RpcClient` has `followUp(...)`.

Decision to validate:

- Prefer the typed/dedicated `follow_up` path if compatible with Agent Host queued-message semantics.
- Add regression coverage that active-turn follow-up dispatches the documented RPC command/payload.

### 3. Error classification/message accuracy

Current setup error says:

```text
Pi CLI was not found. Install Pi and make sure the `pi` command is on PATH
```

But this integration uses bundled `@earendil-works/pi-coding-agent`; the observed failure was missing `node`, not missing `pi`.

Improve messages to distinguish:

- missing `node` used by Pi `RpcClient`
- missing/unreachable bundled Pi CLI path
- Pi auth required
- inactive subscription
- provider configuration missing

### 4. Secondary UI error after failed hydration

Keep/finalize the guard already identified in `AgentHostSessionHandler`: only install pending-message/draft sync for an existing session after a chat URI is resolved.

This prevents:

```text
No AHP chat URI mapped for agent-host-pi:/...
```

from masking the real Pi startup failure.

### 5. Package-lock hygiene

Current working tree has unrelated `package-lock.json` churn. Before finalizing:

- determine whether the lockfile changes are required for the Pi package update
- revert incidental npm metadata churn if not required

## Implementation steps

1. [x] Add/keep regression for the AHP chat URI guard.
2. [x] Add PiAgent regression for queued follow-up command shape.
3. [x] Update PiAgent follow-up sending to use documented `follow_up` semantics.
4. [x] Harden `PiRpcClient.spawn(...)` environment while still using Pi package `RpcClient`.
5. [x] Improve setup error messages for missing `node` vs missing Pi RPC entry point/auth/provider errors.
6. [x] Run validation:
   - `npm run typecheck-client`
   - targeted Pi node tests:
     - `src/vs/platform/agentHost/test/node/piRpcClient.test.ts`
     - `src/vs/platform/agentHost/test/node/piAgent.test.ts`
   - targeted Agent Host chat test for the chat URI guard
7. [x] Clean up package-lock because the observed changes were unrelated npm metadata churn.

## Open questions

- In the Agent Host utility process, what stable runtime should satisfy Pi `RpcClient`'s hardcoded `spawn("node", ...)` in packaged builds?
- Should `chat.agentHost.piAgent.enabled` remain `default: true` while startup depends on local runtime conditions, or should it be experiment/quality-gated?
- Does Pi prefer `prompt` + `streamingBehavior: "followUp"` or dedicated `follow_up` for IDE embedding? Docs support both paths in slightly different sections; tests should encode our chosen semantics.
