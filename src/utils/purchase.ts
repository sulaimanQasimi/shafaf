import { invoke } from "@tauri-apps/api/core";

export interface Purchase {
  id: number;
  supplier_id: number;
  date: string;
  notes?: string | null;
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export interface PurchaseItem {
  id: number;
  purchase_id: number;
  product_id: number;
  unit_id: number;
  per_price: number;
  amount: number;
  total: number;
  created_at: string;
}

export interface PurchaseWithItems {
  purchase: Purchase;
  items: PurchaseItem[];
}

export interface PurchaseItemInput {
  product_id: number;
  unit_id: number;
  per_price: number;
  amount: number;
}

/**
 * Initialize the purchases table schema
 * @returns Promise with success message
 */
export async function initPurchasesTable(): Promise<string> {
  return await invoke<string>("init_purchases_table");
}

/**
 * Create a new purchase with items
 * @param supplier_id Supplier ID
 * @param date Purchase date
 * @param notes Optional notes
 * @param items Array of purchase items
 * @returns Promise with Purchase
 */
export async function createPurchase(
  supplier_id: number,
  date: string,
  notes: string | null,
  items: PurchaseItemInput[]
): Promise<Purchase> {
  // Convert items to tuple format expected by Rust: (product_id, unit_id, per_price, amount)
  const itemsTuple: [number, number, number, number][] = items.map(item => [
    item.product_id,
    item.unit_id,
    item.per_price,
    item.amount,
  ]);

  return await invoke<Purchase>("create_purchase", {
    supplierId: supplier_id,
    date,
    notes: notes || null,
    items: itemsTuple,
  });
}

/**
 * Get all purchases
 * @returns Promise with array of Purchase
 */
export async function getPurchases(): Promise<Purchase[]> {
  return await invoke<Purchase[]>("get_purchases");
}

/**
 * Get a single purchase with its items
 * @param id Purchase ID
 * @returns Promise with Purchase and PurchaseItems
 */
export async function getPurchase(id: number): Promise<PurchaseWithItems> {
  const result = await invoke<[Purchase, PurchaseItem[]]>("get_purchase", { id });
  return {
    purchase: result[0],
    items: result[1],
  };
}

/**
 * Update a purchase
 * @param id Purchase ID
 * @param supplier_id Supplier ID
 * @param date Purchase date
 * @param notes Optional notes
 * @param items Array of purchase items
 * @returns Promise with Purchase
 */
export async function updatePurchase(
  id: number,
  supplier_id: number,
  date: string,
  notes: string | null,
  items: PurchaseItemInput[]
): Promise<Purchase> {
  // Convert items to tuple format expected by Rust
  const itemsTuple: [number, string, number, number][] = items.map(item => [
    item.product_id,
    item.unit_id,
    item.per_price,
    item.amount,
  ]);

  return await invoke<Purchase>("update_purchase", {
    id,
    supplierId: supplier_id,
    date,
    notes: notes || null,
    items: itemsTuple,
  });
}

/**
 * Delete a purchase
 * @param id Purchase ID
 * @returns Promise with success message
 */
export async function deletePurchase(id: number): Promise<string> {
  return await invoke<string>("delete_purchase", { id });
}

/**
 * Create a purchase item
 * @param purchase_id Purchase ID
 * @param product_id Product ID
 * @param unit_id Unit ID (string)
 * @param per_price Price per unit
 * @param amount Quantity
 * @returns Promise with PurchaseItem
 */
export async function createPurchaseItem(
  purchase_id: number,
  product_id: number,
  unit_id: number,
  per_price: number,
  amount: number
): Promise<PurchaseItem> {
  return await invoke<PurchaseItem>("create_purchase_item", {
    purchaseId: purchase_id,
    productId: product_id,
    unitId: unit_id,
    perPrice: per_price,
    amount,
  });
}

/**
 * Get purchase items for a purchase
 * @param purchase_id Purchase ID
 * @returns Promise with array of PurchaseItem
 */
export async function getPurchaseItems(purchase_id: number): Promise<PurchaseItem[]> {
  return await invoke<PurchaseItem[]>("get_purchase_items", { purchaseId: purchase_id });
}

/**
 * Update a purchase item
 * @param id PurchaseItem ID
 * @param product_id Product ID
 * @param unit_id Unit ID (string)
 * @param per_price Price per unit
 * @param amount Quantity
 * @returns Promise with PurchaseItem
 */
export async function updatePurchaseItem(
  id: number,
  product_id: number,
  unit_id: number,
  per_price: number,
  amount: number
): Promise<PurchaseItem> {
  return await invoke<PurchaseItem>("update_purchase_item", {
    id,
    productId: product_id,
    unitId: unit_id,
    perPrice: per_price,
    amount,
  });
}

/**
 * Delete a purchase item
 * @param id PurchaseItem ID
 * @returns Promise with success message
 */
export async function deletePurchaseItem(id: number): Promise<string> {
  return await invoke<string>("delete_purchase_item", { id });
}
