import { invoke } from "@tauri-apps/api/core";

export interface QueryResult {
  columns: string[];
  rows: Array<Array<any>>;
}

export interface ExecuteResult {
  rows_affected: number;
}

export interface DatabaseConfig {
  mode: "offline" | "online" | "both";
  offline_path?: string | null;
  online_url?: string | null;
  namespace?: string | null;
  database?: string | null;
  username?: string | null;
  password?: string | null;
}

/**
 * Configure SurrealDB database
 * @param config Database configuration
 * @returns Promise with success message
 */
export async function configureDatabase(config: DatabaseConfig): Promise<string> {
  return await invoke<string>("db_configure", { config });
}

/**
 * Open SurrealDB database (creates it automatically if it doesn't exist)
 * @param config Database configuration
 * @returns Promise with success message
 */
export async function openDatabaseSurreal(config: DatabaseConfig): Promise<string> {
  return await invoke<string>("db_open_surreal", { config });
}

/**
 * Create a new SQLite database file (legacy - kept for backward compatibility)
 * @param dbName Name of the database (without .db extension)
 * @returns Promise with the database path
 */
export async function createDatabase(dbName: string): Promise<string> {
  return await invoke<string>("db_create", { dbName });
}

/**
 * Open database (legacy SQLite - kept for backward compatibility)
 * @param dbName Name of the database (without .db extension) - currently not used
 * @returns Promise with the database path
 */
export async function openDatabase(dbName: string): Promise<string> {
  // Try SurrealDB first, fallback to SQLite
  try {
    const isOpen = await isDatabaseOpenSurreal();
    if (isOpen) {
      return "SurrealDB already open";
    }
  } catch {
    // SurrealDB not configured, use SQLite
    return await invoke<string>("db_open", { dbName });
  }
  return await invoke<string>("db_open", { dbName });
}

/**
 * Get the current database path
 * @returns Promise with the database path string
 */
export async function getDatabasePath(): Promise<string> {
  return await invoke<string>("get_database_path");
}

/**
 * Backup database - returns the database path
 * @returns Promise with the database path string
 */
export async function backupDatabase(): Promise<string> {
  return await invoke<string>("backup_database");
}

/**
 * Restore database from backup file
 * @param backupPath Path to the backup database file
 * @returns Promise with success message
 */
export async function restoreDatabase(backupPath: string): Promise<string> {
  return await invoke<string>("restore_database", { backupPath });
}

/**
 * Close the current SurrealDB connection
 * @returns Promise with success message
 */
export async function closeDatabaseSurreal(): Promise<string> {
  return await invoke<string>("db_close_surreal");
}

/**
 * Close the current database connection (legacy SQLite)
 * @returns Promise with success message
 */
export async function closeDatabase(): Promise<string> {
  // Try SurrealDB first
  try {
    const isOpen = await isDatabaseOpenSurreal();
    if (isOpen) {
      return await closeDatabaseSurreal();
    }
  } catch {
    // Fallback to SQLite
  }
  return await invoke<string>("db_close");
}

/**
 * Check if SurrealDB is currently open
 * @returns Promise with boolean indicating if database is open
 */
export async function isDatabaseOpenSurreal(): Promise<boolean> {
  return await invoke<boolean>("db_is_open_surreal");
}

/**
 * Check if a database is currently open (checks SurrealDB first, then SQLite)
 * @returns Promise with boolean indicating if database is open
 */
export async function isDatabaseOpen(): Promise<boolean> {
  // Try SurrealDB first
  try {
    const isOpen = await isDatabaseOpenSurreal();
    if (isOpen) {
      return true;
    }
  } catch {
    // SurrealDB not configured, check SQLite
  }
  return await invoke<boolean>("db_is_open");
}

/**
 * Execute a SurrealQL query (CREATE, UPDATE, DELETE, etc.)
 * Note: params are not used in SurrealQL - values should be embedded in the query
 * @param query SurrealQL query string
 * @param params Not used for SurrealDB (kept for backward compatibility)
 * @returns Promise with ExecuteResult containing rows_affected
 */
export async function executeQuery(
  query: string,
  params: any[] = []
): Promise<ExecuteResult> {
  // Try SurrealDB first
  try {
    const isOpen = await isDatabaseOpenSurreal();
    if (isOpen) {
      return await invoke<ExecuteResult>("db_execute_surreal", { query });
    }
  } catch {
    // Fallback to SQLite
  }
  // Fallback to SQLite (convert params if needed)
  return await invoke<ExecuteResult>("db_execute", { sql: query, params });
}

/**
 * Execute a SurrealQL SELECT query and return results
 * Note: params are not used in SurrealQL - values should be embedded in the query
 * @param query SurrealQL SELECT query string
 * @param params Not used for SurrealDB (kept for backward compatibility)
 * @returns Promise with QueryResult containing columns and rows
 */
export async function queryDatabase(
  query: string,
  params: any[] = []
): Promise<QueryResult> {
  // Try SurrealDB first
  try {
    const isOpen = await isDatabaseOpenSurreal();
    if (isOpen) {
      return await invoke<QueryResult>("db_query_surreal", { query });
    }
  } catch {
    // Fallback to SQLite
  }
  // Fallback to SQLite (convert params if needed)
  return await invoke<QueryResult>("db_query", { sql: query, params });
}

/**
 * Sync data between offline and online SurrealDB
 * @returns Promise with success message
 */
export async function syncDatabase(): Promise<string> {
  return await invoke<string>("db_sync");
}

/**
 * Helper function to convert query results to objects
 * @param result QueryResult from queryDatabase
 * @returns Array of objects with column names as keys
 */
export function resultToObjects(result: QueryResult): Record<string, any>[] {
  return result.rows.map((row) => {
    const obj: Record<string, any> = {};
    result.columns.forEach((col, index) => {
      obj[col] = row[index];
    });
    return obj;
  });
}
