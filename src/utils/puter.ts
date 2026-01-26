export const LS_PUTER_APP_ID = "shafaf_puter_app_id";
export const LS_PUTER_TOKEN = "shafaf_puter_auth_token";
export const LS_PUTER_MODEL = "shafaf_puter_model";
export const PUTER_SCRIPT_BASE = "https://js.puter.com/v2/";

export function isPuterAvailable(): boolean {
  return typeof window !== "undefined" && !!(window as Window & { puter?: { ai?: { chat: unknown } } }).puter?.ai?.chat;
}

/**
 * Load Puter SDK with appId and authToken. Persists to localStorage on success.
 * @returns Promise<true> if puter.ai.chat is available after load, Promise<false> otherwise.
 */
export function loadPuter(appId: string, authToken: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    const w = window as Window & { puter?: { ai?: { chat: unknown } } };
    if (w.puter?.ai?.chat) {
      try {
        localStorage.setItem(LS_PUTER_APP_ID, appId);
        localStorage.setItem(LS_PUTER_TOKEN, authToken);
      } catch (_) {}
      resolve(true);
      return;
    }
    const existing = document.querySelector(`script[src^="${PUTER_SCRIPT_BASE}"]`);
    if (existing) existing.remove();
    const params = new URLSearchParams({ appId, authToken });
    const src = `${PUTER_SCRIPT_BASE}?${params.toString()}`;
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => {
      const pw = window as Window & { puter?: { ai?: { chat: unknown } } };
      const ok = !!pw.puter?.ai?.chat;
      if (ok) {
        try {
          localStorage.setItem(LS_PUTER_APP_ID, appId);
          localStorage.setItem(LS_PUTER_TOKEN, authToken);
        } catch (_) {}
      }
      resolve(ok);
    };
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}
