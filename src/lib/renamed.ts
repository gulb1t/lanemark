import { del, get, keys, set } from 'idb-keyval'

/**
 * Lanemark was called SwimTrack, and so were the keys it saves on the device. These move anything saved under the old
 * names once, so nobody loses their settings, their place in the tours, or edits that haven't synced yet.
 */
const OLD = 'swimtrack:'
const NEW = 'lanemark:'

/** Settings and small flags (localStorage and sessionStorage). Runs before anything reads them. */
export function moveSavedSettings() {
  for (const store of [localStorage, sessionStorage]) {
    try {
      for (const key of Object.keys(store)) {
        if (!key.startsWith(OLD)) continue
        const renamed = NEW + key.slice(OLD.length)
        if (store.getItem(renamed) === null) store.setItem(renamed, store.getItem(key) ?? '')
        store.removeItem(key)
      }
    } catch {
      /* storage blocked: nothing to move */
    }
  }
}

/** The offline copy of classes and swimmers, with any unsynced edits (IndexedDB). Runs before sync starts. */
export async function moveOfflineData() {
  try {
    for (const key of await keys()) {
      if (typeof key !== 'string' || !key.startsWith(OLD)) continue
      const renamed = NEW + key.slice(OLD.length)
      if ((await get(renamed)) === undefined) await set(renamed, await get(key))
      await del(key)
    }
  } catch {
    /* no IndexedDB (private mode): nothing to move */
  }
}
