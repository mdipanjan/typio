# Product Vision: Tasteful Agent-Native VS Code Fork

## Context

We are building a VS Code fork because VS Code already provides the hard editor substrate: editor core, language intelligence, workbench shell, terminal, Git, extensions, remote foundations, and now substantial chat/agent/session infrastructure.

Building a full editor from scratch would likely take years before reaching baseline usefulness. Our product opportunity is not to rebuild text editing. It is to curate and reshape VS Code into a tasteful, agent-native workbench.

## What We Inherit from VS Code

### Core editor

- Monaco text editor
- multi-file tabs and split editors
- syntax highlighting
- folding
- multi-cursor editing
- find/replace
- diff and merge editors
- breadcrumbs, outline, symbol navigation

**Implication:** we do not rebuild the editor core.

### Language intelligence

- LSP support
- IntelliSense
- diagnostics
- hover docs
- go to definition/references
- rename symbol
- formatting
- semantic highlighting
- inlay hints
- code lenses

**Implication:** keep VS Code's language stack. Our value is workflow, context, and orchestration.

### Workbench shell

- activity bar, side bar, panel
- editor groups
- command palette and quick open
- settings and keybindings UI
- themes
- persisted layout

**Implication:** reshape for taste, but avoid deep shell rewrites early.

### Files, workspace, terminal, Git

- file explorer
- multi-root workspaces
- workspace search
- integrated terminal
- tasks and problem matchers
- debugger
- built-in Git/SCM primitives
- diff/commit/stage/branch flows

**Implication:** agent workflows should use these primitives rather than inventing a parallel execution or source-control system.

### Extension ecosystem

- extension host
- extension API
- built-in extensions
- marketplace/gallery support depending on product configuration
- language/theme/debug/test extensions

**Implication:** extension compatibility is a strategic asset. We should not break extension assumptions casually.

### Chat, AgentHost, and Sessions

This fork includes substantial AI/session infrastructure:

```txt
src/vs/workbench/contrib/chat/
src/vs/platform/agentHost/
src/vs/sessions/
extensions/copilot/
```

Capabilities include:

- chat UI
- AgentHost process and IPC
- local/remote agent-host providers
- Copilot/Claude/Codex session support
- session list/history
- model/provider plumbing
- tool and permission flows
- session metadata, working directories, changesets, terminals
- restored previous Codex sessions via Codex thread listing

**Implication:** Agent/Sessions is a major inherited product base. We should preserve and curate it first, not rip it out.

## What VS Code Does Not Give Us by Default

### Strong taste and editorial point of view

VS Code is powerful but generic. It does not have one singular product taste.

Opportunity:

- calmer UI
- better defaults
- less clutter
- beautiful onboarding
- coherent product language

### Clear AI onboarding

Current behavior can surprise users with GitHub/Copilot/Codex auth prompts.

Opportunity:

- make provider state explicit
- explain why sign-in is requested
- keep sign-in optional where possible
- reduce noisy startup prompts

### Agent-first command center

VS Code has command palette and quick open, but not a unified agent-native command center.

Opportunity:

- one surface for files, commands, sessions, AI actions, tasks, docs, branches
- actions like Continue Session, Review Diff, Fix Test, Plan Change

### Project understanding

VS Code opens a repo but does not deeply explain it.

Opportunity:

- detect stack and package manager
- detect test/build/dev commands
- read README, AGENTS.md, CONTRIBUTING
- summarize repo structure
- surface active branches, sessions, and tasks
- maintain project memory

### Tasteful session memory

The Sessions UI is promising, but raw.

Opportunity:

- make previous agent sessions feel like a timeline of work
- better grouping and titles
- clearer status/provenance
- easier resume flow
- per-project agent history

### Opinionated AI workflows

Stock chat is flexible but broad.

Opportunity:

- Plan
- Implement
- Review
- Fix Test
- Explain Repo
- Create PR
- Continue Session

The goal is to guide users into useful flows instead of leaving them with a blank chatbot.

## Explicit Product Decisions

### Decision 1: We inherit VS Code core, not rebuild it

We will not rebuild the text editor, language service stack, terminal, Git, debugger, extension host, or file/workspace primitives.

### Decision 2: Agent/Sessions is a first-class product pillar

The existing AgentHost and Sessions infrastructure is strategically valuable. We will initially preserve it and improve the surrounding experience.

### Decision 3: Product behavior should live outside core when possible

Most new behavior should live in built-in extensions/providers or narrow workbench contributions. Deep core changes are reserved for shell, onboarding, layout, and places where extension APIs are insufficient.

### Decision 4: Taste and onboarding come before backend rewrites

The first product win is making the editor feel intentional, calm, and understandable. We should not start by replacing AgentHost/Copilot/Codex internals unless they block the experience.

### Decision 5: Preserve extension compatibility as long as possible

Compatibility with VS Code extensions is a core advantage of the fork. We should avoid changes that break standard extension assumptions.

### Decision 6: Authentication must be explicit, never surprising

If GitHub, Copilot, Codex, Claude, or another provider requires auth, the product should explain why, what is enabled, and what happens if the user skips it.

### Decision 7: We compete on workflow, memory, and taste

The product should not compete on raw editor primitives. It should compete on:

- agent-native workflows
- session memory
- project understanding
- calm visual design
- excellent defaults
- guided command center

## Strategic Summary

We are not building an editor from scratch.

We are curating VS Code into a tasteful, agent-native workbench where previous sessions, project context, terminal/Git state, and AI workflows feel like one coherent product.
