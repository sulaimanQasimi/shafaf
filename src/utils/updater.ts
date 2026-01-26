import { check } from "@tauri-apps/plugin-updater";

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
    
    if (update) {
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
    
    if (!update) {
      throw new Error("No update available");
    }
    
    // Download and install the update with progress callback
    // The app will automatically restart after installation
    await update.downloadAndInstall((progress: { event: string; data?: any }) => {
      if (progress.event === "Started") {
        console.log("Update download started");
      } else if (progress.event === "Progress") {
        console.log(`Download progress: ${progress.data?.chunkLength || 0} bytes`);
      } else if (progress.event === "Finished") {
        console.log("Update downloaded and installed");
      }
    });
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
