import { invoke } from "@tauri-apps/api/core";

export interface Supplier {
  id: number;
  full_name: string;
  phone: string;
  address: string;
  email?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Initialize the suppliers table schema
 * @returns Promise with success message
 */
export async function initSuppliersTable(): Promise<string> {
  return await invoke<string>("init_suppliers_table");
}

/**
 * Create a new supplier
 * @param full_name Full name of the supplier
 * @param phone Phone number
 * @param address Address
 * @param email Optional email
 * @param notes Optional notes
 * @returns Promise with Supplier
 */
export async function createSupplier(
  full_name: string,
  phone: string,
  address: string,
  email?: string | null,
  notes?: string | null
): Promise<Supplier> {
  return await invoke<Supplier>("create_supplier", {
    fullName: full_name,
    phone,
    address,
    email: email || null,
    notes: notes || null,
  });
}

/**
 * Get all suppliers
 * @returns Promise with array of Supplier
 */
export async function getSuppliers(): Promise<Supplier[]> {
  return await invoke<Supplier[]>("get_suppliers");
}

/**
 * Update a supplier
 * @param id Supplier ID
 * @param full_name Full name of the supplier
 * @param phone Phone number
 * @param address Address
 * @param email Optional email
 * @param notes Optional notes
 * @returns Promise with Supplier
 */
export async function updateSupplier(
  id: number,
  full_name: string,
  phone: string,
  address: string,
  email?: string | null,
  notes?: string | null
): Promise<Supplier> {
  return await invoke<Supplier>("update_supplier", {
    id,
    fullName: full_name,
    phone,
    address,
    email: email || null,
    notes: notes || null,
  });
}

/**
 * Delete a supplier
 * @param id Supplier ID
 * @returns Promise with success message
 */
export async function deleteSupplier(id: number): Promise<string> {
  return await invoke<string>("delete_supplier", { id });
}
