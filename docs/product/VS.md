# VS Code Capability Map

This document describes what we inherit from VS Code before we redesign it into Typio.

It is intentionally broader than technical architecture. VS Code is not just an editor engine; it is a mature product made of UI surfaces, workflows, defaults, extension contracts, mental models, and accumulated edge-case behavior.

Use this document to answer:

- What does VS Code already do well?
- What should Typio keep unchanged?
- What should Typio simplify, polish, or reframe?
- Which areas are risky to touch early?
- Which areas create product leverage for an agent-native fork?

Typio's redesign direction belongs in [vision.md](./vision.md). This file is the baseline inventory.

---

## 1. Editor Core

### What VS Code Provides

- Monaco editor
- tabs and editor groups
- split editors
- text selection, multi-cursor, folding
- syntax highlighting
- find and replace
- diff editors
- merge editors
- breadcrumbs and outline integration
- editor restore and persisted layout

### User Experience

VS Code's editor behavior is familiar, fast, and trusted by developers. Users expect basic editing to be invisible: typing, navigation, search, and file switching should simply work.

### Typio Stance

Keep this mostly unchanged. The editor core is not where Typio should initially compete.

### Opportunity

- calmer default layout around the editor
- better first-run guidance
- tighter connection between editor state and agent context
- clearer display of agent-made changes

### Risk

Deep editor changes can break muscle memory, extension assumptions, performance, and accessibility.

---

## 2. Language Intelligence

### What VS Code Provides

- Language Server Protocol support
- IntelliSense
- diagnostics
- hover documentation
- go to definition/references
- rename symbol
- formatting
- semantic highlighting
- inlay hints
- code lenses
- language-specific extensions

### User Experience

Users experience this as "the editor understands my code." It is one of VS Code's strongest inherited advantages.

### Typio Stance

Preserve the existing language stack. Typio should use language intelligence as context for workflows, not replace it.

### Opportunity

- agent actions that understand diagnostics
- "fix this error" flows grounded in Problems
- project-aware explanations
- better surfacing of language server health

### Risk

Replacing language systems would be expensive and would reduce extension compatibility.

---

## 3. Files and Workspace

### What VS Code Provides

- file explorer
- single-folder and multi-root workspaces
- workspace trust
- recent folders/workspaces
- file watchers
- dirty file state
- untitled files
- save/auto-save flows
- open folder/file dialogs

### User Experience

VS Code's workspace model is powerful but can feel abstract. Users think in projects; VS Code thinks in folders, workspaces, schemes, profiles, and trust states.

### Typio Stance

Keep the workspace model but make project identity clearer.

### Opportunity

- project summary on open
- detected stack/package manager
- detected dev/test/build commands
- explicit "No workspace" / "Unknown workspace" states
- cleaner recents and session-to-project mapping

### Risk

Fake or sentinel workspace URIs must not leak into user-facing flows. Workspace state touches dialogs, history, sessions, terminals, search, and extensions.

---

## 4. Search and Navigation

### What VS Code Provides

- global search
- file search / quick open
- symbol search
- command palette
- references and definitions
- breadcrumbs and outline

### User Experience

VS Code offers many overlapping navigation surfaces. Power users know them; new users can feel lost.

### Typio Stance

Keep the primitives, but consider a more coherent command/navigation center.

### Opportunity

- one Typio command center for files, commands, sessions, branches, tasks, and agent actions
- search results that include agent session history
- project-aware "jump to important file" suggestions

### Risk

Command palette and quick access are central extension integration points. Avoid breaking existing commands.

---

## 5. Terminal and Tasks

### What VS Code Provides

- integrated terminal
- shell integration
- tasks
- problem matchers
- terminal persistence
- terminal tabs and splits
- environment inheritance

### User Experience

The terminal is where many real developer workflows happen. Agents also need terminal access, but users need confidence and visibility.

### Typio Stance

Do not build a parallel terminal. Use VS Code's terminal/task systems.

### Opportunity

- detected commands surfaced as first-class actions
- agent-run command timeline
- safer command approval UX
- clear distinction between user terminal and agent terminal
- "rerun failed test" workflows

### Risk

Hidden agent command execution is a trust killer. Terminal state must remain inspectable.

---

## 6. Git and SCM

### What VS Code Provides

- source control view
- file diffs
- staging/unstaging
- commits
- branches
- merge conflict support
- extension-based SCM providers

### User Experience

VS Code's Git flow is capable but utilitarian. Agent changes make Git visibility even more important.

### Typio Stance

Keep VS Code SCM primitives. Improve how agent work maps to diffs, branches, commits, and review.

### Opportunity

- agent change summary
- review queue for agent edits
- branch-aware session history
- "create PR" guided flow
- separate human vs agent change provenance where possible

### Risk

SCM is safety-critical. Users must always be able to inspect and revert changes.

---

## 7. Debugging

### What VS Code Provides

- debug adapters
- launch configurations
- breakpoints
- variables/watch/call stack
- debug console
- language-specific debugger extensions

### User Experience

Debugging is powerful but setup-heavy. Users often struggle with launch configs.

### Typio Stance

Preserve the debug system. Use Typio to help explain and configure it.

### Opportunity

- detect missing launch config
- explain current debug state
- agent-assisted debugging plans
- "debug failing test" workflow

### Risk

Debugger integration is deep and extension-dependent. Avoid early rewrites.

---

## 8. Extensions

### What VS Code Provides

- extension host
- extension API
- marketplace/gallery plumbing depending on distribution
- built-in language/theme/debug extensions
- extension settings, activation events, commands, views

### User Experience

Extensions are why VS Code fits many workflows. They also add clutter, prompts, and inconsistent UI.

### Typio Stance

Extension compatibility is strategic. Typio should not casually break extension assumptions.

### Opportunity

- curated first-run extension recommendations
- clearer extension trust and permissions
- reduce extension-driven onboarding noise
- product-specific built-in extension for Typio features

### Risk

Forks can lose marketplace compatibility or break extension expectations. This is a major product risk.

---

## 9. Settings, Keybindings, Profiles

### What VS Code Provides

- settings UI and JSON
- user/workspace settings
- keybindings UI and JSON
- profiles
- sync infrastructure depending on product config

### User Experience

VS Code is highly configurable but configuration can feel overwhelming.

### Typio Stance

Keep compatibility with settings and keybindings. Improve defaults and reduce first-run complexity.

### Opportunity

- Typio default profile
- calmer default layout
- agent-specific settings grouped clearly
- explicit provider/auth settings

### Risk

Changing defaults can surprise existing VS Code users. Product defaults should be intentional and documented.

---

## 10. Themes and Visual Shell

### What VS Code Provides

- themes
- icon themes
- product icons
- customizable layout
- activity bar, side bar, panel, status bar, title bar

### User Experience

VS Code is functional and dense. It can feel busy, especially with AI/chat/session surfaces added.

### Typio Stance

