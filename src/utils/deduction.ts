import { invoke } from "@tauri-apps/api/core";

export interface Deduction {
    id: number;
    employee_id: number;
    year: number;
    month: string; // Dari month name like حمل, ثور
    currency: string;
    rate: number;
    amount: number;
    created_at: string;
    updated_at: string;
}

/**
 * Initialize the deductions table schema
 * @returns Promise with success message
 */
export async function initDeductionsTable(): Promise<string> {
    return await invoke<string>("init_deductions_table");
}

/**
 * Create a new deduction
 * @param employee_id Employee ID
 * @param year Persian year
 * @param month Dari month name (e.g., حمل, ثور)
 * @param currency Currency name
 * @param rate Exchange rate
 * @param amount Deduction amount
 * @returns Promise with Deduction
 */
export async function createDeduction(
    employee_id: number,
    year: number,
    month: string,
    currency: string,
    rate: number,
    amount: number
): Promise<Deduction> {
    return await invoke<Deduction>("create_deduction", {
        employeeId: employee_id,
        year,
        month,
        currency,
        rate,
        amount,
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
 * Get all deductions with pagination
 * @param page Page number
 * @param perPage Items per page
 * @param search Search query
 * @param sortBy Sort column
 * @param sortOrder Sort order
 * @returns Promise with paginated deductions
 */
export async function getDeductions(
    page: number = 1,
    perPage: number = 10,
    search: string = "",
    sortBy: string = "year",
    sortOrder: "asc" | "desc" = "desc"
): Promise<PaginatedResponse<Deduction>> {
    return await invoke<PaginatedResponse<Deduction>>("get_deductions", {
        page,
        perPage,
        search: search || null,
        sortBy: sortBy || null,
        sortOrder: sortOrder || null,
    });
}

/**
 * Get deductions by employee ID
 * @param employee_id Employee ID
 * @returns Promise with array of Deduction
 */
export async function getDeductionsByEmployee(employee_id: number): Promise<Deduction[]> {
    return await invoke<Deduction[]>("get_deductions_by_employee", {
        employeeId: employee_id,
    });
}

/**
 * Get deduction by ID
 * @param id Deduction ID
 * @returns Promise with Deduction
 */
export async function getDeduction(id: number): Promise<Deduction> {
    return await invoke<Deduction>("get_deduction", { id });
}

/**
 * Get deductions by employee ID, year, and month
 * @param employee_id Employee ID
 * @param year Persian year
 * @param month Dari month name (e.g., حمل, ثور)
 * @returns Promise with array of Deduction
 */
export async function getDeductionsByEmployeeYearMonth(
    employee_id: number,
    year: number,
    month: string
): Promise<Deduction[]> {
    return await invoke<Deduction[]>("get_deductions_by_employee_year_month", {
        employeeId: employee_id,
        year,
        month,
    });
}

/**
 * Update a deduction
 * @param id Deduction ID
 * @param employee_id Employee ID
 * @param year Persian year
 * @param month Dari month name (e.g., حمل, ثور)
 * @param currency Currency name
 * @param rate Exchange rate
 * @param amount Deduction amount
 * @returns Promise with Deduction
 */
export async function updateDeduction(
    id: number,
    employee_id: number,
    year: number,
    month: string,
    currency: string,
    rate: number,
    amount: number
): Promise<Deduction> {
    return await invoke<Deduction>("update_deduction", {
        id,
        employeeId: employee_id,
        year,
        month,
        currency,
        rate,
        amount,
    });
}

/**
 * Delete a deduction
 * @param id Deduction ID
 * @returns Promise with success message
 */
export async function deleteDeduction(id: number): Promise<string> {
    return await invoke<string>("delete_deduction", { id });
}
