import { invoke } from "@tauri-apps/api/core";

export interface Expense {
    id: number;
    expense_type_id: number;
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
 * @param expense_type_id Expense type ID
 * @param amount Expense amount
 * @param currency Currency name
 * @param rate Exchange rate
 * @param total Total amount
 * @param date Expense date
 * @returns Promise with Expense
 */
export async function createExpense(
    expense_type_id: number,
    amount: number,
    currency: string,
    rate: number,
    total: number,
    date: string
): Promise<Expense> {
    return await invoke<Expense>("create_expense", {
        expense_type_id,
        amount,
        currency,
        rate,
        total,
        date,
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
 * Get all expenses with pagination
 * @param page Page number
 * @param perPage Items per page
 * @param search Search query
 * @param sortBy Sort column
 * @param sortOrder Sort order
 * @returns Promise with paginated expenses
 */
export async function getExpenses(
    page: number = 1,
    perPage: number = 10,
    search: string = "",
    sortBy: string = "date",
    sortOrder: "asc" | "desc" = "desc"
): Promise<PaginatedResponse<Expense>> {
    return await invoke<PaginatedResponse<Expense>>("get_expenses", {
        page,
        perPage,
        search: search || null,
        sortBy: sortBy || null,
        sortOrder: sortOrder || null,
    });
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
 * @param expense_type_id Expense type ID
 * @param amount Expense amount
 * @param currency Currency name
 * @param rate Exchange rate
 * @param total Total amount
 * @param date Expense date
 * @returns Promise with Expense
 */
export async function updateExpense(
    id: number,
    expense_type_id: number,
    amount: number,
    currency: string,
    rate: number,
    total: number,
    date: string
): Promise<Expense> {
    return await invoke<Expense>("update_expense", {
        id,
        expense_type_id,
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