This is a major product opportunity, but early changes should be conservative and reversible.

### Opportunity

- calmer default theme and spacing
- reduced visual noise
- better empty states
- more coherent AI/session surfaces
- tasteful welcome/onboarding pages

### Risk

Visual changes can break accessibility, muscle memory, screenshots, and extension-contributed views.

---

## 11. Onboarding and Welcome

### What VS Code Provides

- welcome pages
- walkthroughs
- startup editor configuration
- recent projects
- extension recommendations
- profile/setup prompts

### User Experience

VS Code onboarding is broad because VS Code serves many audiences. AI-related prompts can feel surprising or unexplained.

### Typio Stance

Onboarding is one of Typio's first product surfaces.

### Opportunity

- explain what Typio is
- explain inherited VS Code compatibility
- explain AI provider/auth state
- guide users to open a project, resume a session, or start a workflow
- make startup behavior predictable

### Risk

Forcing welcome surfaces too aggressively can annoy users. Startup behavior should be explicit and user-controlled.

---

## 12. Chat, AgentHost, and Sessions

### What VS Code Provides

- chat UI
- AgentHost process
- provider/session infrastructure
- Copilot/Claude/Codex-related integrations in this fork
- session listing and resume flows
- metadata for working directories, changesets, terminals, and session history

Relevant areas:

```txt
src/vs/workbench/contrib/chat/
src/vs/platform/agentHost/
src/vs/sessions/
extensions/copilot/
```

### User Experience

The raw capability is powerful, but the mental model is still emerging. Users may not understand providers, sessions, auth, working directories, or why previous conversations appear.

### Typio Stance

Agent/Sessions is a first-class product pillar. Preserve the infrastructure and improve the experience around it.

### Opportunity

- session timeline per project
- clearer session titles/status/provenance
- "continue previous work" flow
- explicit provider connection state
- agent permissions that feel understandable
- link sessions to Git branches, terminals, and diffs

### Risk

Agent systems cross many trust boundaries: filesystem, shell, network, auth, models, and source control. UX must make state and actions visible.

---

## 13. Notifications, Prompts, and Trust

### What VS Code Provides

- notification center
- modal dialogs
- auth prompts
- workspace trust
- extension warnings
- permission flows

### User Experience

Prompts are necessary but can become noise. AI/auth prompts are especially sensitive because users may not know what account or provider is involved.

### Typio Stance

Reduce surprise. Make prompts contextual, explainable, and optional where possible.

### Opportunity

- provider connection panel
- plain-language auth explanations
- fewer startup prompts
- consolidated trust/permission review

### Risk

Suppressing important prompts can reduce safety. The goal is clarity, not hiding risk.

---

## 14. Remote Development

### What VS Code Provides

- remote authorities and URI schemes
- remote extension host patterns
- tunnels/SSH/containers depending on extensions/product setup
- local vs remote file dialog behavior

### User Experience

Remote development is powerful but scheme-heavy and error-prone. Users think in machines/projects, not URI authorities.

### Typio Stance

Preserve the underlying architecture. Improve labels and fallback states where possible.

### Opportunity

- clearer local/remote indicators
- safer fallback when a provider/scheme is unavailable
- agent sessions aware of local vs remote workspace

### Risk

Remote paths and URI schemes are deeply connected to file dialogs, extensions, terminals, and workspace history.

---

## 15. Accessibility and Keyboard-First Use

### What VS Code Provides

- keyboard-driven command palette
- accessible editor primitives
- screen reader support
- configurable keybindings
- high contrast themes

### User Experience

Many developers depend on keyboard-first workflows. Accessibility regressions are product regressions.

### Typio Stance

Preserve and improve accessibility. Do not sacrifice keyboard flow for visual redesign.

### Opportunity

- command center designed keyboard-first
- accessible session timeline
- clear focus management in onboarding and agent flows
- reduced visual clutter without hiding semantics

### Risk

Custom UI can easily regress focus, labels, contrast, and screen reader behavior.

---

## 16. Testing

### What VS Code Provides

- Test Explorer
- test discovery through extensions
- run/debug test actions
- inline test status
- test output and failure messages
- coverage-related extension integrations

### User Experience

Testing is one of the most important developer feedback loops. In VS Code it is powerful, but behavior depends heavily on language/framework extensions.

### Typio Stance

Preserve the testing API and Test Explorer. Build agent workflows around real test failures rather than inventing a separate test system.

### Opportunity

- "fix failing test" workflow
- agent-readable test failure summaries
- detected test commands on project open
- connect test failures to sessions, diffs, and terminal output

### Risk

Test discovery is extension-dependent. Typio should not assume one framework or package manager.

---

## 17. Problems, Output, Logs, and Diagnostics Surfaces

### What VS Code Provides

- Problems panel
- Output channels
- logs
- notifications
- status bar indicators
- extension host logs
- developer tools

### User Experience

These surfaces are where users discover failures, but they are fragmented. New users may not know whether to check Problems, Terminal, Output, or Notifications.

### Typio Stance

Keep the surfaces. Improve how Typio points users and agents to the right one.

### Opportunity

- unified "what is broken?" view
- agent actions grounded in Problems and Output
- clearer extension/language-server failure explanations
- project health summary

### Risk

Over-aggregating errors can hide important source-specific detail.

---

## 18. Notebooks, Interactive, and Rich Editors

### What VS Code Provides

- notebook editor infrastructure
- Jupyter-style workflows through extensions
- interactive windows
- custom editors
- preview editors such as Markdown preview

### User Experience

VS Code supports more than code files. Data science, docs, diagrams, and generated previews often live in rich editor surfaces.

### Typio Stance

Preserve rich editor infrastructure. Do not assume every workflow is plain text.

### Opportunity

- agent explanations that understand notebooks and previews
- document/code mixed workflows
- better generated-preview review flows

### Risk

Notebook and custom editor APIs are complex and extension-heavy. Avoid early redesign here.

---

## 19. Webviews, Custom Views, and Extension-Contributed UI

### What VS Code Provides

- webviews
- custom editors
- tree views
- welcome views
- contributed menus/actions
- extension-contributed sidebars and panels

### User Experience

Much of VS Code's product surface is not first-party UI. Extensions can add large pieces of interface.

### Typio Stance

Preserve extension-contributed UI compatibility. Typio's shell redesign must account for unknown contributed views.

### Opportunity

- clearer visual hierarchy around extension views
- curated default view placement
- Typio-specific built-in views for sessions/project intelligence

### Risk

Aggressive layout redesign can break extension UI assumptions.

---

## 20. Accounts, Settings Sync, and Identity

### What VS Code Provides

- authentication providers
- accounts menu
- settings sync depending on product configuration
- extension authentication sessions
- GitHub/Microsoft account integrations depending on build/product setup

### User Experience

Identity is confusing when multiple providers are involved. Users may not know whether they are signing into GitHub, Copilot, Microsoft, Codex, Claude, or an extension.

### Typio Stance

