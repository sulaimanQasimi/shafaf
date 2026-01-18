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
  image_path?: string | null;
  bar_code?: string | null;
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
 * @param image_path Optional image path
 * @param bar_code Optional bar code
 * @returns Promise with Product
 */
export async function createProduct(
  name: string,
  description?: string | null,
  price?: number | null,
  currency_id?: number | null,
  supplier_id?: number | null,
  stock_quantity?: number | null,
  unit?: string | null,
  image_path?: string | null,
  bar_code?: string | null
): Promise<Product> {
  return await invoke<Product>("create_product", {
    name,
    description: description || null,
    price: price || null,
    currencyId: currency_id || null,
    supplierId: supplier_id || null,
    stockQuantity: stock_quantity || null,
    unit: unit || null,
    imagePath: image_path || null,
    barCode: bar_code || null,
  });
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

/**
 * Get all products with pagination
 * @param page Page number
 * @param perPage Items per page
 * @param search Search query
 * @param sortBy Sort column
 * @param sortOrder Sort order
 * @returns Promise with paginated products
 */
export async function getProducts(
  page: number = 1,
  perPage: number = 10,
  search: string = "",
  sortBy: string = "created_at",
  sortOrder: "asc" | "desc" = "desc"
): Promise<PaginatedResponse<Product>> {
  return await invoke<PaginatedResponse<Product>>("get_products", {
    page,
    perPage,
    search: search || null,
    sortBy: sortBy || null,
    sortOrder: sortOrder || null,
  });
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
 * @param image_path Optional image path
 * @param bar_code Optional bar code
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
  unit?: string | null,
  image_path?: string | null,
  bar_code?: string | null
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
    imagePath: image_path || null,
    barCode: bar_code || null,
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
