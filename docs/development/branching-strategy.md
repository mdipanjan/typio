# Branching Strategy

This repo is a private product fork of VS Code for Typio.

## Remotes

```txt
upstream = microsoft/vscode
origin   = mdipanjan/typio
```

`upstream` is the source of clean VS Code changes. `origin` is our private Typio repo.

## Long-Lived Branches

```txt
main          = clean VS Code base
product/main = Typio product branch
```

## Mental Model

```txt
microsoft/vscode
      ↓
main              clean upstream-compatible VS Code
      ↓
product/main      Typio product work
```

Changes flow downward only:

```txt
upstream/main → main → product/main
```

Never merge product changes back into `main`.

## Rules

### `main`

Use `main` only for:

- clean VS Code base
- upstream-compatible fixes
- small patches that could be proposed to Microsoft VS Code

Do not put Typio branding, taste, onboarding, or product-specific behavior on `main`.

### `product/main`

Use `product/main` for:

- Typio branding
- tasteful shell changes
- onboarding
- custom defaults
- Agent/Sessions UX changes
- product-specific workflows
- documentation about Typio strategy

## Creating an Upstream Fix

Start from clean `main`:

```bash
git checkout main
git fetch upstream
git merge upstream/main
git checkout -b upstream/fix-something
```

After making the fix, if Typio also needs it:

```bash
git checkout product/main
git cherry-pick <fix-commit-sha>
```

## Creating Typio Product Work

Start from `product/main`:

```bash
git checkout product/main
git checkout -b product/something
```

Merge back when ready:

```bash
git checkout product/main
git merge product/something
```

## Updating from VS Code

```bash
git fetch upstream

git checkout main
git merge upstream/main
git push origin main

git checkout product/main
git merge main
git push origin product/main
```

## Safety Rules

Do not run:

```bash
git checkout main
git merge product/main
```

Do not mix upstreamable fixes and Typio product changes in one commit.

Use commit prefixes:

```txt
upstream: skip unsupported file dialog URI schemes
product: show agent welcome on startup
product: add onboarding vision doc
```

## Current Convention

- local working folder may still be named `vscode`
- GitHub private repo is `mdipanjan/typio`
- development happens in the local VS Code checkout
- pushes go to `origin` (`typio`)
