import { invoke } from "@tauri-apps/api/core";
import { syncDatabase, isDatabaseOpenSurreal } from "./db";

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingChanges: number;
  errors: string[];
}

let syncStatus: SyncStatus = {
  isSyncing: false,
  lastSyncTime: null,
  pendingChanges: 0,
  errors: [],
};

let syncInterval: NodeJS.Timeout | null = null;
const SYNC_INTERVAL_MS = 30000; // 30 seconds

/**
 * Get current sync status
 */
export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}

/**
 * Start automatic background sync
 * @param intervalMs Sync interval in milliseconds (default: 30 seconds)
 */
export async function startAutoSync(intervalMs: number = SYNC_INTERVAL_MS): Promise<void> {
  if (syncInterval) {
    stopAutoSync();
  }

  // Initial sync
  await performSync();

  // Set up interval
  syncInterval = setInterval(async () => {
    await performSync();
  }, intervalMs);
}

/**
 * Stop automatic background sync
 */
export function stopAutoSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

/**
 * Perform a manual sync
 */
export async function performSync(): Promise<void> {
  if (syncStatus.isSyncing) {
    console.log("Sync already in progress");
    return;
  }

  try {
    // Check if SurrealDB is open
    const isOpen = await isDatabaseOpenSurreal();
    if (!isOpen) {
      console.log("SurrealDB not open, skipping sync");
      return;
    }

    syncStatus.isSyncing = true;
    syncStatus.errors = [];

    // Call Rust backend to perform sync
    await syncDatabase();

    syncStatus.lastSyncTime = new Date();
    syncStatus.pendingChanges = 0;
    syncStatus.isSyncing = false;

    console.log("Sync completed successfully");
  } catch (error: any) {
    syncStatus.isSyncing = false;
    syncStatus.errors.push(error.toString());
    console.error("Sync error:", error);
  }
}

/**
 * Track a pending change (for future implementation)
 */
export function trackChange(table: string, recordId: string, operation: "create" | "update" | "delete"): void {
  syncStatus.pendingChanges++;
  // In a full implementation, you would store this in a queue
  // and process it during sync
}

/**
 * Clear sync errors
 */
export function clearSyncErrors(): void {
  syncStatus.errors = [];
}
