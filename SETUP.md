# SecureVision AI — Local Setup Guide

This repo contains **placeholders** for secrets. Create two git-ignored local files with your real values before running.

## 1. CompreFace API Key

Create `src/lib/compreface.local.ts`:

```ts
export const LOCAL_API_KEY = 'YOUR_COMPREFACE_API_KEY_HERE';
```

Get the key from http://localhost:8000 → your application → API key.

## 2. Admin Default Password

Create `src/lib/auth.local.ts`:

```ts
export const LOCAL_DEFAULT_PASSWORD = 'YOUR_CHOSEN_PASSWORD';
```

Used only on first run to seed the admin account. Change it after first login.

## 3. Verify git ignores both files

```bash
git status | grep local.ts    # should print nothing
```

## 4. Run

```bash
npm install
npm run dev
```

Open http://localhost:5173.
