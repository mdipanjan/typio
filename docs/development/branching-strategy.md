# Branching Strategy

This repo is a private product fork of VS Code for Typio.

## Remotes

```txt
upstream = microsoft/vscode
origin   = mdipanjan/typio
```

`upstream` is the source of clean VS Code changes. `origin` is our private Typio repo.

Push to `upstream` is disabled locally for safety.

## Long-Lived Branches

```txt
vscode/main = clean VS Code base
main        = Typio product branch
```

`main` is the default branch for the Typio repo, so normal product commits and PRs count as project work on GitHub.

## Mental Model

```txt
microsoft/vscode
      ↓
vscode/main      clean upstream-compatible VS Code
      ↓
main             Typio product work
```

Changes flow downward only:

```txt
upstream/main → vscode/main → main
```

Never merge Typio product changes back into `vscode/main`.

## Rules

### `vscode/main`

Use `vscode/main` only for:

- clean VS Code base
- upstream-compatible fixes
- small patches that could be proposed to Microsoft VS Code

Do not put Typio branding, taste, onboarding, or product-specific behavior on `vscode/main`.

### `main`

Use `main` for:

- Typio branding
- tasteful shell changes
- onboarding
- custom defaults
- Agent/Sessions UX changes
- Pi Agent integration
- product-specific workflows
- documentation about Typio strategy

## Creating an Upstream Fix

Start from clean `vscode/main`:

```bash
git checkout vscode/main
git fetch upstream
git merge upstream/main
git checkout -b upstream/fix-something
```

After making the fix, if Typio also needs it:

```bash
git checkout main
git cherry-pick <fix-commit-sha>
```

## Creating Typio Product Work

Start from `main`:

```bash
git checkout main
git pull
git checkout -b product/something
```

Open PRs back into:

```txt
main
```

## Updating Typio from VS Code

```bash
git fetch upstream

git checkout vscode/main
git merge upstream/main
git push origin vscode/main

git checkout main
git merge vscode/main
git push origin main
```

## Safety Rules

Do not run:

```bash
git checkout vscode/main
git merge main
```

Do not mix upstreamable fixes and Typio product changes in one commit.

Use commit prefixes:

```txt
upstream: skip unsupported file dialog URI schemes
product: show agent welcome on startup
product: add Pi Agent integration plan
```

## Current Convention

- local working folder may still be named `vscode`
- GitHub private repo is `mdipanjan/typio`
- `origin/main` is Typio product work
- `origin/vscode/main` is the clean VS Code mirror
- development happens in the local VS Code checkout
- product PRs target `main`
