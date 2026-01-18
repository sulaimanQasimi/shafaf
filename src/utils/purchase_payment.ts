import { invoke } from "@tauri-apps/api/core";

export interface PurchasePayment {
    id: number;
    purchase_id: number;
    amount: number;
    currency: string;
    rate: number;
    total: number;
    date: string;
    notes: string | null;
    created_at: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
}

/**
 * Initialize the purchase payments table schema
 * @returns Promise with success message
 */
export async function initPurchasePaymentsTable(): Promise<string> {
    return await invoke<string>("init_purchase_payments_table");
}

/**
 * Create a new purchase payment
 * @param purchase_id Purchase ID
 * @param amount Payment amount
 * @param currency Currency name
 * @param rate Exchange rate
 * @param date Payment date
 * @param notes Optional notes
 * @returns Promise with PurchasePayment
 */
export async function createPurchasePayment(
    purchase_id: number,
    amount: number,
    currency: string,
    rate: number,
    date: string,
    notes: string | null
): Promise<PurchasePayment> {
    return await invoke<PurchasePayment>("create_purchase_payment", {
        purchaseId: purchase_id,
        amount,
        currency,
        rate,
        date,
        notes: notes || null,
    });
}

/**
 * Get all purchase payments with pagination
 * @param page Page number
 * @param perPage Items per page
 * @param search Search query
 * @param sortBy Sort column
 * @param sortOrder Sort order
 * @returns Promise with paginated purchase payments
 */
export async function getPurchasePayments(
    page: number = 1,
    perPage: number = 10,
    search: string = "",
    sortBy: string = "date",
    sortOrder: "asc" | "desc" = "desc"
): Promise<PaginatedResponse<PurchasePayment>> {
    return await invoke<PaginatedResponse<PurchasePayment>>("get_purchase_payments", {
        page,
        perPage,
        search: search || null,
        sortBy: sortBy || null,
        sortOrder: sortOrder || null,
    });
}

/**
 * Get payments for a specific purchase
 * @param purchase_id Purchase ID
 * @returns Promise with array of PurchasePayment
 */
export async function getPurchasePaymentsByPurchase(purchase_id: number): Promise<PurchasePayment[]> {
    return await invoke<PurchasePayment[]>("get_purchase_payments_by_purchase", {
        purchaseId: purchase_id,
    });
}

/**
 * Update a purchase payment
 * @param id Payment ID
 * @param amount Payment amount
 * @param currency Currency name
 * @param rate Exchange rate
 * @param date Payment date
 * @param notes Optional notes
 * @returns Promise with PurchasePayment
 */
export async function updatePurchasePayment(
    id: number,
    amount: number,
    currency: string,
    rate: number,
    date: string,
    notes: string | null
): Promise<PurchasePayment> {
    return await invoke<PurchasePayment>("update_purchase_payment", {
        id,
        amount,
        currency,
        rate,
        date,
        notes: notes || null,
    });
}

/**
 * Delete a purchase payment
 * @param id Payment ID
 * @returns Promise with success message
 */
export async function deletePurchasePayment(id: number): Promise<string> {
    return await invoke<string>("delete_purchase_payment", { id });
}
