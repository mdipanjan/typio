# Typio Feature Candidate Matrix

This document turns the inherited VS Code baseline in [VS.md](./VS.md) into candidate Typio product work.

It is not a commitment to build everything. It is a prioritization surface.

## Scoring

| Score | Meaning |
| --- | --- |
| 1 | Low |
| 2 | Moderate |
| 3 | High |

Columns:

- **User Value** — how much this helps users directly.
- **Differentiation** — how much this makes Typio feel distinct from stock VS Code.
- **Complexity** — implementation and maintenance difficulty.
- **Risk** — chance of breaking VS Code compatibility, trust, performance, or UX.
- **Stage** — suggested implementation stage.

## Stage Definitions

| Stage | Meaning |
| --- | --- |
| 0 | Docs, decisions, review only |
| 1 | Defaults, copy, onboarding, low-risk polish |
| 2 | Built-in extension or narrow workbench contribution |
| 3 | Deeper Agent/Sessions/workbench integration |
| 4 | Distribution, packaging, update, enterprise readiness |

---

## Highest-Priority Candidates

| Candidate | Baseline Area | User Value | Differentiation | Complexity | Risk | Stage | Notes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| First-run Typio welcome | Onboarding, Welcome | 3 | 3 | 1 | 1 | 1 | Explain Typio, VS Code compatibility, project open, sessions, auth. |
| Provider/auth connection center | Accounts, Auth, Trust | 3 | 3 | 2 | 2 | 2 | One clear place for GitHub/Copilot/Codex/Claude/provider state. |
| Project summary on open | Workspace, Project Metadata | 3 | 3 | 2 | 2 | 2 | Detect stack, package manager, commands, README, docs. |
| Agent session timeline per project | AgentHost, Sessions, Timeline | 3 | 3 | 3 | 2 | 3 | Make previous sessions understandable and resumable. |
| Command center for agent-native workflows | Search/Nav, Commands | 3 | 3 | 3 | 3 | 3 | Files, commands, sessions, tasks, branches, agent actions. |
| Agent change review surface | Git/SCM, Inline Edits | 3 | 3 | 3 | 3 | 3 | Show what changed, why, tests, accept/revert. |
| Fix failing test workflow | Testing, Problems, Terminal | 3 | 3 | 2 | 2 | 2 | Ground agent action in Test Explorer, Problems, terminal output. |
| Explicit model context inspector | Privacy, Indexing, AI Tools | 3 | 3 | 3 | 3 | 3 | Show files/diffs/errors/context sent to model/provider. |
| Agent terminal visibility and approvals | Terminal, Trust | 3 | 2 | 2 | 3 | 2 | Make commands visible, cancellable, and scoped. |
| Calm default shell/profile | Visual Shell, Settings | 2 | 3 | 1 | 2 | 1 | Product taste through defaults, not deep rewrites. |

---

## Candidate Matrix by Product Area

### Onboarding and Product Education

| Candidate | User Value | Differentiation | Complexity | Risk | Stage | Stance |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Typio welcome page | 3 | 3 | 1 | 1 | 1 | Build early. |
| Returning-user home/session resume | 3 | 3 | 2 | 2 | 2 | Build after session model review. |
| What's new / release education | 2 | 2 | 2 | 1 | 4 | Later, when distributing. |
| In-product glossary for agent/session/provider/model/tool | 2 | 2 | 1 | 1 | 1 | Good early copy work. |

### Project Understanding

| Candidate | User Value | Differentiation | Complexity | Risk | Stage | Stance |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Stack/package-manager detection | 3 | 2 | 2 | 2 | 2 | Build with conservative detection. |
| README/AGENTS/CONTRIBUTING summary | 3 | 3 | 2 | 2 | 2 | High leverage. |
| Detected dev/test/build commands | 3 | 2 | 2 | 2 | 2 | Use tasks/package scripts where possible. |
| Project health view | 2 | 3 | 3 | 2 | 3 | Later aggregation of Problems, tests, Git, sessions. |
| Large-repo context/index summary | 2 | 3 | 3 | 3 | 3 | Needs careful performance/privacy design. |

### Agent Sessions and Memory

| Candidate | User Value | Differentiation | Complexity | Risk | Stage | Stance |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Session timeline per project | 3 | 3 | 3 | 2 | 3 | Core Typio feature. |
| Better session titles/status/provenance | 3 | 3 | 2 | 2 | 2 | Good early polish. |
| Resume previous work flow | 3 | 3 | 2 | 2 | 2 | Build once metadata is understood. |
| Link sessions to branch/diff/terminal | 3 | 3 | 3 | 3 | 3 | Major workflow feature. |
| Recover interrupted agent session | 3 | 2 | 3 | 3 | 3 | Trust-critical later. |

### Auth, Trust, Privacy

| Candidate | User Value | Differentiation | Complexity | Risk | Stage | Stance |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Provider connection center | 3 | 3 | 2 | 2 | 2 | High priority. |
| Plain-language auth prompts | 3 | 2 | 1 | 2 | 1 | Early product polish. |
| Model context inspector | 3 | 3 | 3 | 3 | 3 | Very important, design carefully. |
| Trust-aware agent tools | 3 | 3 | 3 | 3 | 3 | Must respect workspace trust. |
| Dependency install approvals | 3 | 2 | 2 | 3 | 2 | Prevent unsafe agent setup behavior. |

### Code Editing and Review