Make identity explicit and provider-specific. Do not surprise users with unexplained sign-in prompts.

### Opportunity

- provider connection center
- plain-language auth state
- optional sign-in paths
- clear distinction between editor sync, model provider auth, Git auth, and extension auth

### Risk

Auth changes can break extensions and user trust. Do not hide or spoof provider identity.

---

## 21. Comments, Review, and Collaboration

### What VS Code Provides

- comments API
- review surfaces through extensions
- GitHub Pull Requests style workflows through extensions
- issue/PR references through extensions
- Live Share-style collaboration depending on installed extensions

### User Experience

Collaboration mostly comes from extensions, but users expect modern editors to understand review, comments, PRs, and issues.

### Typio Stance

Do not rebuild collaboration initially. Build agent review flows on top of Git diffs and extension-compatible APIs.

### Opportunity

- agent-generated review notes
- PR preparation workflow
- session-to-branch-to-PR continuity
- summarize requested changes

### Risk

Review data may be remote, account-bound, and provider-specific.

---

## 22. Ports, Servers, Browser Preview, and Dev Services

### What VS Code Provides

- port detection/forwarding in remote scenarios
- simple browser/webview previews through extensions or built-ins
- task/terminal-driven dev servers
- URL opening and opener services

### User Experience

Modern development often means running a server and opening a browser. VS Code supports pieces of this, but the full loop can be scattered across Terminal, Ports, Tasks, and Browser.

### Typio Stance

Preserve existing services. Improve project-level discovery of running apps and commands.

### Opportunity

- detected local app URLs
- "start dev server" action
- agent-visible server status
- preview links attached to sessions

### Risk

Automatic server detection can be noisy and framework-specific.

---

## 23. Productization, Updates, Telemetry, and Distribution

### What VS Code Provides

- product configuration
- update service patterns
- telemetry plumbing
- built-in extension packaging
- gallery/product service configuration
- platform-specific packaging assumptions

### User Experience

Users experience this as app identity: name, icon, updates, trust, marketplace behavior, telemetry prompts, and install quality.

### Typio Stance

This becomes important when Typio moves from local fork to distributable product. Keep it documented before changing it.

### Opportunity

- clear Typio app identity
- explicit telemetry posture
- safe update channel
- curated built-ins

### Risk

Distribution mistakes can break updates, extensions, legal notices, or user trust.

---

## 24. Performance, Startup, and Process Architecture

### What VS Code Provides

- main process, renderer, extension host, shared process, agent host
- startup profiling tools
- lazy activation model
- performance marks
- process explorer

### User Experience

Performance is product feel. Slow startup, extension activation spikes, or noisy agent processes make the editor feel untrustworthy.

### Typio Stance

Measure before changing. Agent-native features must not make startup feel heavy.

### Opportunity

- defer AI/session work until needed
- make background work visible when relevant
- detect costly extensions or agent startup paths
- keep onboarding fast

### Risk

Adding product features to startup can regress perceived performance.

---

## 25. Windowing, Layout, and Multi-Window Behavior

### What VS Code Provides

- multiple windows
- workspace/window restore
- hot exit backups
- editor and panel layout persistence
- native title/menu integration
- command-line flags for opening files, folders, diffs, and new windows
- URI/protocol opening flows

### User Experience

Users often treat each window as a separate project context. Restored windows, dirty files, and startup behavior heavily shape trust.

### Typio Stance

Preserve VS Code's window model. Typio should make project/session identity clearer per window rather than inventing a new app container model early.

### Opportunity

- clearer per-window project identity
- session memory scoped to the active project/window
- predictable startup and restore behavior
- better first-run vs returning-user distinction

### Risk

Window restore and hot exit are safety-critical. Breaking them can cause lost work or confusing session recovery.

---

## 26. Menus, Context Actions, and Command Contributions

### What VS Code Provides

- command registry
- command palette
- menu registry
- context menus
- keybinding contributions
- extension-contributed commands/actions
- when-clause/context-key system

### User Experience

A large part of VS Code's UX is command availability: what appears when right-clicking a file, editor selection, terminal, problem, test, or SCM item.

### Typio Stance

Preserve the command/menu contribution model. Typio's own actions should feel native and keyboard-accessible.

### Opportunity

- consistent Typio action naming
- context-aware agent actions
- reduce duplicate or confusing AI commands
- command center that still respects existing command contributions

### Risk

Changing context keys, menus, or command IDs can break extensions and user keybindings.

---

## 27. Snippets, Emmet, Code Actions, and Refactoring UX

### What VS Code Provides

- snippets
- Emmet support
- quick fixes/code actions
- source actions
- refactor actions
- organize imports
- lightbulb UI

### User Experience

These are small but high-frequency productivity features. They make the editor feel fast without invoking a full agent workflow.

### Typio Stance

Keep these lightweight mechanisms. Agent workflows should complement them, not replace every quick fix with chat.

### Opportunity

- route simple fixes to native code actions
- use agent only when native quick fixes are insufficient
- explain whether a change came from a language server, extension, or agent

### Risk

Over-agentifying quick edits can make the product feel slower and less predictable.

---

## 28. Timeline, Local History, and Backups

### What VS Code Provides

- timeline view
- local history
- file backups / hot exit
- SCM history contributions
- extension-contributed timeline items

### User Experience

History and recovery features are trust infrastructure. Users need to know they can recover from mistakes, especially with agent edits.

### Typio Stance

Preserve history systems and connect agent work to recoverability.

### Opportunity

- agent session timeline integrated with file history
- easy rollback of agent changes
- clearer "what changed when" story
- branch/session/history continuity

### Risk

History surfaces can become noisy. Rollback semantics must be exact and safe.

---

## 29. Security, Secrets, and Credential Storage

### What VS Code Provides

- secret storage API
- authentication sessions
- keychain/keytar-backed storage depending on platform/build
- workspace trust
- extension trust boundaries
- restricted mode behavior

### User Experience

Users rarely think about where tokens live until something goes wrong. AI providers, GitHub auth, extension auth, and sync auth increase the importance of explicit trust.

### Typio Stance

Do not invent ad-hoc credential storage. Use VS Code's existing secret/auth infrastructure and explain it clearly.

### Opportunity

- provider credential overview
- clear sign-out/revoke flows
- trust-aware agent capabilities
- explain when a token enables filesystem, network, model, or Git access

### Risk

Credential handling mistakes are severe. Never log tokens or blur provider boundaries.

---

## 30. User Data, Storage, State, and Migration

### What VS Code Provides

- global/workspace storage
- memento/state services
- user data profiles
- settings/keybindings/snippets storage
- extension global/workspace state
- backup and migration patterns

### User Experience

State is invisible until it corrupts, disappears, or leaks across projects. A fork must be especially careful not to damage a user's existing VS Code data.

### Typio Stance

Use isolated product identity and profiles where possible. Avoid writing Typio-specific state into places that surprise VS Code users.

