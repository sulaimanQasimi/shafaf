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

export interface PurchaseAdditionalCost {
  id: number;
  purchase_id: number;
  name: string;
  amount: number;
  created_at: string;
}

export interface PurchaseWithItems {
  purchase: Purchase;
  items: PurchaseItem[];
  additional_costs?: PurchaseAdditionalCost[];
}

export interface PurchaseItemInput {
  product_id: number;
  unit_id: number;
  per_price: number;
  amount: number;
}

export interface PurchaseAdditionalCostInput {
  name: string;
  amount: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
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
 * @param additional_costs Array of additional costs
 * @param items Array of purchase items
 * @returns Promise with Purchase
 */
export async function createPurchase(
  supplier_id: number,
  date: string,
  notes: string | null,
  additional_costs: PurchaseAdditionalCostInput[],
  items: PurchaseItemInput[]
): Promise<Purchase> {
  // Convert items to tuple format expected by Rust: (product_id, unit_id, per_price, amount)
  const itemsTuple: [number, number, number, number][] = items.map(item => [
    item.product_id,
    item.unit_id,
    item.per_price,
    item.amount,
  ]);

  // Convert additional_costs to tuple format expected by Rust: (name, amount)
  const additionalCostsTuple: [string, number][] = additional_costs.map(cost => [
    cost.name,
    cost.amount,
  ]);

  return await invoke<Purchase>("create_purchase", {
    supplierId: supplier_id,
    date,
    notes: notes || null,
    additionalCosts: additionalCostsTuple,
    items: itemsTuple,
  });
}

/**
 * Get all purchases with pagination
 * @param page Page number
 * @param perPage Items per page
 * @param search Search query
 * @param sortBy Sort column
 * @param sortOrder Sort order
 * @returns Promise with paginated purchases
 */
export async function getPurchases(
  page: number = 1,
  perPage: number = 10,
  search: string = "",
  sortBy: string = "date",
  sortOrder: "asc" | "desc" = "desc"
): Promise<PaginatedResponse<Purchase>> {
  return await invoke<PaginatedResponse<Purchase>>("get_purchases", {
    page,
    perPage,
    search: search || null,
    sortBy: sortBy || null,
    sortOrder: sortOrder || null,
  });
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
 * @param additional_costs Array of additional costs
 * @param items Array of purchase items
 * @returns Promise with Purchase
 */
export async function updatePurchase(
  id: number,
  supplier_id: number,
  date: string,
  notes: string | null,
  additional_costs: PurchaseAdditionalCostInput[],
  items: PurchaseItemInput[]
): Promise<Purchase> {
  // Convert items to tuple format expected by Rust: (product_id, unit_id, per_price, amount)
  const itemsTuple: [number, number, number, number][] = items.map(item => [
    item.product_id,
    item.unit_id,
    item.per_price,
    item.amount,
  ]);

  // Convert additional_costs to tuple format expected by Rust: (name, amount)
  const additionalCostsTuple: [string, number][] = additional_costs.map(cost => [
    cost.name,
    cost.amount,
  ]);

  return await invoke<Purchase>("update_purchase", {
    id,
    supplierId: supplier_id,
    date,
    notes: notes || null,
    additionalCosts: additionalCostsTuple,
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

/**
 * Get purchase additional costs
 * @param purchase_id Purchase ID
 * @returns Promise with array of PurchaseAdditionalCost
 */
export async function getPurchaseAdditionalCosts(purchase_id: number): Promise<PurchaseAdditionalCost[]> {
  return await invoke<PurchaseAdditionalCost[]>("get_purchase_additional_costs", { purchaseId: purchase_id });
}

/**
 * Create a purchase additional cost
 * @param purchase_id Purchase ID
 * @param name Cost name
 * @param amount Cost amount
 * @returns Promise with PurchaseAdditionalCost
 */
export async function createPurchaseAdditionalCost(
  purchase_id: number,
  name: string,
  amount: number
): Promise<PurchaseAdditionalCost> {
  return await invoke<PurchaseAdditionalCost>("create_purchase_additional_cost", {
    purchaseId: purchase_id,
    name,
    amount,
  });
}

/**
 * Update a purchase additional cost
 * @param id Additional cost ID
 * @param name Cost name
 * @param amount Cost amount
 * @returns Promise with PurchaseAdditionalCost
 */
export async function updatePurchaseAdditionalCost(
  id: number,
  name: string,
  amount: number
): Promise<PurchaseAdditionalCost> {
  return await invoke<PurchaseAdditionalCost>("update_purchase_additional_cost", {
    id,
    name,
    amount,
  });
}

/**
 * Delete a purchase additional cost
 * @param id Additional cost ID
 * @returns Promise with success message
 */
export async function deletePurchaseAdditionalCost(id: number): Promise<string> {
  return await invoke<string>("delete_purchase_additional_cost", { id });
}
