# Typio Documentation Index

This directory is the working product and architecture memory for Typio, a tasteful agent-native VS Code fork.

The goal of these docs is to keep product decisions explicit before we make large code changes.

## Core Docs

- [Product README](./product/README.md) — product doc map and reading order.
- [Vision](./product/vision.md) — where the redesign, product taste, and long-term direction live.
- [VS Code Capability Map](./product/VS.md) — what VS Code already gives us across product, UX, UI, and technical systems.
- [Branching Strategy](./development/branching-strategy.md) — how we keep clean VS Code work separate from Typio product work.

## Working Principles

1. **Do not rebuild VS Code's core editor.** We inherit the editor, workbench, language stack, terminal, Git, debugger, and extension ecosystem.
2. **Document the inherited product before redesigning it.** We need to understand what VS Code already does before deciding what Typio changes.
3. **Separate product taste from upstream fixes.** Clean VS Code-compatible fixes belong on `vscode/main`; Typio feature work lands on `develop`; `main` stays pristine/stable.
4. **Treat UX as architecture.** Onboarding, empty states, auth prompts, command surfaces, layout, and session memory are core product systems, not decoration.
5. **Prefer staged changes.** Start with docs, then defaults and onboarding, then narrow workbench contributions, then deeper changes only when necessary.

## Suggested Reading Order

1. [Branching Strategy](./development/branching-strategy.md)
2. [VS Code Capability Map](./product/VS.md)
3. [Vision](./product/vision.md)

## Doc Ownership

- `product/VS.md` describes the inherited VS Code baseline.
- `product/vision.md` describes what Typio wants to become.
- Future stage/spec docs should explain how we move from baseline to vision.