### Opportunity

- clean Typio profile
- project memory stored with clear scope
- migration/import from VS Code as an explicit action
- reset/debug state tools

### Risk

Bad state migration can corrupt user settings, extensions, sessions, or credentials.

---

## 31. Localization and Internationalization

### What VS Code Provides

- localization infrastructure
- NLS strings
- language packs
- RTL/accessibility considerations in UI patterns

### User Experience

Even if Typio starts English-first, inherited VS Code UI is localization-aware. Product copy should not regress that architecture unnecessarily.

### Typio Stance

Follow VS Code localization patterns for user-facing strings.

### Opportunity

- keep Typio copy clean and localizable
- avoid hard-coded strings in product UI
- preserve language pack compatibility where practical

### Risk

Hard-coded product strings create future localization debt and inconsistent UI.

---

## 32. Developer Tools, Diagnostics, and Extension Bisect

### What VS Code Provides

- Developer: Toggle Developer Tools
- process explorer
- startup performance tools
- extension bisect
- logs and trace output
- issue reporter depending on product setup

### User Experience

These tools are mostly for advanced users and maintainers, but they are essential for debugging a fork.

### Typio Stance

Preserve diagnostics and self-debugging tools. A fork needs more observability, not less.

### Opportunity

- Typio-specific diagnostics page
- collect relevant logs for agent/session issues
- clearer "report a problem" flow
- maintainable internal debug commands

### Risk

Removing or hiding diagnostics slows down support and development.

---

## 33. Built-in Language and Tooling Extensions

### What VS Code Provides

- built-in extensions for common languages/features
- TypeScript/JavaScript support
- Markdown support
- JSON/CSS/HTML support
- Git, search, merge, debug, notebook, and theme contributions
- extension recommendations and built-in extension lifecycle

### User Experience

Many features users think are "VS Code" are actually built-in extensions. This matters for packaging, startup, activation, and product identity.

### Typio Stance

Treat built-ins as part of the product surface. Do not remove or alter them casually.

### Opportunity

- curate Typio built-ins
- add a Typio built-in extension for project intelligence and onboarding
- reduce noisy built-in prompts where safe

### Risk

Removing built-ins can silently break language support, previews, Git behavior, or settings UI.

---

## 34. Virtual Workspaces, File Systems, and URI Schemes

### What VS Code Provides

- URI-based resource model
- file, remote, untitled, webview, walkThrough, and extension-provided schemes
- file system provider API
- virtual workspaces
- readonly resources
- resource labels and icon theming
- scheme-aware dialogs and opener services

### User Experience

Users usually see files and folders, but VS Code internally sees resources. When this works, users never notice. When it fails, they see confusing scheme errors or broken labels.

### Typio Stance

Respect VS Code's URI/resource model. Do not treat every resource as a local file path.

### Opportunity

- friendlier labels for virtual/unknown resources
- safer fallback behavior when providers are unavailable
- clearer session/workspace state for local, remote, virtual, and missing resources
- agent workflows that understand readonly or virtual files

### Risk

Incorrect URI assumptions break file dialogs, workspace history, remote development, extensions, notebooks, webviews, and session restore.

---

## 35. Project Metadata, Recommendations, and Workspace Configuration

### What VS Code Provides

- `.vscode/settings.json`
- `.vscode/tasks.json`
- `.vscode/launch.json`
- `.vscode/extensions.json`
- workspace files
- extension recommendations
- language/framework-specific conventions through extensions

### User Experience

A project can teach VS Code how to behave, but users often do not know which configuration file controls which behavior.

### Typio Stance

Preserve VS Code workspace configuration. Typio should read and explain it before adding new project memory.

### Opportunity

- project setup explanation
- detect missing recommended extensions
- explain tasks/launch configs in plain language
- propose safe project config improvements

### Risk

Automatically editing workspace configuration can surprise teams and create noisy diffs.

---

## 36. Development Containers and Environment Reproducibility

### What VS Code Provides

- dev container workflows through extensions
- remote container authorities
- workspace environment configuration
- terminal/task/debug integration inside remote environments

### User Experience

Dev containers solve setup drift but add another layer of environment state. Users need to know whether commands run locally, remotely, or inside a container.

### Typio Stance

Preserve the remote/container model. Make agent execution environment explicit.

### Opportunity

- show where the agent is running commands
- detect devcontainer setup
- explain environment prerequisites
- connect sessions to container/remote context

### Risk

Running agent commands in the wrong environment can damage files, fail mysteriously, or create trust issues.

---

## 37. Web, Browser, and Restricted Host Modes

### What VS Code Provides

- browser-hosted VS Code architecture
- web extensions
- restricted APIs depending on host
- virtual/remote file systems in web contexts
- service-worker/browser storage constraints

### User Experience

Users may expect the same editor everywhere, but desktop, remote, and web hosts have different capabilities.

### Typio Stance

Desktop Typio can be the first target, but architecture decisions should not unnecessarily close off future web or remote modes.

### Opportunity

- document desktop-only assumptions
- make unavailable capabilities clear
- design agent/session abstractions that can degrade gracefully

### Risk

Hard-coding Node/local filesystem assumptions makes future web/remote support harder.

---

## 38. CLI, Deep Links, and Automation Entry Points

### What VS Code Provides

- command-line launcher
- open file/folder/workspace commands
- `--goto`, `--diff`, `--merge`, `--wait`, `--reuse-window`, `--new-window`
- URI protocol handlers
- extension and tunnel-related command entry points depending on product setup

### User Experience

Many developers enter VS Code from the terminal, Git tools, browser links, or OS file associations rather than the welcome page.

### Typio Stance

Preserve CLI compatibility. Typio onboarding should not assume every session starts from the app icon.

### Opportunity

- Typio-specific deep links for sessions/workflows later
- better handling of first launch from a folder or file
- command-line project/session continuity

### Risk

Breaking CLI behavior disrupts scripts, Git tools, and developer muscle memory.

---

## 39. Enterprise, Policy, Compliance, and Governance

### What VS Code Provides

- policy-controlled settings in some distributions
- extension governance patterns
- telemetry/product configuration
- workspace trust
- authentication/provider boundaries
- license and third-party notice infrastructure

### User Experience

Individual developers may ignore governance, but teams and companies care about data flow, extensions, telemetry, model providers, and command execution.

### Typio Stance

Even if Typio starts as an individual product, agent-native behavior should be designed with governance in mind.

### Opportunity

- explicit model/provider data boundaries
- organization-friendly defaults
- clear telemetry and command execution posture
- future admin controls for agent features

### Risk

AI products without clear governance are hard to adopt in professional environments.

---

## 40. Media, Binary Files, and Non-Code Assets

### What VS Code Provides

- image preview
- binary file detection
- hex/binary handling through extensions
- media preview extension points
- drag/drop and file association behavior

### User Experience

Projects contain more than source code: images, fonts, videos, lockfiles, generated artifacts, diagrams, and design assets.

