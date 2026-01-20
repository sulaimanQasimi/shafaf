import { invoke } from "@tauri-apps/api/core";

export interface JournalEntry {
    id: number;
    entry_number: string;
    entry_date: string;
    description: string | null;
    reference_type: string | null; // sale, purchase, manual, etc.
    reference_id: number | null;
    created_at: string;
    updated_at: string;
}

export interface JournalEntryLine {
    id: number;
    journal_entry_id: number;
    account_id: number;
    currency_id: number;
    debit_amount: number;
    credit_amount: number;
    exchange_rate: number;
    base_amount: number;
    description: string | null;
    created_at: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
}

export interface JournalEntryLineInput {
    account_id: number;
    currency_id: number;
    debit_amount: number;
    credit_amount: number;
    exchange_rate: number;
    description?: string | null;
}

/**
 * Initialize the journal entries table schema
 * @returns Promise with success message
 */
export async function initJournalEntriesTable(): Promise<string> {
    return await invoke<string>("init_journal_entries_table");
}

/**
 * Initialize the journal entry lines table schema
 * @returns Promise with success message
 */
export async function initJournalEntryLinesTable(): Promise<string> {
    return await invoke<string>("init_journal_entry_lines_table");
}

/**
 * Create a journal entry with lines
 * @param entry_date Entry date
 * @param description Optional description
 * @param reference_type Reference type (sale, purchase, manual, etc.)
 * @param reference_id Reference ID
 * @param lines Array of journal entry lines
 * @returns Promise with JournalEntry
 */
export async function createJournalEntry(
    entry_date: string,
    description: string | null,
    reference_type: string | null,
    reference_id: number | null,
    lines: JournalEntryLineInput[]
): Promise<JournalEntry> {
    // Convert lines to tuple format expected by Rust
    const linesTuple: [number, number, number, number, number, string | null][] = lines.map(line => [
        line.account_id,
        line.currency_id,
        line.debit_amount,
        line.credit_amount,
        line.exchange_rate,
        line.description || null,
    ]);

    return await invoke<JournalEntry>("create_journal_entry", {
        entryDate: entry_date,
        description: description || null,
        referenceType: reference_type || null,
        referenceId: reference_id || null,
        lines: linesTuple,
    });
}

/**
 * Get journal entries with pagination
 * @param page Page number
 * @param per_page Items per page
 * @returns Promise with paginated journal entries
 */
export async function getJournalEntries(
    page: number = 1,
    per_page: number = 10
): Promise<PaginatedResponse<JournalEntry>> {
    return await invoke<PaginatedResponse<JournalEntry>>("get_journal_entries", {
        page,
        perPage: per_page,
    });
}

/**
 * Get a single journal entry with its lines
 * @param id Journal entry ID
 * @returns Promise with JournalEntry and JournalEntryLine[]
 */
export async function getJournalEntry(id: number): Promise<[JournalEntry, JournalEntryLine[]]> {
    return await invoke<[JournalEntry, JournalEntryLine[]]>("get_journal_entry", { id });
}

/**
 * Validate that a journal entry is balanced (debits = credits)
 * @param lines Journal entry lines
 * @returns true if balanced, false otherwise
 */
export function validateJournalEntry(lines: JournalEntryLineInput[]): boolean {
    const totalDebits = lines.reduce((sum, line) => sum + line.debit_amount, 0);
    const totalCredits = lines.reduce((sum, line) => sum + line.credit_amount, 0);
    return Math.abs(totalDebits - totalCredits) < 0.01; // Allow small floating point differences
}
