import { invoke } from "@tauri-apps/api/core";

export interface Salary {
  id: number;
  employee_id: number;
  year: number;
  month: string; // Dari month name like حمل, ثور
  amount: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Initialize the salaries table schema
 * @returns Promise with success message
 */
export async function initSalariesTable(): Promise<string> {
  return await invoke<string>("init_salaries_table");
}

/**
 * Create a new salary
 * @param employee_id Employee ID
 * @param year Persian year
 * @param month Dari month name (e.g., حمل, ثور)
 * @param amount Salary amount
 * @param notes Optional notes
 * @returns Promise with Salary
 */
export async function createSalary(
  employee_id: number,
  year: number,
  month: string,
  amount: number,
  notes?: string | null
): Promise<Salary> {
  return await invoke<Salary>("create_salary", {
    employeeId: employee_id,
    year,
    month,
    amount,
    notes: notes || null,
  });
}

/**
 * Get all salaries
 * @returns Promise with array of Salary
 */
export async function getSalaries(): Promise<Salary[]> {
  return await invoke<Salary[]>("get_salaries");
}

/**
 * Get salaries by employee ID
 * @param employee_id Employee ID
 * @returns Promise with array of Salary
 */
export async function getSalariesByEmployee(employee_id: number): Promise<Salary[]> {
  return await invoke<Salary[]>("get_salaries_by_employee", {
    employeeId: employee_id,
  });
}

/**
 * Get salary by ID
 * @param id Salary ID
 * @returns Promise with Salary
 */
export async function getSalary(id: number): Promise<Salary> {
  return await invoke<Salary>("get_salary", { id });
}

/**
 * Update a salary
 * @param id Salary ID
 * @param employee_id Employee ID
 * @param year Persian year
 * @param month Dari month name (e.g., حمل, ثور)
 * @param amount Salary amount
 * @param notes Optional notes
 * @returns Promise with Salary
 */
export async function updateSalary(
  id: number,
  employee_id: number,
  year: number,
  month: string,
  amount: number,
  notes?: string | null
): Promise<Salary> {
  return await invoke<Salary>("update_salary", {
    id,
    employeeId: employee_id,
    year,
    month,
    amount,
    notes: notes || null,
  });
}

/**
 * Delete a salary
 * @param id Salary ID
 * @returns Promise with success message
 */
export async function deleteSalary(id: number): Promise<string> {
  return await invoke<string>("delete_salary", { id });
}