### Typio Stance

Do not assume every resource is editable text. Agent workflows need to identify binary/generated assets safely.

### Opportunity

- better generated-file warnings
- asset-aware project summaries
- agent caution around lockfiles, images, and generated files

### Risk

Agents editing or summarizing non-text assets incorrectly can corrupt files or produce misleading plans.

---

## 41. Release Notes, What's New, and Product Education

### What VS Code Provides

- release notes surfaces
- walkthroughs
- getting started content
- changelog/product education patterns

### User Experience

Users learn an evolving editor through release notes, walkthroughs, and timely prompts. Too much education becomes noise; too little hides value.

### Typio Stance

Typio needs its own product education layer once features diverge from VS Code.

### Opportunity

- tasteful "what changed" after updates
- agent workflow examples
- explain new defaults and privacy/auth behavior

### Risk

Product education can become interruption-heavy if not carefully timed.

---

## 42. AI Extension APIs, Tools, and Model Surfaces

### What VS Code Provides

- chat participant/contribution infrastructure
- language model/provider-facing APIs depending on build and extension availability
- tool invocation patterns
- proposed APIs and built-in AI extension integrations
- model/provider configuration surfaces
- permission and trust prompts around AI actions

### User Experience

Users do not care which layer provides an AI capability. They experience one product: chat, edits, tools, models, prompts, sessions, and permissions. If these surfaces are fragmented, the product feels incoherent.

### Typio Stance

Treat AI APIs and built-in AI extensions as product infrastructure. Typio should not blindly replace them; it should understand which capabilities are platform primitives versus provider-specific behavior.

### Opportunity

- coherent model/provider picker
- clear tool permission UX
- agent actions that feel native rather than bolted on
- provider-neutral language where possible
- explicit distinction between chat, agent sessions, inline edits, and background tools

### Risk

AI APIs may be proposed, unstable, provider-bound, or extension-dependent. Building too deeply on unstable seams can create rebase and compatibility pain.

---

## 43. Inline Chat, Edits, and Code Transformation Surfaces

### What VS Code Provides

- inline chat/edit surfaces depending on enabled extensions
- code action integration
- editor decorations for generated changes
- diff previews and apply/discard flows
- chat-driven workspace edits

### User Experience

Inline edits are high-trust moments: users need to see what changed, why, and how to accept or reject it.

### Typio Stance

Preserve VS Code's edit application and diff primitives. Typio should make AI edits feel reviewable, reversible, and connected to sessions.

### Opportunity

- consistent apply/reject language
- agent edit provenance
- better staged review for multi-file changes
- connect inline edits to tests and Git diff

### Risk

Opaque edits damage trust. Inconsistent apply behavior across chat, inline chat, and agent sessions creates confusion.

---

## 44. Progress, Cancellation, and Long-Running Work

### What VS Code Provides

- progress notifications
- status bar progress
- cancellable operations
- background work patterns
- task/terminal progress
- extension host long-running operation conventions

### User Experience

Users need to know when the editor is working, stuck, waiting for input, or safe to close. This becomes more important with agents.

### Typio Stance

Long-running agent work should use native progress/cancellation patterns wherever possible.

### Opportunity

- clear agent running/paused/waiting states
- cancel/stop controls that are always visible
- background session status in the shell
- avoid hidden work during startup

### Risk

Uncancellable agent work or invisible background operations make the product feel unsafe.

---

## 45. File Associations, Drag-and-Drop, Clipboard, and OS Integration

### What VS Code Provides

- file associations
- drag-and-drop into editor/explorer/terminal
- clipboard integration
- OS file open handling
- recent documents/folders integration
- file icons and language mode detection

### User Experience

These small OS-level behaviors make the app feel native. Users expect files, links, snippets, and folders to open in the right place.

### Typio Stance

Preserve OS and file-association behavior. Typio should not make basic desktop interactions feel custom or brittle.

### Opportunity

- better first-run handling when opened from a file/folder
- project/session context when launched via OS or terminal
- safer paste/drop behavior into agent prompts and terminals

### Risk

Changing file open/drop behavior can break muscle memory and platform expectations.

---

## 46. Workspace Indexing, Ignore Rules, and Generated Files

### What VS Code Provides

- search indexing through ripgrep and file services
- `files.exclude` and `search.exclude`
- `.gitignore`-aware behavior in places
- generated/vendor folder conventions through extensions/settings
- large workspace protections

### User Experience

Users expect search and agents to ignore junk: `node_modules`, build output, vendor files, generated code, lockfiles when appropriate, and secrets.

### Typio Stance

Typio's project intelligence and agents must respect VS Code's exclusion settings and project ignore conventions.

### Opportunity

- agent context selection that respects ignore/exclude rules
- generated-file warnings
- better large-repo summaries
- visible explanation of what was indexed or skipped

### Risk

Indexing too much hurts performance and privacy. Indexing too little makes agents ineffective.

---

## 47. Status Bar, Activity Badges, and Ambient State

### What VS Code Provides

- status bar items
- activity bar badges
- progress indicators
- language mode, encoding, line ending, branch, problems, sync, and extension status contributions

### User Experience

The status bar is dense but important. It communicates ambient state without interrupting the user.

### Typio Stance

Do not overload ambient surfaces. Typio should use status/badges sparingly and consistently.

### Opportunity

- minimal agent/session status indicator
- provider connection state without noisy prompts
- branch/session/test health at a glance

### Risk

Adding too many badges or status items increases clutter and reduces trust in the shell.

---

## 48. Extension Development and API Compatibility

### What VS Code Provides

- extension development host
- extension debugging
- extension packaging conventions
- proposed API mechanisms
- contribution points
- activation events
- extension tests and sample patterns

### User Experience

Some users are also extension authors. More importantly, the extension API is the contract that keeps the ecosystem working.

### Typio Stance

Preserve extension API compatibility as a product constraint. Typio-specific capabilities should avoid breaking existing extension development workflows.

### Opportunity

- Typio built-in extension developed using normal extension patterns
- clear documentation for Typio-specific APIs if we ever add them
- upstreamable improvements to extension development where possible

### Risk

Changing contribution points, command behavior, proposed API access, or extension host assumptions can fragment the ecosystem.

---

## 49. Workspace Trust and Restricted Mode

### What VS Code Provides

- workspace trust model
- restricted mode
- trust-aware extension behavior
- prompts when opening untrusted folders
- settings and APIs that vary by trust state

### User Experience

Trust prompts protect users but can feel abstract. With agents, trust becomes more concrete: can this project run commands, install dependencies, access secrets, or call external providers?

### Typio Stance

Treat workspace trust as a first-class agent safety boundary.

### Opportunity

- explain what agents can and cannot do in untrusted workspaces
- trust-aware command/tool approval
- clearer first-run safety language
- project trust state visible in agent/session flows

### Risk

Bypassing or weakening restricted mode would be a serious security regression.

---

