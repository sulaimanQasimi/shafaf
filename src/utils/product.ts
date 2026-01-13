import { invoke } from "@tauri-apps/api/core";

export interface Product {
  id: number;
  name: string;
  description?: string | null;
  price?: number | null;
  currency_id?: number | null;
  supplier_id?: number | null;
  stock_quantity?: number | null;
  unit?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Initialize the products table schema
 * @returns Promise with success message
 */
export async function initProductsTable(): Promise<string> {
  return await invoke<string>("init_products_table");
}

/**
 * Create a new product
 * @param name Product name
 * @param description Optional description
 * @param price Optional price
 * @param currency_id Optional currency ID
 * @param supplier_id Optional supplier ID
 * @param stock_quantity Optional stock quantity
 * @param unit Optional unit (e.g., kg, piece)
 * @returns Promise with Product
 */
export async function createProduct(
  name: string,
  description?: string | null,
  price?: number | null,
  currency_id?: number | null,
  supplier_id?: number | null,
  stock_quantity?: number | null,
  unit?: string | null
): Promise<Product> {
  return await invoke<Product>("create_product", {
    name,
    description: description || null,
    price: price || null,
    currencyId: currency_id || null,
    supplierId: supplier_id || null,
    stockQuantity: stock_quantity || null,
    unit: unit || null,
  });
}

/**
 * Get all products
 * @returns Promise with array of Product
 */
export async function getProducts(): Promise<Product[]> {
  return await invoke<Product[]>("get_products");
}

/**
 * Update a product
 * @param id Product ID
 * @param name Product name
 * @param description Optional description
 * @param price Optional price
 * @param currency_id Optional currency ID
 * @param supplier_id Optional supplier ID
 * @param stock_quantity Optional stock quantity
 * @param unit Optional unit
 * @returns Promise with Product
 */
export async function updateProduct(
  id: number,
  name: string,
  description?: string | null,
  price?: number | null,
  currency_id?: number | null,
  supplier_id?: number | null,
  stock_quantity?: number | null,
  unit?: string | null
): Promise<Product> {
  return await invoke<Product>("update_product", {
    id,
    name,
    description: description || null,
    price: price || null,
    currencyId: currency_id || null,
    supplierId: supplier_id || null,
    stockQuantity: stock_quantity || null,
    unit: unit || null,
  });
}

/**
 * Delete a product
 * @param id Product ID
 * @returns Promise with success message
 */
export async function deleteProduct(id: number): Promise<string> {
  return await invoke<string>("delete_product", { id });
}
