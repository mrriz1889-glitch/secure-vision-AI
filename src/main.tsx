import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useStore } from './store/useStore'
import * as db from './lib/db'

async function migrateLinks() {
  // Ensure every existing link has useCount + maxUses fields
  // and force maxUses to 1 (single-use policy)
  const links = await db.getAllLinks();
  for (const link of links) {
    let changed = false;
    const patched: any = { ...link };
    if (typeof patched.useCount !== 'number') {
      patched.useCount = patched.used ? 1 : 0;
      changed = true;
    }
    // Force single-use policy on all links
    if (patched.maxUses !== 1) {
      patched.maxUses = 1;
      changed = true;
    }
    // If already used or already at cap, mark used
    if (patched.useCount >= 1 && !patched.used) {
      patched.used = true;
      changed = true;
    }
    if (changed) await db.updateLink(patched);
  }
}

async function boot() {
  await migrateLinks();
  await useStore.getState().hydrate();
  await useStore.getState().hydrateCameras();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

boot();
