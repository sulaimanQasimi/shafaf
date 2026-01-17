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

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

/**
 * Get all customers with pagination
 * @param page Page number
 * @param perPage Items per page
 * @param search Search query
 * @param sortBy Sort column
 * @param sortOrder Sort order
 * @returns Promise with paginated customers
 */
export async function getCustomers(
  page: number = 1,
  perPage: number = 10,
  search: string = "",
  sortBy: string = "created_at",
  sortOrder: "asc" | "desc" = "desc"
): Promise<PaginatedResponse<Customer>> {
  return await invoke<PaginatedResponse<Customer>>("get_customers", {
    page,
    perPage,
    search: search || null,
    sortBy: sortBy || null,
    sortOrder: sortOrder || null,
  });
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
