import { invoke } from "@tauri-apps/api/core";

export interface QueryResult {
  columns: string[];
  rows: Array<Array<any>>;
}

export interface ExecuteResult {
  rows_affected: number;
}

/**
 * Create a new SQLite database file
 * Database is automatically created in the OS-specific data directory if it doesn't exist
 * @param dbName Name of the database (without .db extension)
 * @returns Promise with the database path
 */
export async function createDatabase(dbName: string): Promise<string> {
  return await invoke<string>("db_create", { dbName });
}

/**
 * Open database (creates it automatically if it doesn't exist)
 * Database path is automatically determined based on OS:
 * - Windows: %LOCALAPPDATA%\finance-app\db.sqlite
 * - macOS: ~/Library/Application Support/finance-app/db.sqlite
 * - Linux: ~/.local/share/finance-app/db.sqlite or $XDG_DATA_HOME/finance-app/db.sqlite
 * @param dbName Name of the database (without .db extension) - currently not used
 * @returns Promise with the database path
 */
export async function openDatabase(dbName: string): Promise<string> {
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
 * Close the current database connection
 * @returns Promise with success message
 */
export async function closeDatabase(): Promise<string> {
  return await invoke<string>("db_close");
}

/**
 * Check if a database is currently open
 * @returns Promise with boolean indicating if database is open
 */
export async function isDatabaseOpen(): Promise<boolean> {
  return await invoke<boolean>("db_is_open");
}

/**
 * Execute a SQL query (INSERT, UPDATE, DELETE, CREATE TABLE, etc.)
 * @param sql SQL query string
 * @param params Optional array of parameters for prepared statements
 * @returns Promise with ExecuteResult containing rows_affected
 */
export async function executeQuery(
  sql: string,
  params: any[] = []
): Promise<ExecuteResult> {
  return await invoke<ExecuteResult>("db_execute", { sql, params });
}

/**
 * Execute a SELECT query and return results
 * @param sql SQL SELECT query string
 * @param params Optional array of parameters for prepared statements
 * @returns Promise with QueryResult containing columns and rows
 */
export async function queryDatabase(
  sql: string,
  params: any[] = []
): Promise<QueryResult> {
  return await invoke<QueryResult>("db_query", { sql, params });
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
