import { invoke } from "@tauri-apps/api/core";

export interface Expense {
    id: number;
    name: string;
    amount: number;
    currency: string;
    rate: number;
    total: number;
    date: string;
    created_at: string;
    updated_at: string;
}

/**
 * Initialize the expenses table schema
 * @returns Promise with success message
 */
export async function initExpensesTable(): Promise<string> {
    return await invoke<string>("init_expenses_table");
}

/**
 * Create a new expense
 * @param name Expense name
 * @param amount Expense amount
 * @param currency Currency name
 * @param rate Exchange rate
 * @param total Total amount
 * @param date Expense date
 * @returns Promise with Expense
 */
export async function createExpense(
    name: string,
    amount: number,
    currency: string,
    rate: number,
    total: number,
    date: string
): Promise<Expense> {
    return await invoke<Expense>("create_expense", {
        name,
        amount,
        currency,
        rate,
        total,
        date,
    });
}

/**
 * Get all expenses
 * @returns Promise with array of Expense
 */
export async function getExpenses(): Promise<Expense[]> {
    return await invoke<Expense[]>("get_expenses");
}

/**
 * Get a single expense
 * @param id Expense ID
 * @returns Promise with Expense
 */
export async function getExpense(id: number): Promise<Expense> {
    return await invoke<Expense>("get_expense", { id });
}

/**
 * Update an expense
 * @param id Expense ID
 * @param name Expense name
 * @param amount Expense amount
 * @param currency Currency name
 * @param rate Exchange rate
 * @param total Total amount
 * @param date Expense date
 * @returns Promise with Expense
 */
export async function updateExpense(
    id: number,
    name: string,
    amount: number,
    currency: string,
    rate: number,
    total: number,
    date: string
): Promise<Expense> {
    return await invoke<Expense>("update_expense", {
        id,
        name,
        amount,
        currency,
        rate,
        total,
        date,
    });
}

/**
 * Delete an expense
 * @param id Expense ID
 * @returns Promise with success message
 */
export async function deleteExpense(id: number): Promise<string> {
    return await invoke<string>("delete_expense", { id });
}
