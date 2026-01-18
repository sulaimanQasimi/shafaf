import { invoke } from "@tauri-apps/api/core";

export interface Account {
    id: number;
    name: string;
    currency_id: number | null;
    initial_balance: number;
    current_balance: number;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface AccountTransaction {
    id: number;
    account_id: number;
    transaction_type: "deposit" | "withdraw";
    amount: number;
    currency: string;
    rate: number;
    total: number;
    transaction_date: string;
    is_full: boolean;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Initialize the accounts table schema
 * @returns Promise with success message
 */
export async function initAccountsTable(): Promise<string> {
    return await invoke<string>("init_accounts_table");
}

/**
 * Initialize the account transactions table schema
 * @returns Promise with success message
 */
export async function initAccountTransactionsTable(): Promise<string> {
    return await invoke<string>("init_account_transactions_table");
}

/**
 * Create a new account
 * @param name Account name
 * @param currency_id Currency ID (optional)
 * @param initial_balance Initial balance
 * @param notes Optional notes
 * @returns Promise with Account
 */
export async function createAccount(
    name: string,
    currency_id: number | null,
    initial_balance: number,
    notes: string | null
): Promise<Account> {
    return await invoke<Account>("create_account", {
        name,
        currencyId: currency_id,
        initialBalance: initial_balance,
        notes: notes || null,
    });
}

/**
 * Get all accounts
 * @returns Promise with array of Account
 */
export async function getAccounts(): Promise<Account[]> {
    return await invoke<Account[]>("get_accounts");
}

/**
 * Get a single account
 * @param id Account ID
 * @returns Promise with Account
 */
export async function getAccount(id: number): Promise<Account> {
    return await invoke<Account>("get_account", { id });
}

/**
 * Update an account
 * @param id Account ID
 * @param name Account name
 * @param currency_id Currency ID (optional)
 * @param initial_balance Initial balance
 * @param notes Optional notes
 * @returns Promise with Account
 */
export async function updateAccount(
    id: number,
    name: string,
    currency_id: number | null,
    initial_balance: number,
    notes: string | null
): Promise<Account> {
    return await invoke<Account>("update_account", {
        id,
        name,
        currencyId: currency_id,
        initialBalance: initial_balance,
        notes: notes || null,
    });
}

/**
 * Delete an account
 * @param id Account ID
 * @returns Promise with success message
 */
export async function deleteAccount(id: number): Promise<string> {
    return await invoke<string>("delete_account", { id });
}

/**
 * Deposit to account
 * @param account_id Account ID
 * @param amount Deposit amount (ignored if is_full is true)
 * @param currency Currency name
 * @param rate Exchange rate
 * @param transaction_date Transaction date
 * @param is_full Whether to deposit full balance
 * @param notes Optional notes
 * @returns Promise with AccountTransaction
 */
export async function depositAccount(
    account_id: number,
    amount: number,
    currency: string,
    rate: number,
    transaction_date: string,
    is_full: boolean,
    notes: string | null
): Promise<AccountTransaction> {
    return await invoke<AccountTransaction>("deposit_account", {
        accountId: account_id,
        amount,
        currency,
        rate,
        transactionDate: transaction_date,
        isFull: is_full,
        notes: notes || null,
    });
}

/**
 * Withdraw from account
 * @param account_id Account ID
 * @param amount Withdrawal amount (ignored if is_full is true)
 * @param currency Currency name
 * @param rate Exchange rate
 * @param transaction_date Transaction date
 * @param is_full Whether to withdraw full balance
 * @param notes Optional notes
 * @returns Promise with AccountTransaction
 */
export async function withdrawAccount(
    account_id: number,
    amount: number,
    currency: string,
    rate: number,
    transaction_date: string,
    is_full: boolean,
    notes: string | null
): Promise<AccountTransaction> {
    return await invoke<AccountTransaction>("withdraw_account", {
        accountId: account_id,
        amount,
        currency,
        rate,
        transactionDate: transaction_date,
        isFull: is_full,
        notes: notes || null,
    });
}

/**
 * Get account transactions
 * @param account_id Account ID
 * @returns Promise with array of AccountTransaction
 */
export async function getAccountTransactions(account_id: number): Promise<AccountTransaction[]> {
    return await invoke<AccountTransaction[]>("get_account_transactions", {
        accountId: account_id,
    });
}

/**
 * Get account balance
 * @param account_id Account ID
 * @returns Promise with balance number
 */
export async function getAccountBalance(account_id: number): Promise<number> {
    return await invoke<number>("get_account_balance", {
        accountId: account_id,
    });
}
