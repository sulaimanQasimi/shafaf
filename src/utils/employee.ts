import { invoke } from "@tauri-apps/api/core";

export interface Employee {
  id: number;
  full_name: string;
  phone: string;
  email?: string | null;
  address: string;
  position?: string | null;
  hire_date?: string | null;
  base_salary?: number | null;
  photo_path?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Initialize the employees table schema
 * @returns Promise with success message
 */
export async function initEmployeesTable(): Promise<string> {
  return await invoke<string>("init_employees_table");
}

/**
 * Create a new employee
 * @param full_name Full name of the employee
 * @param phone Phone number
 * @param address Address
 * @param email Optional email
 * @param position Optional position/job title
 * @param hire_date Optional hire date
 * @param base_salary Optional base salary
 * @param photo_path Optional photo path
 * @param notes Optional notes
 * @returns Promise with Employee
 */
export async function createEmployee(
  full_name: string,
  phone: string,
  address: string,
  email?: string | null,
  position?: string | null,
  hire_date?: string | null,
  base_salary?: number | null,
  photo_path?: string | null,
  notes?: string | null
): Promise<Employee> {
  return await invoke<Employee>("create_employee", {
    fullName: full_name,
    phone,
    email: email || null,
    address,
    position: position || null,
    hireDate: hire_date || null,
    baseSalary: base_salary || null,
    photoPath: photo_path || null,
    notes: notes || null,
  });
}

/**
 * Get all employees
 * @returns Promise with array of Employee
 */
export async function getEmployees(): Promise<Employee[]> {
  return await invoke<Employee[]>("get_employees");
}

/**
 * Get employee by ID
 * @param id Employee ID
 * @returns Promise with Employee
 */
export async function getEmployee(id: number): Promise<Employee> {
  return await invoke<Employee>("get_employee", { id });
}

/**
 * Update an employee
 * @param id Employee ID
 * @param full_name Full name of the employee
 * @param phone Phone number
 * @param address Address
 * @param email Optional email
 * @param position Optional position/job title
 * @param hire_date Optional hire date
 * @param base_salary Optional base salary
 * @param photo_path Optional photo path
 * @param notes Optional notes
 * @returns Promise with Employee
 */
export async function updateEmployee(
  id: number,
  full_name: string,
  phone: string,
  address: string,
  email?: string | null,
  position?: string | null,
  hire_date?: string | null,
  base_salary?: number | null,
  photo_path?: string | null,
  notes?: string | null
): Promise<Employee> {
  return await invoke<Employee>("update_employee", {
    id,
    fullName: full_name,
    phone,
    email: email || null,
    address,
    position: position || null,
    hireDate: hire_date || null,
    baseSalary: base_salary || null,
    photoPath: photo_path || null,
    notes: notes || null,
  });
}

/**
 * Delete an employee
 * @param id Employee ID
 * @returns Promise with success message
 */
export async function deleteEmployee(id: number): Promise<string> {
  return await invoke<string>("delete_employee", { id });
}
