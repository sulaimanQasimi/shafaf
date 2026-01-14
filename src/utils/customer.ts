import { invoke } from "@tauri-apps/api/core";

export interface Customer {
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
 * Initialize the customers table schema
 * @returns Promise with success message
 */
export async function initCustomersTable(): Promise<string> {
  return await invoke<string>("init_customers_table");
}

/**
 * Create a new customer
 * @param full_name Full name of the customer
 * @param phone Phone number
 * @param address Address
 * @param email Optional email
 * @param notes Optional notes
 * @returns Promise with Customer
 */
export async function createCustomer(
  full_name: string,
  phone: string,
  address: string,
  email?: string | null,
  notes?: string | null
): Promise<Customer> {
  return await invoke<Customer>("create_customer", {
    fullName: full_name,
    phone,
    address,
    email: email || null,
    notes: notes || null,
  });
}

/**
 * Get all customers
 * @returns Promise with array of Customer
 */
export async function getCustomers(): Promise<Customer[]> {
  return await invoke<Customer[]>("get_customers");
}

/**
 * Update a customer
 * @param id Customer ID
 * @param full_name Full name of the customer
 * @param phone Phone number
 * @param address Address
 * @param email Optional email
 * @param notes Optional notes
 * @returns Promise with Customer
 */
export async function updateCustomer(
  id: number,
  full_name: string,
  phone: string,
  address: string,
  email?: string | null,
  notes?: string | null
): Promise<Customer> {
  return await invoke<Customer>("update_customer", {
    id,
    fullName: full_name,
    phone,
    address,
    email: email || null,
    notes: notes || null,
  });
}

/**
 * Delete a customer
 * @param id Customer ID
 * @returns Promise with success message
 */
export async function deleteCustomer(id: number): Promise<string> {
  return await invoke<string>("delete_customer", { id });
}
