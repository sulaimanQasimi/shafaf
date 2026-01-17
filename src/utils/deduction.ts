import { invoke } from "@tauri-apps/api/core";

export interface Deduction {
    id: number;
    employee_id: number;
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
 * @param currency Currency name
 * @param rate Exchange rate
 * @param amount Deduction amount
 * @returns Promise with Deduction
 */
export async function createDeduction(
    employee_id: number,
    currency: string,
    rate: number,
    amount: number
): Promise<Deduction> {
    return await invoke<Deduction>("create_deduction", {
        employeeId: employee_id,
        currency,
        rate,
        amount,
    });
}

/**
 * Get all deductions
 * @returns Promise with array of Deduction
 */
export async function getDeductions(): Promise<Deduction[]> {
    return await invoke<Deduction[]>("get_deductions");
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
 * Update a deduction
 * @param id Deduction ID
 * @param employee_id Employee ID
 * @param currency Currency name
 * @param rate Exchange rate
 * @param amount Deduction amount
 * @returns Promise with Deduction
 */
export async function updateDeduction(
    id: number,
    employee_id: number,
    currency: string,
    rate: number,
    amount: number
): Promise<Deduction> {
    return await invoke<Deduction>("update_deduction", {
        id,
        employeeId: employee_id,
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
