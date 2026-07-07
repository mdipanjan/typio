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
main        = pristine Typio product branch
develop     = Typio integration branch
```

`main` is the stable/pristine Typio branch. Do not merge day-to-day feature PRs directly into it.

`develop` is where Typio product PRs land first.

## Mental Model

```txt
microsoft/vscode
      ↓
vscode/main      clean upstream-compatible VS Code
      ↓
develop          Typio integration work
      ↓
main             pristine Typio product branch
```

Changes flow downward only:

```txt
upstream/main → vscode/main → develop → main
```

Never merge Typio product changes back into `vscode/main`.

## Rules

### `vscode/main`

Use `vscode/main` only for:

- clean VS Code base
- upstream-compatible fixes
- small patches that could be proposed to Microsoft VS Code

Do not put Typio branding, taste, onboarding, or product-specific behavior on `vscode/main`.

### `develop`

Use `develop` for:

- Typio product PRs
- documentation PRs
- feature integration
- Pi Agent integration
- onboarding and UX work
- product-specific workflows

Feature branches should usually branch from `develop` and open PRs back into `develop`.

### `main`

Use `main` as the pristine/stable Typio branch.

Only merge `develop` into `main` when we intentionally promote a reviewed, working product state.

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
git checkout develop
git cherry-pick <fix-commit-sha>
```

## Creating Typio Product Work

Start from `develop`:

```bash
git checkout develop
git pull
git checkout -b product/something
```

Open PRs back into:

```txt
develop
```

## Promoting Develop to Main

Only after review/testing:

```bash
git checkout main
git pull
git merge develop
git push origin main
```

## Updating Typio from VS Code

```bash
git fetch upstream

git checkout vscode/main
git merge upstream/main
git push origin vscode/main

git checkout develop
git merge vscode/main
git push origin develop
```

Then promote to `main` only when ready:

```bash
git checkout main
git merge develop
git push origin main
```

## Safety Rules

Do not run:

```bash
git checkout vscode/main
git merge main
```

Do not merge feature branches directly into `main` unless we intentionally skip `develop` for an emergency.

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
- `origin/vscode/main` is the clean VS Code mirror
- `origin/develop` is Typio integration work
- `origin/main` is pristine/stable Typio
- development happens in the local VS Code checkout
- product PRs target `develop`
- promotion PRs/merges go from `develop` to `main`
