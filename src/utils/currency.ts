import { invoke } from "@tauri-apps/api/core";

export interface Currency {
  id: number;
  name: string;
  base: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Initialize the currencies table schema
 * @returns Promise with success message
 */
export async function initCurrenciesTable(): Promise<string> {
  return await invoke<string>("init_currencies_table");
}

/**
 * Create a new currency
 * @param name Currency name (in Persian/Dari)
 * @param base Whether this is the base currency
 * @returns Promise with Currency
 */
export async function createCurrency(
  name: string,
  base: boolean
): Promise<Currency> {
  return await invoke<Currency>("create_currency", {
    name,
    base,
  });
}

/**
 * Get all currencies
 * @returns Promise with array of Currency
 */
export async function getCurrencies(): Promise<Currency[]> {
  return await invoke<Currency[]>("get_currencies");
}

/**
 * Update a currency
 * @param id Currency ID
 * @param name Currency name (in Persian/Dari)
 * @param base Whether this is the base currency
 * @returns Promise with Currency
 */
export async function updateCurrency(
  id: number,
  name: string,
  base: boolean
): Promise<Currency> {
  return await invoke<Currency>("update_currency", {
    id,
    name,
    base,
  });
}

/**
 * Delete a currency
 * @param id Currency ID
 * @returns Promise with success message
 */
export async function deleteCurrency(id: number): Promise<string> {
  return await invoke<string>("delete_currency", { id });
}