| Candidate | User Value | Differentiation | Complexity | Risk | Stage | Stance |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Agent edit provenance | 3 | 3 | 3 | 3 | 3 | Key trust feature. |
| Multi-file change review | 3 | 3 | 3 | 3 | 3 | Build on SCM/diff primitives. |
| Native code-action vs agent-action clarity | 2 | 2 | 2 | 2 | 2 | Avoid over-agentifying quick fixes. |
| Generated-file/lockfile warnings | 2 | 2 | 2 | 2 | 2 | Good safety feature. |
| Conflict-aware agent apply/save | 3 | 2 | 3 | 3 | 3 | Important before autonomous edits. |

### Testing, Debugging, and Feedback Loops

| Candidate | User Value | Differentiation | Complexity | Risk | Stage | Stance |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Fix failing test workflow | 3 | 3 | 2 | 2 | 2 | High priority. |
| Explain Problems panel errors | 3 | 2 | 2 | 2 | 2 | Ground in diagnostics. |
| Debug failing test workflow | 2 | 3 | 3 | 3 | 3 | Later, debugger is complex. |
| Test/dev command detection | 3 | 2 | 2 | 2 | 2 | Pair with project summary. |
| Agent-readable terminal failure summary | 3 | 2 | 2 | 2 | 2 | Useful and scoped. |

### Terminal, Tasks, Ports, Runtime

| Candidate | User Value | Differentiation | Complexity | Risk | Stage | Stance |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Agent command timeline | 3 | 2 | 2 | 2 | 2 | Trust and auditability. |
| Visible stop/cancel agent command | 3 | 2 | 2 | 3 | 2 | Safety-critical. |
| Dev server detection | 2 | 2 | 2 | 2 | 2 | Useful, avoid noise. |
| Preview links attached to sessions | 2 | 2 | 2 | 2 | 3 | Good for web projects. |
| Environment/context indicator | 3 | 2 | 2 | 2 | 2 | Local vs remote vs container. |

### Navigation and Command Surfaces

| Candidate | User Value | Differentiation | Complexity | Risk | Stage | Stance |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Typio command center | 3 | 3 | 3 | 3 | 3 | Big differentiator, not first task. |
| Context chips for selected files/problems/tests/diffs | 3 | 3 | 2 | 2 | 2 | Good bridge to command center. |
| Session-aware quick open results | 2 | 3 | 3 | 3 | 3 | Later. |
| Consistent agent action naming | 2 | 2 | 1 | 1 | 1 | Do early. |

### Visual Design and Shell

| Candidate | User Value | Differentiation | Complexity | Risk | Stage | Stance |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Calmer default profile/layout | 2 | 3 | 1 | 2 | 1 | Early, reversible. |
| Better empty states | 3 | 3 | 2 | 1 | 1 | High-value polish. |
| Minimal session/provider status indicator | 2 | 2 | 2 | 2 | 2 | Avoid clutter. |
| Full shell redesign | 3 | 3 | 4 | 4 | 4 | Defer until product language is proven. |

### Extensions and Compatibility

| Candidate | User Value | Differentiation | Complexity | Risk | Stage | Stance |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Typio built-in extension for project intelligence | 3 | 3 | 2 | 2 | 2 | Preferred first implementation seam. |
| Curated extension recommendations | 2 | 2 | 1 | 1 | 1 | Useful but avoid marketplace issues. |
| Extension permission/trust explanation | 2 | 2 | 2 | 2 | 2 | Later. |
| Typio-specific extension APIs | 1 | 3 | 4 | 4 | 4 | Avoid early. |

### Distribution and Productization

| Candidate | User Value | Differentiation | Complexity | Risk | Stage | Stance |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Typio product identity/name/icon | 2 | 3 | 2 | 2 | 4 | Needed before distribution. |
| Separate user-data/profile paths | 3 | 2 | 2 | 3 | 4 | Important to avoid VS Code data damage. |
| Signing/notarization/update channel | 3 | 2 | 4 | 4 | 4 | Later release work. |
| Telemetry/privacy posture | 3 | 2 | 3 | 3 | 4 | Must be explicit before public release. |
| License/notice inventory | 2 | 1 | 2 | 3 | 4 | Required for release. |

---

## Recommended First Slice

The first product slice should avoid deep rewrites and prove Typio's taste:

1. **Typio welcome page**
   - explains product identity
   - offers Open Project, Resume Session, Start Agent Workflow
   - explains provider/auth state without forcing sign-in

2. **Project summary on open**
   - detects README/AGENTS/package manager/scripts
   - shows detected test/build/dev commands
   - does not modify project files

3. **Better session presentation**
   - friendly titles/status
   - clear workspace association
   - no fake/sentinel URI leakage

4. **Plain-language auth/provider state**
   - make GitHub/Copilot/Codex/Claude/provider needs explicit
   - no surprising startup prompts when avoidable

5. **Calm defaults and empty states**
   - use VS Code shell
   - reduce clutter through configuration/copy before deep UI changes

## Explicit Non-Goals for Early Stages

Do not start with:

- replacing Monaco/editor behavior
- replacing LSP/language intelligence
- replacing terminal/tasks/Git/debugger
- inventing a parallel extension system
- full shell rewrite
- custom package manager assumptions
- automatic dependency installs
- autonomous hidden agent commands
- distribution/signing/update work before product shape is proven

## Open Questions

1. What is Typio's primary user for the first slice: solo developer, agent-heavy power user, beginner, or team developer?
2. Should Typio default to showing sessions first, projects first, or command center first?
3. Which AI providers are first-class, optional, or hidden behind extension compatibility?
4. What is the minimum useful project memory model?
5. How much should Typio change visual design before workflows are proven?
6. Which features are upstreamable fixes versus product-only behavior?
