import { invoke } from "@tauri-apps/api/core";

export interface Sale {
    id: number;
    customer_id: number;
    date: string;
    notes?: string | null;
    total_amount: number;
    paid_amount: number;
    remaining_amount?: number; // Calculated on client side if needed, but useful in UI
    created_at: string;
    updated_at: string;
}

export interface SaleItem {
    id: number;
    sale_id: number;
    product_id: number;
    unit_id: number;
    per_price: number;
    amount: number;
    total: number;
    created_at: string;
}

export interface SaleWithItems {
    sale: Sale;
    items: SaleItem[];
}

export interface SalePayment {
    id: number;
    sale_id: number;
    amount: number;
    date: string;
    created_at: string;
}

export interface SaleItemInput {
    product_id: number;
    unit_id: number;
    per_price: number;
    amount: number;
}

/**
 * Initialize the sales table schema
 * @returns Promise with success message
 */
export async function initSalesTable(): Promise<string> {
    return await invoke<string>("init_sales_table");
}

/**
 * Create a new sale with items
 * @param customer_id Customer ID
 * @param date Sale date
 * @param notes Optional notes
 * @param paid_amount Amount paid
 * @param items Array of sale items
 * @returns Promise with Sale
 */
export async function createSale(
    customer_id: number,
    date: string,
    notes: string | null,
    paid_amount: number,
    items: SaleItemInput[]
): Promise<Sale> {
    // Convert items to tuple format expected by Rust: (product_id, unit_id, per_price, amount)
    const itemsTuple: [number, number, number, number][] = items.map(item => [
        item.product_id,
        item.unit_id,
        item.per_price,
        item.amount,
    ]);

    return await invoke<Sale>("create_sale", {
        customerId: customer_id,
        date,
        notes: notes || null,
        paidAmount: paid_amount,
        items: itemsTuple,
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
 * Get all sales with pagination
 * @param page Page number
 * @param perPage Items per page
 * @param search Search query
 * @param sortBy Sort column
 * @param sortOrder Sort order
 * @returns Promise with paginated sales
 */
export async function getSales(
    page: number = 1,
    perPage: number = 10,
    search: string = "",
    sortBy: string = "date",
    sortOrder: "asc" | "desc" = "desc"
): Promise<PaginatedResponse<Sale>> {
    return await invoke<PaginatedResponse<Sale>>("get_sales", {
        page,
        perPage,
        search: search || null,
        sortBy: sortBy || null,
        sortOrder: sortOrder || null,
    });
}

/**
 * Get a single sale with its items
 * @param id Sale ID
 * @returns Promise with Sale and SaleItems
 */
export async function getSale(id: number): Promise<SaleWithItems> {
    const result = await invoke<[Sale, SaleItem[]]>("get_sale", { id });
    return {
        sale: result[0],
        items: result[1],
    };
}

/**
 * Update a sale
 * @param id Sale ID
 * @param customer_id Customer ID
 * @param date Sale date
 * @param notes Optional notes
 * @param paid_amount Amount paid
 * @param items Array of sale items
 * @returns Promise with Sale
 */
export async function updateSale(
    id: number,
    customer_id: number,
    date: string,
    notes: string | null,
    paid_amount: number,
    items: SaleItemInput[]
): Promise<Sale> {
    // Convert items to tuple format expected by Rust: (product_id, unit_id, per_price, amount)
    const itemsTuple: [number, number, number, number][] = items.map(item => [
        item.product_id,
        item.unit_id,
        item.per_price,
        item.amount,
    ]);

    return await invoke<Sale>("update_sale", {
        id,
        customerId: customer_id,
        date,
        notes: notes || null,
        paidAmount: paid_amount,
        items: itemsTuple,
    });
}

/**
 * Delete a sale
 * @param id Sale ID
 * @returns Promise with success message
 */
export async function deleteSale(id: number): Promise<string> {
    return await invoke<string>("delete_sale", { id });
}

/**
 * Create a sale item
 * @param sale_id Sale ID
 * @param product_id Product ID
 * @param unit_id Unit ID
 * @param per_price Price per unit
 * @param amount Quantity
 * @returns Promise with SaleItem
 */
export async function createSaleItem(
    sale_id: number,
    product_id: number,
    unit_id: number,
    per_price: number,
    amount: number
): Promise<SaleItem> {
    return await invoke<SaleItem>("create_sale_item", {
        saleId: sale_id,
        productId: product_id,
        unitId: unit_id,
        perPrice: per_price,
        amount,
    });
}

/**
 * Get sale items for a sale
 * @param sale_id Sale ID
 * @returns Promise with array of SaleItem
 */
export async function getSaleItems(sale_id: number): Promise<SaleItem[]> {
    return await invoke<SaleItem[]>("get_sale_items", { saleId: sale_id });
}

/**
 * Update a sale item
 * @param id SaleItem ID
 * @param product_id Product ID
 * @param unit_id Unit ID
 * @param per_price Price per unit
 * @param amount Quantity
 * @returns Promise with SaleItem
 */
export async function updateSaleItem(
    id: number,
    product_id: number,
    unit_id: number,
    per_price: number,
    amount: number
): Promise<SaleItem> {
    return await invoke<SaleItem>("update_sale_item", {
        id,
        productId: product_id,
        unitId: unit_id,
        perPrice: per_price,
        amount,
    });
}

/**
 * Delete a sale item
 * @param id SaleItem ID
 * @returns Promise with success message
 */
export async function deleteSaleItem(id: number): Promise<string> {
    return await invoke<string>("delete_sale_item", { id });
}

/**
 * Create a sale payment
 * @param sale_id Sale ID
 * @param amount Payment Amount
 * @param date Payment Date
 * @returns Promise with SalePayment
 */
export async function createSalePayment(
    sale_id: number,
    amount: number,
    date: string
): Promise<SalePayment> {
    return await invoke<SalePayment>("create_sale_payment", {
        saleId: sale_id,
        amount,
        date,
    });
}

/**
 * Get payments for a sale
 * @param sale_id Sale ID
 * @returns Promise with array of SalePayment
 */
export async function getSalePayments(sale_id: number): Promise<SalePayment[]> {
    return await invoke<SalePayment[]>("get_sale_payments", { saleId: sale_id });
}

/**
 * Delete a sale payment
 * @param id Payment ID
 * @returns Promise with success message
 */
export async function deleteSalePayment(id: number): Promise<string> {
    return await invoke<string>("delete_sale_payment", { id });
}
