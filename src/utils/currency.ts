import { invoke } from "@tauri-apps/api/core";

export interface Currency {
  id: number;
  name: string;
  base: boolean;
  rate: number;
  created_at: string;
  updated_at: string;
}

export interface CurrencyExchangeRate {
  id: number;
  from_currency_id: number;
  to_currency_id: number;
  rate: number;
  date: string;
  created_at: string;
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
 * @param rate Exchange rate (default: 1.0)
 * @returns Promise with Currency
 */
export async function createCurrency(
  name: string,
  base: boolean,
  rate: number = 1.0
): Promise<Currency> {
  return await invoke<Currency>("create_currency", {
    name,
    base,
    rate,
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
 * @param rate Exchange rate
 * @returns Promise with Currency
 */
export async function updateCurrency(
  id: number,
  name: string,
  base: boolean,
  rate: number
): Promise<Currency> {
  return await invoke<Currency>("update_currency", {
    id,
    name,
    base,
    rate,
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

/**
 * Initialize the currency exchange rates table schema
 * @returns Promise with success message
 */
export async function initCurrencyExchangeRatesTable(): Promise<string> {
  return await invoke<string>("init_currency_exchange_rates_table");
}

/**
 * Create an exchange rate
 * @param from_currency_id From currency ID
 * @param to_currency_id To currency ID
 * @param rate Exchange rate
 * @param date Date for the rate
 * @returns Promise with CurrencyExchangeRate
 */
export async function createExchangeRate(
  from_currency_id: number,
  to_currency_id: number,
  rate: number,
  date: string
): Promise<CurrencyExchangeRate> {
  return await invoke<CurrencyExchangeRate>("create_exchange_rate", {
    fromCurrencyId: from_currency_id,
    toCurrencyId: to_currency_id,
    rate,
    date,
  });
}

/**
 * Get exchange rate for a specific date (or latest)
 * @param from_currency_id From currency ID
 * @param to_currency_id To currency ID
 * @param date Optional date (if not provided, returns latest)
 * @returns Promise with exchange rate
 */
export async function getExchangeRate(
  from_currency_id: number,
  to_currency_id: number,
  date?: string | null
): Promise<number> {
  return await invoke<number>("get_exchange_rate", {
    fromCurrencyId: from_currency_id,
    toCurrencyId: to_currency_id,
    date: date || null,
  });
}

/**
 * Get exchange rate history
 * @param from_currency_id From currency ID
 * @param to_currency_id To currency ID
 * @returns Promise with array of CurrencyExchangeRate
 */
export async function getExchangeRateHistory(
  from_currency_id: number,
  to_currency_id: number
): Promise<CurrencyExchangeRate[]> {
  return await invoke<CurrencyExchangeRate[]>("get_exchange_rate_history", {
    fromCurrencyId: from_currency_id,
    toCurrencyId: to_currency_id,
  });
}