## 50. Feature Flags, Experiments, and Proposed Capabilities

### What VS Code Provides

- configuration-gated features
- proposed APIs
- experimental settings
- build/product configuration switches
- extension-dependent capability availability

### User Experience

Users may not understand why a feature appears, disappears, or behaves differently across builds, profiles, remotes, or extension sets.

### Typio Stance

Use flags for staged rollout, but keep product behavior explainable.

### Opportunity

- stage Typio experiments safely
- expose experimental features in one clear place
- keep unstable AI/session work behind explicit flags

### Risk

Too many hidden flags create inconsistent behavior and hard-to-debug product states.

---

## 51. Large Files, Large Repositories, and Resource Limits

### What VS Code Provides

- large file handling safeguards
- search/file watcher exclusions
- extension host isolation
- performance protections for huge workspaces
- configurable watcher and search behavior

### User Experience

Large repositories stress every part of the editor: search, watchers, TypeScript, Git, terminals, extensions, and agents.

### Typio Stance

Typio's project intelligence and agent context systems must be large-repo aware from the start.

### Opportunity

- progressive project indexing
- visible context budget and skipped paths
- better warnings for huge generated/vendor directories
- agent summaries that scale by sampling and structure

### Risk

Naive indexing or session memory can make large repos unusable or leak irrelevant/private data into model context.

---

## 52. Error Recovery, Safe Mode, and Troubleshooting Paths

### What VS Code Provides

- reload window
- disable extensions
- extension bisect
- safe/recovery flows depending on scenario
- developer logs
- process explorer
- issue reporting patterns

### User Experience

When the editor breaks, users need a way back. This matters more in a fork where product experiments may create new failure modes.

### Typio Stance

Keep escape hatches obvious. Product polish must not hide recovery tools.

### Opportunity

- Typio troubleshooting command
- reset agent/session state safely
- collect relevant diagnostics for agent failures
- explain whether a problem likely comes from Typio, VS Code base, an extension, or a provider

### Risk

Without recovery paths, users may abandon the product after one bad extension/session/state failure.

---

## 53. Documentation, Help, and Learnability

### What VS Code Provides

- command documentation
- settings descriptions
- walkthroughs
- release notes
- extension README surfaces
- keybinding discoverability
- links to docs from UI

### User Experience

VS Code is discoverable over time, but users often learn by searching, command palette exploration, and extension docs.

### Typio Stance

Typio needs product copy and help that explain the agent-native model without overwhelming users.

### Opportunity

- concise in-product explanations
- agent workflow examples
- help pages for sessions, providers, permissions, and project memory
- consistent naming across UI and docs

### Risk

If terminology is inconsistent, users will not understand the difference between chat, agent, session, provider, model, tool, task, and project memory.

---

## 54. Save Lifecycle, Formatting, and File Conflict Handling

### What VS Code Provides

- save, save all, auto save
- format on save
- code actions on save
- save participants
- readonly file handling
- dirty editor tracking
- file conflict detection when files change on disk
- hot exit and backup restore

### User Experience

Saving is a trust boundary. Users expect the editor to preserve their work, avoid silent overwrites, and make automated edits predictable.

### Typio Stance

Preserve VS Code's save lifecycle. Typio and agents must not bypass normal dirty-state, save, and conflict behavior.

### Opportunity

- make agent-created dirty files obvious
- explain when formatting/code actions changed agent edits
- safer apply/save flows for multi-file agent changes
- conflict-aware agent sessions

### Risk

Silent saves, hidden format changes, or overwritten disk changes would destroy trust quickly.

---

## 55. Dependency, Package, and Runtime Ecosystem Awareness

### What VS Code Provides

- language/framework extensions that understand package managers
- task auto-detection
- npm script detection in JavaScript/TypeScript projects
- dependency-related views through extensions
- vulnerability/package intelligence through extensions depending on setup

### User Experience

Developers think in runtimes and package managers: npm, pnpm, yarn, pip, cargo, go, maven, gradle, etc. VS Code supports these mostly through extensions and tasks rather than one unified product model.

### Typio Stance

Typio should detect project ecosystems carefully without hard-coding one stack as universal.

### Opportunity

- project setup summary
- package manager detection
- install/test/build command recommendations
- warn before agents change lockfiles or dependency manifests
- explain runtime mismatch problems

### Risk

Wrong package-manager assumptions can break projects or create noisy diffs.

---

## 56. Supply Chain, Extension Updates, and Dependency Trust

### What VS Code Provides

- extension installation/update flows
- extension signing/trust signals depending on product setup
- workspace trust
- marketplace/gallery metadata
- dependency and vulnerability signals through extensions or ecosystem tooling

### User Experience

Users install extensions and run project dependencies with significant trust. Agentic workflows amplify supply-chain risk because agents may suggest installs, run scripts, or modify dependency files.

### Typio Stance

Treat installs and dependency changes as high-trust actions. Agents should explain why a package or extension is needed before changing the environment.

### Opportunity

- explicit approval for dependency installs
- summarize dependency manifest and lockfile changes
- distinguish extension recommendation from automatic install
- safer defaults for agent-proposed setup commands

### Risk

Unclear install behavior can create security, legal, and team-policy problems.

---

## 57. Data Boundaries, Privacy, and Model Context

### What VS Code Provides

- settings and trust mechanisms that can constrain extensions/features
- telemetry/product configuration
- authentication/provider boundaries
- workspace file access primitives
- extension APIs that expose editor/workspace state under user-controlled installation/trust assumptions

### User Experience

For AI features, users need to know what code, terminal output, diffs, errors, and metadata may be sent to a model or provider.

### Typio Stance

Model context is product data flow. Typio should make context selection and provider boundaries understandable.

### Opportunity

- show what context is attached to a prompt/session
- respect ignore/exclude/secret patterns
- project-level privacy controls
- provider-specific data-flow explanations
- clear local vs remote vs cloud execution language

### Risk

Leaking secrets, private code, or irrelevant files into model context is one of the biggest risks for an agent-native editor.

---

## 58. Input Methods, Accessibility Edge Cases, and International Text

### What VS Code Provides

- IME/input method support through Monaco/Electron/browser layers
- Unicode text handling
- keyboard layout handling
- screen reader support
- high contrast and reduced-motion considerations

### User Experience

Text editing must work across languages, keyboard layouts, input methods, and assistive technologies. These details are invisible until broken.

### Typio Stance

Do not compromise core input behavior while redesigning UI or adding agent surfaces.

### Opportunity

- accessible prompt/session UI
- keyboard-layout-safe shortcuts
- avoid assuming English-only source text or comments
- reduced-motion-friendly agent progress states

### Risk

Custom prompt editors, command centers, or chat inputs can regress IME, focus, screen reader, or keyboard behavior.

---

## 59. Network, Proxy, Certificates, and Offline Behavior

### What VS Code Provides

