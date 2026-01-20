import { invoke } from "@tauri-apps/api/core";

export interface Account {
    id: number;
    name: string;
    currency_id: number | null;
    coa_category_id: number | null;
    account_code: string | null;
    account_type: string | null;
    initial_balance: number;
    current_balance: number;
    is_active: boolean;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface AccountCurrencyBalance {
    id: number;
    account_id: number;
    currency_id: number;
    balance: number;
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
 * @param coa_category_id COA category ID (optional)
 * @param account_code Account code (optional)
 * @param account_type Account type (optional)
 * @param initial_balance Initial balance
 * @param notes Optional notes
 * @returns Promise with Account
 */
export async function createAccount(
    name: string,
    currency_id: number | null,
    coa_category_id: number | null,
    account_code: string | null,
    account_type: string | null,
    initial_balance: number,
    notes: string | null
): Promise<Account> {
    return await invoke<Account>("create_account", {
        name,
        currencyId: currency_id,
        coaCategoryId: coa_category_id,
        accountCode: account_code,
        accountType: account_type,
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
 * @param coa_category_id COA category ID (optional)
 * @param account_code Account code (optional)
 * @param account_type Account type (optional)
 * @param initial_balance Initial balance
 * @param is_active Whether account is active
 * @param notes Optional notes
 * @returns Promise with Account
 */
export async function updateAccount(
    id: number,
    name: string,
    currency_id: number | null,
    coa_category_id: number | null,
    account_code: string | null,
    account_type: string | null,
    initial_balance: number,
    is_active: boolean,
    notes: string | null
): Promise<Account> {
    return await invoke<Account>("update_account", {
        id,
        name,
        currencyId: currency_id,
        coaCategoryId: coa_category_id,
        accountCode: account_code,
        accountType: account_type,
        initialBalance: initial_balance,
        isActive: is_active,
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

/**
 * Get account balance by currency
 * @param account_id Account ID
 * @param currency_id Currency ID
 * @returns Promise with balance number
 */
export async function getAccountBalanceByCurrency(
    account_id: number,
    currency_id: number
): Promise<number> {
    return await invoke<number>("get_account_balance_by_currency", {
        accountId: account_id,
        currencyId: currency_id,
    });
}

/**
 * Get all currency balances for an account
 * @param account_id Account ID
 * @returns Promise with array of AccountCurrencyBalance
 */
export async function getAllAccountBalances(
    account_id: number
): Promise<AccountCurrencyBalance[]> {
    return await invoke<AccountCurrencyBalance[]>("get_all_account_balances", {
        accountId: account_id,
    });
}

/**
 * Reconcile account balance - compare journal entries vs account balance
 * @param account_id Account ID
 * @param currency_id Currency ID
 * @returns Promise with reconciliation result
 */
export async function reconcileAccountBalance(
    account_id: number,
    currency_id: number
): Promise<{
    account_id: number;
    currency_id: number;
    account_balance: number;
    journal_debits: number;
    journal_credits: number;
    journal_balance: number;
    difference: number;
    is_balanced: boolean;
}> {
    return await invoke("reconcile_account_balance", {
        accountId: account_id,
        currencyId: currency_id,
    });
}

/**
 * Migrate existing data to new schema
 * @returns Promise with success message
 */
export async function migrateExistingData(): Promise<string> {
    return await invoke<string>("migrate_existing_data");
}
