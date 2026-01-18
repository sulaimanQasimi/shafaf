import { invoke } from "@tauri-apps/api/core";

/**
 * Get the machine ID for this device
 * @returns Promise with machine ID string
 */
export async function getMachineId(): Promise<string> {
  return await invoke<string>("get_machine_id");
}

/**
 * Store license key in secure storage
 * @param key The encrypted license key to store
 * @returns Promise that resolves when key is stored
 */
export async function storeLicenseKey(key: string): Promise<void> {
  return await invoke<void>("store_license_key", { key });
}

/**
 * Get the stored license key from secure storage
 * @returns Promise with license key or null if not found
 */
export async function getLicenseKey(): Promise<string | null> {
  const key = await invoke<string | null>("get_license_key");
  return key;
}

/**
 * Validate a license key by encrypting current machine ID and comparing
 * @param key The license key to validate
 * @returns Promise with boolean indicating if key is valid
 */
export async function validateLicenseKey(key: string): Promise<boolean> {
  return await invoke<boolean>("validate_license_key", { enteredKey: key });
}

/**
 * Check if a valid license exists in secure storage
 * @returns Promise with boolean indicating if valid license exists
 */
export async function isLicenseValid(): Promise<boolean> {
  try {
    const storedKey = await getLicenseKey();
    if (!storedKey) {
      return false;
    }
    
    // Validate the stored key
    const isValid = await validateLicenseKey(storedKey);
    return isValid;
  } catch (error) {
    console.error("Error checking license validity:", error);
    return false;
  }
}
