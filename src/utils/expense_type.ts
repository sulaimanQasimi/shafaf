import { invoke } from "@tauri-apps/api/core";

export interface ExpenseType {
    id: number;
    name: string;
    created_at: string;
    updated_at: string;
}

/**
 * Initialize the expense_types table schema
 * @returns Promise with success message
 */
export async function initExpenseTypesTable(): Promise<string> {
    return await invoke<string>("init_expense_types_table");
}

/**
 * Create a new expense type
 * @param name Expense type name
 * @returns Promise with ExpenseType
 */
export async function createExpenseType(name: string): Promise<ExpenseType> {
    return await invoke<ExpenseType>("create_expense_type", {
        name,
    });
}

/**
 * Get all expense types
 * @returns Promise with array of ExpenseType
 */
export async function getExpenseTypes(): Promise<ExpenseType[]> {
    return await invoke<ExpenseType[]>("get_expense_types");
}

/**
 * Update an expense type
 * @param id Expense type ID
 * @param name Expense type name
 * @returns Promise with ExpenseType
 */
export async function updateExpenseType(id: number, name: string): Promise<ExpenseType> {
    return await invoke<ExpenseType>("update_expense_type", {
        id,
        name,
    });
}

/**
 * Delete an expense type
 * @param id Expense type ID
 * @returns Promise with success message
 */
export async function deleteExpenseType(id: number): Promise<string> {
    return await invoke<string>("delete_expense_type", { id });
}