- proxy configuration
- certificate and TLS behavior through Electron/Node/platform services
- network-aware extension/gallery access
- remote connection flows
- update/gallery/model-provider network dependencies depending on product configuration
- offline/error states surfaced through notifications, logs, and extension-specific UI

### User Experience

Users often discover network behavior only when something fails: extensions do not install, auth cannot complete, remote connections fail, or provider calls time out.

### Typio Stance

Typio should make network-dependent features explicit, especially AI/provider features.

### Opportunity

- clear offline/provider-unreachable states
- distinguish local editor failures from network/model failures
- organization proxy guidance
- retry and degraded-mode behavior for agent sessions

### Risk

Network assumptions can make Typio unusable in enterprise, offline, or restricted environments.

---

## 60. File Watching, External Changes, and Workspace Events

### What VS Code Provides

- file watcher infrastructure
- external file change detection
- refresh behavior for explorer/search/source control
- dirty file conflict handling
- extension APIs for workspace/file events

### User Experience

Users expect VS Code to notice when Git, scripts, generators, package managers, or external editors change files.

### Typio Stance

Preserve file watching semantics. Agent-generated changes should flow through normal file event paths.

### Opportunity

- detect external changes caused by agent commands
- update session/diff views as files change
- warn when generated tools overwrite agent or user edits

### Risk

Broken file watching causes stale editor state, missed diffs, incorrect agent context, and possible data loss.

---

## 61. Webview Security, Sandboxing, and Content Isolation

### What VS Code Provides

- webview isolation model
- content security policy patterns
- resource loading controls
- extension-owned webview lifecycle
- message passing between extension host and webview

### User Experience

Users see webviews as normal UI, but they are security-sensitive embedded applications. Chat, previews, walkthroughs, and custom extension views may use webview-like surfaces.

### Typio Stance

Follow VS Code's isolation and CSP patterns. Do not weaken webview boundaries for product convenience.

### Opportunity

- secure Typio onboarding/session views
- safe rendering of agent output and markdown
- clear handling for untrusted generated content

### Risk

Rendering model output, project files, or extension content unsafely can create injection or data exposure bugs.

---

## 62. Markdown, Documentation Preview, and Rendered Content

### What VS Code Provides

- Markdown editing and preview
- preview security controls
- link detection/opening
- rendered docs through extensions and webviews
- README-first project workflows

### User Experience

Developers often understand projects through README files, docs, changelogs, diagrams, and generated previews, not only source code.

### Typio Stance

Treat documentation as first-class project context. Preserve preview behavior and security boundaries.

### Opportunity

- project explanation grounded in README/docs
- agent-generated docs with preview/review
- safer link and image handling in rendered agent output

### Risk

Rendered content can be misleading or unsafe if links, scripts, or generated markdown are not handled carefully.

---

## 63. Licensing, Notices, and Open Source Compliance

### What VS Code Provides

- license files
- third-party notices
- cgmanifest/compliance metadata
- built-in extension licenses
- product/distro-specific legal surfaces

### User Experience

Most users do not inspect notices, but distribution requires legal correctness. A fork inherits obligations from VS Code and bundled dependencies/extensions.

### Typio Stance

Track compliance from the beginning, especially before distribution.

### Opportunity

- clear Typio license/notice inventory
- preserve upstream notices
- document added dependencies and built-ins

### Risk

Ignoring license/compliance work can block release or create legal exposure.

---

## 64. Platform Packaging, Signing, and Native App Integration

### What VS Code Provides

- platform-specific app packaging
- application icons and product identity
- macOS signing/notarization patterns
- Windows installer/update integration patterns
- Linux package formats and desktop entries
- protocol/file association registration
- crash reporter and native process integration depending on product configuration

### User Experience

Users judge an editor before opening a file: install flow, app icon, update behavior, OS trust warnings, dock/taskbar behavior, and file associations all affect credibility.

### Typio Stance

Do not treat packaging as an afterthought. A fork becomes a real product only when install, update, signing, and OS integration feel trustworthy.

### Opportunity

- clean Typio app identity
- separate Typio user-data/profile paths from VS Code
- predictable update channel
- no scary OS trust prompts
- correct file/protocol association behavior

### Risk

Bad signing, shared app IDs, broken updates, or confused user-data paths can damage user trust and make support painful.

---

## 65. Crash Reporting, Reliability, and Session Recovery

### What VS Code Provides

- process separation
- window reload/recovery
- hot exit backups
- crash reporting hooks depending on product setup
- extension host restart behavior
- logs for main/renderer/shared/extension/agent processes

### User Experience

A crash is bad; losing work is unforgivable. Agent sessions add another recovery dimension: what was the agent doing, what changed, and can the user safely continue?

### Typio Stance

Reliability is part of product taste. Typio should preserve VS Code's recovery paths and add clear recovery for agent/session state.

### Opportunity

- recover interrupted agent sessions
- explain whether changes were applied before a crash
- session-safe restart behavior
- one command to collect crash/session diagnostics

### Risk

If agent work is not recoverable or auditable after crashes, users will not trust long-running workflows.

---

## 66. Views, Trees, Lists, Tables, and Dense Data UI

### What VS Code Provides

- reusable workbench list/tree/table UI patterns
- explorer trees
- SCM lists
- Problems tables
- Test Explorer trees
- extension-contributed tree views
- keyboard navigation and context menus for dense UI

### User Experience

VS Code is full of dense information surfaces. They are not glamorous, but users rely on them for speed, selection, context menus, and keyboard navigation.

### Typio Stance

Typio should use existing workbench UI primitives for dense state instead of inventing custom inconsistent controls.

### Opportunity

- session timeline using native list/tree patterns
- project intelligence views that feel like VS Code
- consistent selection/context menu behavior
- accessible dense agent status views

### Risk

Custom dense UI can regress keyboard use, accessibility, theming, and extension consistency.

---

## 67. Selection, Context, and Multi-Resource Operations

### What VS Code Provides

- multi-selection in explorer/search/scm/problems/tests
- context-key-driven actions
- resource-aware command enablement
- drag/drop and copy/paste for resources
- bulk operations such as delete, rename, compare, stage, run tests

### User Experience

Users often act on sets of things: files, tests, search results, changes, problems. Agents also need clear scoped context.

### Typio Stance

Agent actions should respect the user's current selection and make scope explicit.

### Opportunity

- "ask about selected files/problems/tests/changes"
- visible context chips for selected resources
- safe bulk agent operations with preview
- selection-aware command center

### Risk

Ambiguous scope can cause agents to edit or inspect the wrong files.

---

## 68. Product Surface Summary

