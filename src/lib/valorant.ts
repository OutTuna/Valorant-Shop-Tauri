import { Store } from "@tauri-apps/plugin-store";

const STORE_FILE = "prefs.json";
const SESSION_KEY = "session";
const LOADED_AT_KEY = "sessionLoadedAt";
const REGION_KEY = "region";

export interface ShopItem {
  uuid: string;
  name: string;
  image: string;
  price?: number;
  remaining: number;
  originalPrice?: number;
  discountedPrice?: number;
  discountPercent?: number;
}

export interface ShopSession {
  player: {
    puuid: string;
    name: string;
    tag: string;
    vp: number;
  };
  region: string;
  shop: {
    daily: ShopItem[];
    night: ShopItem[];
  };
}

function getStore(): Promise<Store> {
  return Store.load(STORE_FILE);
}

/**
 * Reads the persisted shop session together with the timestamp it was
 * originally saved at. The timestamp is used by the UI to keep countdown
 * timers accurate across app restarts.
 *
 * Returns null when there is no session or the daily shop has already
 * expired (remaining time ≤ 0).
 */
export async function readStoredSession(): Promise<{
  session: ShopSession;
  loadedAt: number;
} | null> {
  try {
    const store = await getStore();
    const session = await store.get<ShopSession>(SESSION_KEY);
    const loadedAt = await store.get<number>(LOADED_AT_KEY);

    if (!session || loadedAt == null) return null;

    // Invalidate automatically when the daily shop timer has run out.
    const firstItem = session.shop.daily[0];
    if (firstItem) {
      const elapsedSec = (Date.now() - loadedAt) / 1000;
      if (firstItem.remaining - elapsedSec <= 0) {
        await store.delete(SESSION_KEY);
        await store.delete(LOADED_AT_KEY);
        await store.save();
        return null;
      }
    }

    return { session, loadedAt };
  } catch {
    return null;
  }
}

/**
 * Persists the shop session to disk. The save timestamp is stored alongside
 * so countdown timers remain correct after the app is restarted.
 */
export async function saveStoredSession(session: ShopSession): Promise<void> {
  try {
    const store = await getStore();
    await store.set(SESSION_KEY, session);
    await store.set(LOADED_AT_KEY, Date.now());
    await store.save();
  } catch (e) {
    console.error("Failed to save session:", e);
  }
}

export async function clearStoredSession(): Promise<void> {
  try {
    const store = await getStore();
    await store.delete(SESSION_KEY);
    await store.delete(LOADED_AT_KEY);
    await store.save();
  } catch {}
}

/** Persists the user's preferred region so it survives app restarts. */
export async function readStoredRegion(): Promise<string> {
  try {
    const store = await getStore();
    return (await store.get<string>(REGION_KEY)) ?? "auto";
  } catch {
    return "auto";
  }
}

export async function saveStoredRegion(region: string): Promise<void> {
  try {
    const store = await getStore();
    await store.set(REGION_KEY, region);
    await store.save();
  } catch {}
}
