export const LS_PUTER_APP_ID = "puter.app.id";
export const LS_PUTER_TOKEN = "puter.auth.token";
export const LS_PUTER_MODEL = "shafaf_puter_model";
export const PUTER_SCRIPT_BASE = "https://js.puter.com/v2/";
/*
 * Load Puter credentials from the server-stored file and save to localStorage
 * This is called when credentials are detected in ai.html
 */
export async function loadPuterCredentialsFromServer(): Promise<boolean> {
  try {
    const response = await fetch('http://127.0.0.1:5021/api/get-credentials');
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    if (data.app_id && data.auth_token) {
      try {
        localStorage.setItem(LS_PUTER_APP_ID, data.app_id);
        localStorage.setItem(LS_PUTER_TOKEN, data.auth_token);
        return true;
      } catch (_) {
        return false;
      }
    }
    return false;
  } catch (_) {
    return false;
  }
}

/**
 * Periodically check for Puter credentials from the server
 * This is useful when credentials are set in ai.html
 */
export function startCredentialSync(intervalMs: number = 5000): () => void {
  let intervalId: NodeJS.Timeout | null = null;
  
  const checkCredentials = async () => {
    // Only check if we don't already have credentials
    const existingId = localStorage.getItem(LS_PUTER_APP_ID);
    const existingToken = localStorage.getItem(LS_PUTER_TOKEN);
    
    if (!existingId || !existingToken) {
      await loadPuterCredentialsFromServer();
    }
  };
  
  // Check immediately
  checkCredentials();
  
  // Then check periodically
  intervalId = setInterval(checkCredentials, intervalMs);
  
  // Return cleanup function
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
}

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
        // Remove old keys if they exist
        localStorage.removeItem("shafaf_puter_app_id");
        localStorage.removeItem("shafaf_puter_auth_token");
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
          // Remove old keys if they exist
          localStorage.removeItem("shafaf_puter_app_id");
          localStorage.removeItem("shafaf_puter_auth_token");
        } catch (_) {}
      }
      resolve(ok);
    };
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}