| Area | Keep | Polish | Build On Top | Avoid Early |
| --- | --- | --- | --- | --- |
| Editor Core | Yes | Lightly | Agent context indicators | Rewriting editor behavior |
| Language Intelligence | Yes | Health/status | Diagnostic-driven workflows | Replacing LSP stack |
| Workspace | Yes | Project identity | Project memory | Fake URI leakage |
| Search/Nav | Yes | Unify surfaces | Command center | Breaking commands |
| Terminal/Tasks | Yes | Agent visibility | Test/dev workflows | Parallel terminal |
| Git/SCM | Yes | Agent diff review | PR/change workflows | Hidden edits |
| Debugging | Yes | Setup help | Debug plans | Debugger rewrites |
| Extensions | Yes | Curation | Typio built-ins | API breakage |
| Settings | Yes | Defaults | Typio profile | Surprise config changes |
| Visual Shell | Yes | Calmness | Tasteful layout | Accessibility regressions |
| Onboarding | Partly | Strongly | First-run flow | Forced interruption |
| Agent/Sessions | Yes | Strongly | Session memory | Backend rewrite first |
| Auth/Trust | Yes | Strongly | Provider status | Silent suppression |
| Remote | Yes | Labels/fallbacks | Remote-aware sessions | URI scheme changes |
| Testing | Yes | Failure clarity | Fix-test workflows | Framework assumptions |
| Problems/Output/Logs | Yes | Error routing | Project health view | Hiding source detail |
| Notebooks/Rich Editors | Yes | Lightly | Notebook-aware agents | Early API redesign |
| Webviews/Custom UI | Yes | Visual hierarchy | Typio views | Breaking extension views |
| Accounts/Sync/Identity | Yes | Strongly | Provider center | Confusing auth identity |
| Comments/Review | Yes | PR prep | Agent review notes | Provider lock-in |
| Ports/Preview | Yes | App discovery | Dev server workflows | Noisy detection |
| Productization | Eventually | App identity | Update channels | Packaging mistakes |
| Performance/Processes | Yes | Startup feel | Deferred agent work | Heavy startup |
| Windows/Layout | Yes | Project identity | Session-scoped windows | Breaking restore/hot exit |
| Menus/Commands | Yes | Naming/coherence | Contextual agent actions | Command/keybinding breakage |
| Snippets/Code Actions | Yes | Native-vs-agent clarity | Escalate to agent when needed | Over-agentifying quick fixes |
| Timeline/History | Yes | Recovery clarity | Agent rollback timeline | Noisy history |
| Security/Secrets | Yes | Provider clarity | Credential overview | Token mishandling |
| User Data/State | Yes | Scope clarity | Typio profile/memory | State corruption |
| Localization | Yes | Copy discipline | Localizable Typio UI | Hard-coded strings |
| Dev Diagnostics | Yes | Support flow | Typio diagnostics | Hiding debug tools |
| Built-in Extensions | Yes | Curation | Typio built-in extension | Removing core behavior |
| Virtual FS/URI Schemes | Yes | Labels/fallbacks | Scheme-aware sessions | Local-file assumptions |
| Workspace Config | Yes | Explanation | Project setup assistant | Noisy config edits |
| Dev Containers | Yes | Environment clarity | Container-aware agents | Wrong execution context |
| Web/Restricted Hosts | Future-aware | Capability clarity | Graceful degradation | Desktop-only assumptions |
| CLI/Deep Links | Yes | Launch clarity | Session deep links | Script/tool breakage |
| Enterprise/Governance | Eventually | Data boundaries | Admin controls | AI adoption blockers |
| Media/Binary Assets | Yes | Asset clarity | Generated-file caution | Corrupting non-text files |
| Release Education | Yes | Typio updates | Workflow education | Noisy prompts |
| AI APIs/Tools | Yes | Provider coherence | Native agent tooling | Unstable/proposed seams |
| Inline AI Edits | Yes | Review clarity | Provenance and staged apply | Opaque edits |
| Progress/Cancellation | Yes | Agent states | Visible stop/pause controls | Hidden long-running work |
| OS/File Integration | Yes | Launch context | Session-aware file/folder open | Breaking native behavior |
| Indexing/Ignores | Yes | Scope clarity | Agent context indexing | Privacy/performance issues |
| Ambient Status | Yes | Restraint | Minimal session/provider state | UI clutter |
| Extension Development | Yes | Compatibility clarity | Typio built-ins/APIs | Ecosystem fragmentation |
| Workspace Trust | Yes | Agent safety language | Trust-aware tools | Weakening restricted mode |
| Feature Flags | Yes | Explainability | Staged Typio experiments | Hidden inconsistent states |
| Large Repos | Yes | Scale clarity | Progressive indexing | Naive context/indexing |
| Recovery/Troubleshooting | Yes | Escape hatches | Typio diagnostics/reset | No recovery path |
| Docs/Help | Yes | Terminology | Agent-native education | Confusing product language |
| Save Lifecycle | Yes | Agent dirty-state clarity | Safe multi-file apply/save | Silent overwrite/save bugs |
| Package Ecosystems | Yes | Runtime detection | Setup/test/build guidance | Wrong package assumptions |
| Supply Chain | Yes | Install transparency | Agent install approvals | Unsafe dependency changes |
| Privacy/Model Context | Yes | Data-flow clarity | Context inspector | Secret/code leakage |
| International Input | Yes | Accessible agent UI | IME-safe command surfaces | Input/focus regressions |
| Network/Proxy | Yes | Failure clarity | Provider degraded modes | Enterprise/offline breakage |
| File Watching | Yes | Agent change clarity | Session-aware file events | Stale state/data loss |
| Webview Security | Yes | Safe rendering | Secure Typio views | Injection/data exposure |
| Markdown/Docs Preview | Yes | Docs as context | Agent docs workflows | Unsafe rendered content |
| Licensing/Compliance | Yes | Notice hygiene | Typio compliance inventory | Release/legal blockers |
| Packaging/Signing | Eventually | App identity | Typio distribution | Broken trust/updates |
| Crash Recovery | Yes | Session recovery | Agent-safe restart | Lost/auditable work |
| Dense UI Primitives | Yes | Native consistency | Session/project views | Custom inaccessible UI |
| Multi-Resource Scope | Yes | Scope clarity | Selection-aware agents | Wrong-file operations |

---

## 69. Initial Review Questions

Before implementing Typio features, answer these for each area:

1. Is this an inherited VS Code strength we should preserve?
2. Is the problem technical, UX, visual, or conceptual?
3. Can it be changed as a built-in extension or narrow contribution?
4. Would the change be upstreamable, product-specific, or experimental?
5. Does it affect extension compatibility?
6. Does it affect accessibility or keyboard flow?
7. Does it introduce auth, trust, filesystem, shell, or network risk?
8. How would a new user understand this behavior?
9. How would an expert VS Code user recover their old workflow?
10. What should be documented before coding?

---

## 70. Next Documents to Create

- `feature-candidates.md` — candidate Typio features ranked by value/risk.
- `stages.md` — staged execution plan.
- `ux-principles.md` — detailed UI/UX principles for Typio.
- `agent-sessions.md` — product and architecture notes for AgentHost/Sessions.
- `auth-and-trust.md` — how Typio explains providers, sign-in, permissions, and command execution.
