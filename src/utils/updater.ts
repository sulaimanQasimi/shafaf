import { check, onUpdaterEvent } from "@tauri-apps/plugin-updater";
import { getCurrent } from "@tauri-apps/api/window";

/**
 * Check for updates and return update information
 * @returns Promise with update information or null if no update available
 */
export async function checkForUpdates(): Promise<{
  available: boolean;
  version?: string;
  date?: string;
  body?: string;
} | null> {
  try {
    const update = await check();
    
    if (update?.available) {
      return {
        available: true,
        version: update.version,
        date: update.date,
        body: update.body,
      };
    }
    
    return {
      available: false,
    };
  } catch (error) {
    console.error("Error checking for updates:", error);
    return null;
  }
}

/**
 * Install the available update
 * This will download and install the update, then restart the app
 */
export async function installUpdate(): Promise<void> {
  try {
    const update = await check();
    
    if (!update?.available) {
      throw new Error("No update available");
    }
    
    // Listen to update events
    await onUpdaterEvent(({ event, data }) => {
      console.log("Updater event:", event, data);
      
      if (event === "ERROR") {
        console.error("Update error:", data);
      } else if (event === "UPTODATE") {
        console.log("App is up to date");
      } else if (event === "UPDATE_AVAILABLE") {
        console.log("Update available:", data);
      } else if (event === "DOWNLOAD_PROGRESS") {
        console.log("Download progress:", data);
      } else if (event === "DOWNLOADED") {
        console.log("Update downloaded");
      } else if (event === "INSTALLED") {
        console.log("Update installed");
      }
    });
    
    // Download and install the update
    await update.downloadAndInstall();
    
    // Restart the app
    await update.installAndRestart();
  } catch (error) {
    console.error("Error installing update:", error);
    throw error;
  }
}

/**
 * Check for updates on app startup
 * This can be called from the main App component
 */
export async function checkForUpdatesOnStartup(): Promise<void> {
  try {
    const updateInfo = await checkForUpdates();
    
    if (updateInfo?.available) {
      // You can show a notification or dialog here
      console.log("Update available:", updateInfo.version);
      
      // Optionally show a notification to the user
      // This would require adding a notification system
    }
  } catch (error) {
    console.error("Error checking for updates on startup:", error);
  }
}
