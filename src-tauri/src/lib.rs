mod db;

use db::Database;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

// Load environment variables at startup
fn load_env() {
    let _ = dotenv::dotenv();
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecuteResult {
    pub rows_affected: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}
/// Get database path using standard OS data directory
fn get_db_path(app: &AppHandle, _db_name: &str) -> Result<PathBuf, String> {
    // Get standard data directory based on OS
    let data_dir = if cfg!(target_os = "android") {
        // Android: Use app's private data directory
        // Tauri provides the app data directory via app.path()
        app.path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get Android app data directory: {}", e))?
    } else if cfg!(windows) {
        // Windows: Use AppData\Local\<app_name>
        std::env::var("LOCALAPPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                // Fallback to current directory if LOCALAPPDATA is not set
                PathBuf::from(".")
            })
            .join("finance-app")
    } else if cfg!(target_os = "macos") {
        // macOS: Use ~/Library/Application Support/<app_name>
        std::env::var("HOME")
            .map(|home| PathBuf::from(home).join("Library").join("Application Support").join("tauri-app"))
            .unwrap_or_else(|_| PathBuf::from("."))
    } else {
        // Linux: Use ~/.local/share/<app_name> or XDG_DATA_HOME
        std::env::var("XDG_DATA_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                std::env::var("HOME")
                    .map(|home| PathBuf::from(home).join(".local").join("share"))
                    .unwrap_or_else(|_| PathBuf::from("."))
            })
            .join("finance-app")
    };
    
    // Create data directory if it doesn't exist
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create data directory: {}", e))?;
    
    // Database file path
    let db_path = data_dir.join("db.sqlite");
    
    Ok(db_path)
}

/// Get the current database path
#[tauri::command]
fn get_database_path(app: AppHandle) -> Result<String, String> {
    let db_path = get_db_path(&app, "")?;
    Ok(db_path.to_string_lossy().to_string())
}

/// Create a new SQLite database file (creates database automatically on open)
#[tauri::command]
fn db_create(app: AppHandle, _db_name: String) -> Result<String, String> {
    let db_path = get_db_path(&app, &_db_name)?;
    let db = Database::new(db_path.clone());
    db.open()
        .map_err(|e| format!("Failed to create database: {}", e))?;
    Ok(format!("Database created at: {:?}", db_path))
}

/// Open database (creates it automatically if it doesn't exist)
#[tauri::command]
fn db_open(app: AppHandle, _db_name: String) -> Result<String, String> {
    let db_path = get_db_path(&app, "")?;

    let db = Database::new(db_path.clone());
    db.open()
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Update existing database state
    let db_state: State<'_, Mutex<Option<Database>>> = app.state();
    let mut db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    *db_guard = Some(db);

    if db_path.exists() {
        Ok(format!("Database opened: {:?}", db_path))
    } else {
        Ok(format!("Database created and opened: {:?}", db_path))
    }
}

/// Close the current database
#[tauri::command]
fn db_close(db_state: State<'_, Mutex<Option<Database>>>) -> Result<String, String> {
    let mut db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    if let Some(db) = db_guard.take() {
        db.close()
            .map_err(|e| format!("Failed to close database: {}", e))?;
        Ok("Database closed successfully".to_string())
    } else {
        Err("No database is currently open".to_string())
    }
}

/// Check if database is open
#[tauri::command]
fn db_is_open(db_state: State<'_, Mutex<Option<Database>>>) -> Result<bool, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(db_guard.as_ref().map(|db| db.is_open()).unwrap_or(false))
}

/// Execute a SQL query (INSERT, UPDATE, DELETE, CREATE TABLE, etc.)
#[tauri::command]
fn db_execute(
    db_state: State<'_, Mutex<Option<Database>>>,
    sql: String,
    params: Vec<serde_json::Value>,
) -> Result<ExecuteResult, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Convert JSON values to SQL parameters using rusqlite::params
    let rows_affected = db.with_connection(|conn| {
        let mut stmt = conn.prepare(&sql).map_err(|e| anyhow::anyhow!("SQL prepare error: {}", e))?;
        
        // Convert params to rusqlite compatible format
        let rusqlite_params: Vec<rusqlite::types::Value> = params
            .iter()
            .map(|v| {
                match v {
                    serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                    serde_json::Value::Number(n) => {
                        if n.is_i64() {
                            rusqlite::types::Value::Integer(n.as_i64().unwrap())
                        } else if n.is_u64() {
                            rusqlite::types::Value::Integer(n.as_u64().unwrap() as i64)
                        } else {
                            rusqlite::types::Value::Real(n.as_f64().unwrap())
                        }
                    }
                    serde_json::Value::Bool(b) => rusqlite::types::Value::Integer(if *b { 1 } else { 0 }),
                    serde_json::Value::Null => rusqlite::types::Value::Null,
                    _ => rusqlite::types::Value::Text(v.to_string()),
                }
            })
            .collect();

        let rows_affected = stmt.execute(rusqlite::params_from_iter(rusqlite_params.iter()))
            .map_err(|e| anyhow::anyhow!("SQL execution error: {}", e))?;
        
        Ok(rows_affected)
    })
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(ExecuteResult { rows_affected })
}

/// Execute a SELECT query and return results
#[tauri::command]
fn db_query(
    db_state: State<'_, Mutex<Option<Database>>>,
    sql: String,
    params: Vec<serde_json::Value>,
) -> Result<QueryResult, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Get column names and execute query
    let result = db.with_connection(|conn| {
        let mut stmt = conn.prepare(&sql).map_err(|e| anyhow::anyhow!("SQL prepare error: {}", e))?;
        
        let column_count = stmt.column_count();
        let columns: Vec<String> = (0..column_count)
            .map(|i| stmt.column_name(i).unwrap_or("").to_string())
            .collect();

        // Convert params to rusqlite compatible format
        let rusqlite_params: Vec<rusqlite::types::Value> = params
            .iter()
            .map(|v| {
                match v {
                    serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                    serde_json::Value::Number(n) => {
                        if n.is_i64() {
                            rusqlite::types::Value::Integer(n.as_i64().unwrap())
                        } else if n.is_u64() {
                            rusqlite::types::Value::Integer(n.as_u64().unwrap() as i64)
                        } else {
                            rusqlite::types::Value::Real(n.as_f64().unwrap())
                        }
                    }
                    serde_json::Value::Bool(b) => rusqlite::types::Value::Integer(if *b { 1 } else { 0 }),
                    serde_json::Value::Null => rusqlite::types::Value::Null,
                    _ => rusqlite::types::Value::Text(v.to_string()),
                }
            })
            .collect();

        // Execute query and get rows
        let rows = stmt
            .query_map(rusqlite::params_from_iter(rusqlite_params.iter()), |row| {
                let mut values = Vec::new();
                for i in 0..column_count {
                    let value = {
                        // Try to get value based on column type
                        let col_type = row.get_ref(i)?.data_type();
                        match col_type {
                            rusqlite::types::Type::Integer => {
                                let val = row.get::<_, i64>(i)?;
                                serde_json::Value::Number(serde_json::Number::from(val))
                            },
                            rusqlite::types::Type::Real => {
                                let val = row.get::<_, f64>(i)?;
                                serde_json::Value::Number(serde_json::Number::from_f64(val).unwrap_or(serde_json::Number::from(0)))
                            },
                            rusqlite::types::Type::Text => {
                                let val = row.get::<_, String>(i)?;
                                serde_json::Value::String(val)
                            },
                            rusqlite::types::Type::Blob => {
                                let blob = row.get_ref(i)?.as_blob()?;
                                serde_json::Value::String(format!("[BLOB:{} bytes]", blob.len()))
                            },
                            rusqlite::types::Type::Null => serde_json::Value::Null,
                        }
                    };
                    values.push(value);
                }
                Ok(values)
            })
            .map_err(|e| anyhow::anyhow!("SQL query error: {}", e))?;

        let mut result_rows = Vec::new();
        for row in rows {
            result_rows.push(row.map_err(|e| anyhow::anyhow!("Row processing error: {}", e))?);
        }

        Ok((columns, result_rows))
    })
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(QueryResult {
        columns: result.0,
        rows: result.1,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub email: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResult {
    pub success: bool,
    pub user: Option<User>,
    pub message: String,
}

/// Initialize users table schema
#[tauri::command]
fn init_users_table(db_state: State<'_, Mutex<Option<Database>>>) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let create_table_sql = "
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ";

    db.execute(create_table_sql, &[])
        .map_err(|e| format!("Failed to create users table: {}", e))?;

    Ok("Users table initialized successfully".to_string())
}

/// Register a new user
#[tauri::command]
fn register_user(
    db_state: State<'_, Mutex<Option<Database>>>,
    username: String,
    email: String,
    password: String,
) -> Result<LoginResult, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Hash the password
    let password_hash = bcrypt::hash(&password, bcrypt::DEFAULT_COST)
        .map_err(|e| format!("Failed to hash password: {}", e))?;

    // Check if username or email already exists
    let check_sql = "SELECT id FROM users WHERE username = ? OR email = ?";
    let existing = db
        .query(check_sql, &[&username as &dyn rusqlite::ToSql, &email as &dyn rusqlite::ToSql], |row| {
            Ok(row.get::<_, i64>(0)?)
        })
        .map_err(|e| format!("Database query error: {}", e))?;

    if !existing.is_empty() {
        return Ok(LoginResult {
            success: false,
            user: None,
            message: "Username or email already exists".to_string(),
        });
    }

    // Insert new user
    let insert_sql = "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)";
    db.execute(insert_sql, &[&username as &dyn rusqlite::ToSql, &email as &dyn rusqlite::ToSql, &password_hash as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to insert user: {}", e))?;

    // Get the created user
    let user_sql = "SELECT id, username, email, created_at FROM users WHERE username = ?";
    let users = db
        .query(user_sql, &[&username as &dyn rusqlite::ToSql], |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                email: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to fetch user: {}", e))?;

    if let Some(user) = users.first() {
        Ok(LoginResult {
            success: true,
            user: Some(user.clone()),
            message: "User registered successfully".to_string(),
        })
    } else {
        Err("Failed to retrieve created user".to_string())
    }
}

/// Login a user
#[tauri::command]
fn login_user(
    db_state: State<'_, Mutex<Option<Database>>>,
    username: String,
    password: String,
) -> Result<LoginResult, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Get user by username or email
    let user_sql = "SELECT id, username, email, password_hash, created_at FROM users WHERE username = ? OR email = ?";
    let users = db
        .query(user_sql, &[&username as &dyn rusqlite::ToSql, &username as &dyn rusqlite::ToSql], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        })
        .map_err(|e| format!("Database query error: {}", e))?;

    if users.is_empty() {
        return Ok(LoginResult {
            success: false,
            user: None,
            message: "Invalid username or password".to_string(),
        });
    }

    let (id, db_username, email, password_hash, created_at) = &users[0];

    // Verify password
    let password_valid = bcrypt::verify(&password, password_hash)
        .map_err(|e| format!("Password verification error: {}", e))?;

    if !password_valid {
        return Ok(LoginResult {
            success: false,
            user: None,
            message: "Invalid username or password".to_string(),
        });
    }

    Ok(LoginResult {
        success: true,
        user: Some(User {
            id: *id,
            username: db_username.clone(),
            email: email.clone(),
            created_at: created_at.clone(),
        }),
        message: "Login successful".to_string(),
    })
}

// Currency Model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Currency {
    pub id: i64,
    pub name: String,
    pub base: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Initialize currencies table schema
#[tauri::command]
fn init_currencies_table(db_state: State<'_, Mutex<Option<Database>>>) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let create_table_sql = "
        CREATE TABLE IF NOT EXISTS currencies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            base INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ";

    db.execute(create_table_sql, &[])
        .map_err(|e| format!("Failed to create currencies table: {}", e))?;

    Ok("Currencies table initialized successfully".to_string())
}

/// Create a new currency
#[tauri::command]
fn create_currency(
    db_state: State<'_, Mutex<Option<Database>>>,
    name: String,
    base: bool,
) -> Result<Currency, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // If this is set as base, unset all other base currencies
    if base {
        let update_sql = "UPDATE currencies SET base = 0";
        db.execute(update_sql, &[])
            .map_err(|e| format!("Failed to update base currencies: {}", e))?;
    }

    // Insert new currency
    let insert_sql = "INSERT INTO currencies (name, base) VALUES (?, ?)";
    let base_int = if base { 1 } else { 0 };
    db.execute(insert_sql, &[&name as &dyn rusqlite::ToSql, &base_int as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to insert currency: {}", e))?;

    // Get the created currency
    let currency_sql = "SELECT id, name, base, created_at, updated_at FROM currencies WHERE name = ?";
    let currencies = db
        .query(currency_sql, &[&name as &dyn rusqlite::ToSql], |row| {
            Ok(Currency {
                id: row.get(0)?,
                name: row.get(1)?,
                base: row.get::<_, i64>(2)? != 0,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })
        .map_err(|e| format!("Failed to fetch currency: {}", e))?;

    if let Some(currency) = currencies.first() {
        Ok(currency.clone())
    } else {
        Err("Failed to retrieve created currency".to_string())
    }
}

/// Get all currencies
#[tauri::command]
fn get_currencies(db_state: State<'_, Mutex<Option<Database>>>) -> Result<Vec<Currency>, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let sql = "SELECT id, name, base, created_at, updated_at FROM currencies ORDER BY base DESC, name ASC";
    let currencies = db
        .query(sql, &[], |row| {
            Ok(Currency {
                id: row.get(0)?,
                name: row.get(1)?,
                base: row.get::<_, i64>(2)? != 0,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })
        .map_err(|e| format!("Failed to fetch currencies: {}", e))?;

    Ok(currencies)
}

/// Update a currency
#[tauri::command]
fn update_currency(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
    name: String,
    base: bool,
) -> Result<Currency, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // If this is set as base, unset all other base currencies
    if base {
        let update_sql = "UPDATE currencies SET base = 0 WHERE id != ?";
        db.execute(update_sql, &[&id as &dyn rusqlite::ToSql])
            .map_err(|e| format!("Failed to update base currencies: {}", e))?;
    }

    // Update currency
    let base_int = if base { 1 } else { 0 };
    let update_sql = "UPDATE currencies SET name = ?, base = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    db.execute(update_sql, &[&name as &dyn rusqlite::ToSql, &base_int as &dyn rusqlite::ToSql, &id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to update currency: {}", e))?;

    // Get the updated currency
    let currency_sql = "SELECT id, name, base, created_at, updated_at FROM currencies WHERE id = ?";
    let currencies = db
        .query(currency_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(Currency {
                id: row.get(0)?,
                name: row.get(1)?,
                base: row.get::<_, i64>(2)? != 0,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })
        .map_err(|e| format!("Failed to fetch currency: {}", e))?;

    if let Some(currency) = currencies.first() {
        Ok(currency.clone())
    } else {
        Err("Failed to retrieve updated currency".to_string())
    }
}

/// Delete a currency
#[tauri::command]
fn delete_currency(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let delete_sql = "DELETE FROM currencies WHERE id = ?";
    db.execute(delete_sql, &[&id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to delete currency: {}", e))?;

    Ok("Currency deleted successfully".to_string())
}

// Supplier Model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Supplier {
    pub id: i64,
    pub full_name: String,
    pub phone: String,
    pub address: String,
    pub email: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Initialize suppliers table schema
#[tauri::command]
fn init_suppliers_table(db_state: State<'_, Mutex<Option<Database>>>) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let create_table_sql = "
        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            address TEXT NOT NULL,
            email TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ";

    db.execute(create_table_sql, &[])
        .map_err(|e| format!("Failed to create suppliers table: {}", e))?;

    Ok("Suppliers table initialized successfully".to_string())
}

/// Create a new supplier
#[tauri::command]
fn create_supplier(
    db_state: State<'_, Mutex<Option<Database>>>,
    full_name: String,
    phone: String,
    address: String,
    email: Option<String>,
    notes: Option<String>,
) -> Result<Supplier, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Insert new supplier
    let insert_sql = "INSERT INTO suppliers (full_name, phone, address, email, notes) VALUES (?, ?, ?, ?, ?)";
    let email_str: Option<&str> = email.as_ref().map(|s| s.as_str());
    let notes_str: Option<&str> = notes.as_ref().map(|s| s.as_str());
    db.execute(insert_sql, &[
        &full_name as &dyn rusqlite::ToSql,
        &phone as &dyn rusqlite::ToSql,
        &address as &dyn rusqlite::ToSql,
        &email_str as &dyn rusqlite::ToSql,
        &notes_str as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to insert supplier: {}", e))?;

    // Get the created supplier
    let supplier_sql = "SELECT id, full_name, phone, address, email, notes, created_at, updated_at FROM suppliers WHERE full_name = ? AND phone = ? ORDER BY id DESC LIMIT 1";
    let suppliers = db
        .query(supplier_sql, &[&full_name as &dyn rusqlite::ToSql, &phone as &dyn rusqlite::ToSql], |row| {
            Ok(Supplier {
                id: row.get(0)?,
                full_name: row.get(1)?,
                phone: row.get(2)?,
                address: row.get(3)?,
                email: row.get::<_, Option<String>>(4)?,
                notes: row.get::<_, Option<String>>(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to fetch supplier: {}", e))?;

    if let Some(supplier) = suppliers.first() {
        Ok(supplier.clone())
    } else {
        Err("Failed to retrieve created supplier".to_string())
    }
}

/// Get all suppliers
#[tauri::command]
fn get_suppliers(
    db_state: State<'_, Mutex<Option<Database>>>,
    page: i64,
    per_page: i64,
    search: Option<String>,
    sort_by: Option<String>,
    sort_order: Option<String>,
) -> Result<PaginatedResponse<Supplier>, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let offset = (page - 1) * per_page;
    let mut where_clause = String::new();
    let mut params: Vec<serde_json::Value> = Vec::new();

    if let Some(s) = search {
        if !s.trim().is_empty() {
            let search_term = format!("%{}%", s);
            where_clause = "WHERE (full_name LIKE ? OR phone LIKE ? OR email LIKE ?)".to_string();
            params.push(serde_json::Value::String(search_term.clone()));
            params.push(serde_json::Value::String(search_term.clone()));
            params.push(serde_json::Value::String(search_term));
        }
    }

    let count_sql = format!("SELECT COUNT(*) FROM suppliers {}", where_clause);
    let total: i64 = db.with_connection(|conn| {
        let mut stmt = conn.prepare(&count_sql).map_err(|e| anyhow::anyhow!("{}", e))?;
        let rusqlite_params: Vec<rusqlite::types::Value> = params.iter().map(|v| {
            match v {
                serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                _ => rusqlite::types::Value::Null,
            }
        }).collect();
        let count: i64 = stmt.query_row(rusqlite::params_from_iter(rusqlite_params.iter()), |row| row.get(0))
            .map_err(|e| anyhow::anyhow!("{}", e))?;
        Ok(count)
    }).map_err(|e| format!("Failed to count suppliers: {}", e))?;

    let order_clause = if let Some(sort) = sort_by {
        let order = sort_order.unwrap_or_else(|| "ASC".to_string());
        let allowed_cols = ["full_name", "created_at"];
        if allowed_cols.contains(&sort.as_str()) {
            format!("ORDER BY {} {}", sort, if order.to_uppercase() == "DESC" { "DESC" } else { "ASC" })
        } else {
            "ORDER BY created_at DESC".to_string()
        }
    } else {
        "ORDER BY created_at DESC".to_string()
    };

    let sql = format!("SELECT id, full_name, phone, address, email, notes, created_at, updated_at FROM suppliers {} {} LIMIT ? OFFSET ?", where_clause, order_clause);
    
    params.push(serde_json::Value::Number(serde_json::Number::from(per_page)));
    params.push(serde_json::Value::Number(serde_json::Number::from(offset)));

    let suppliers = db.with_connection(|conn| {
        let mut stmt = conn.prepare(&sql).map_err(|e| anyhow::anyhow!("{}", e))?;
        let rusqlite_params: Vec<rusqlite::types::Value> = params.iter().map(|v| {
            match v {
                serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                serde_json::Value::Number(n) => rusqlite::types::Value::Integer(n.as_i64().unwrap_or(0)),
                _ => rusqlite::types::Value::Null,
            }
        }).collect();

        let rows = stmt.query_map(rusqlite::params_from_iter(rusqlite_params.iter()), |row| {
             Ok(Supplier {
                id: row.get(0)?,
                full_name: row.get(1)?,
                phone: row.get(2)?,
                address: row.get(3)?,
                email: row.get::<_, Option<String>>(4)?,
                notes: row.get::<_, Option<String>>(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        }).map_err(|e| anyhow::anyhow!("{}", e))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| anyhow::anyhow!("{}", e))?);
        }
        Ok(result)
    }).map_err(|e| format!("Failed to fetch suppliers: {}", e))?;

    let total_pages = (total as f64 / per_page as f64).ceil() as i64;
    
    Ok(PaginatedResponse {
        items: suppliers,
        total,
        page,
        per_page,
        total_pages,
    })
}

/// Update a supplier
#[tauri::command]
fn update_supplier(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
    full_name: String,
    phone: String,
    address: String,
    email: Option<String>,
    notes: Option<String>,
) -> Result<Supplier, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Update supplier
    let update_sql = "UPDATE suppliers SET full_name = ?, phone = ?, address = ?, email = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    let email_str: Option<&str> = email.as_ref().map(|s| s.as_str());
    let notes_str: Option<&str> = notes.as_ref().map(|s| s.as_str());
    db.execute(update_sql, &[
        &full_name as &dyn rusqlite::ToSql,
        &phone as &dyn rusqlite::ToSql,
        &address as &dyn rusqlite::ToSql,
        &email_str as &dyn rusqlite::ToSql,
        &notes_str as &dyn rusqlite::ToSql,
        &id as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to update supplier: {}", e))?;

    // Get the updated supplier
    let supplier_sql = "SELECT id, full_name, phone, address, email, notes, created_at, updated_at FROM suppliers WHERE id = ?";
    let suppliers = db
        .query(supplier_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(Supplier {
                id: row.get(0)?,
                full_name: row.get(1)?,
                phone: row.get(2)?,
                address: row.get(3)?,
                email: row.get::<_, Option<String>>(4)?,
                notes: row.get::<_, Option<String>>(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to fetch supplier: {}", e))?;

    if let Some(supplier) = suppliers.first() {
        Ok(supplier.clone())
    } else {
        Err("Failed to retrieve updated supplier".to_string())
    }
}

/// Delete a supplier
#[tauri::command]
fn delete_supplier(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let delete_sql = "DELETE FROM suppliers WHERE id = ?";
    db.execute(delete_sql, &[&id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to delete supplier: {}", e))?;

    Ok("Supplier deleted successfully".to_string())
}

// Customer Model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Customer {
    pub id: i64,
    pub full_name: String,
    pub phone: String,
    pub address: String,
    pub email: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Initialize customers table schema
#[tauri::command]
fn init_customers_table(db_state: State<'_, Mutex<Option<Database>>>) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let create_table_sql = "
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            address TEXT NOT NULL,
            email TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ";

    db.execute(create_table_sql, &[])
        .map_err(|e| format!("Failed to create customers table: {}", e))?;

    Ok("Customers table initialized successfully".to_string())
}

/// Create a new customer
#[tauri::command]
fn create_customer(
    db_state: State<'_, Mutex<Option<Database>>>,
    full_name: String,
    phone: String,
    address: String,
    email: Option<String>,
    notes: Option<String>,
) -> Result<Customer, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Insert new customer
    let insert_sql = "INSERT INTO customers (full_name, phone, address, email, notes) VALUES (?, ?, ?, ?, ?)";
    let email_str: Option<&str> = email.as_ref().map(|s| s.as_str());
    let notes_str: Option<&str> = notes.as_ref().map(|s| s.as_str());
    db.execute(insert_sql, &[
        &full_name as &dyn rusqlite::ToSql,
        &phone as &dyn rusqlite::ToSql,
        &address as &dyn rusqlite::ToSql,
        &email_str as &dyn rusqlite::ToSql,
        &notes_str as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to insert customer: {}", e))?;

    // Get the created customer
    let customer_sql = "SELECT id, full_name, phone, address, email, notes, created_at, updated_at FROM customers WHERE full_name = ? AND phone = ? ORDER BY id DESC LIMIT 1";
    let customers = db
        .query(customer_sql, &[&full_name as &dyn rusqlite::ToSql, &phone as &dyn rusqlite::ToSql], |row| {
            Ok(Customer {
                id: row.get(0)?,
                full_name: row.get(1)?,
                phone: row.get(2)?,
                address: row.get(3)?,
                email: row.get::<_, Option<String>>(4)?,
                notes: row.get::<_, Option<String>>(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to fetch customer: {}", e))?;

    if let Some(customer) = customers.first() {
        Ok(customer.clone())
    } else {
        Err("Failed to retrieve created customer".to_string())
    }
}

/// Get all customers
#[tauri::command]
fn get_customers(
    db_state: State<'_, Mutex<Option<Database>>>,
    page: i64,
    per_page: i64,
    search: Option<String>,
    sort_by: Option<String>,
    sort_order: Option<String>,
) -> Result<PaginatedResponse<Customer>, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let offset = (page - 1) * per_page;
    let mut where_clause = String::new();
    let mut params: Vec<serde_json::Value> = Vec::new();

    if let Some(s) = search {
        if !s.trim().is_empty() {
            let search_term = format!("%{}%", s);
            where_clause = "WHERE (full_name LIKE ? OR phone LIKE ? OR email LIKE ?)".to_string();
            params.push(serde_json::Value::String(search_term.clone()));
            params.push(serde_json::Value::String(search_term.clone()));
            params.push(serde_json::Value::String(search_term));
        }
    }

    let count_sql = format!("SELECT COUNT(*) FROM customers {}", where_clause);
    let total: i64 = db.with_connection(|conn| {
        let mut stmt = conn.prepare(&count_sql).map_err(|e| anyhow::anyhow!("{}", e))?;
        let rusqlite_params: Vec<rusqlite::types::Value> = params.iter().map(|v| {
            match v {
                serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                _ => rusqlite::types::Value::Null,
            }
        }).collect();
        let count: i64 = stmt.query_row(rusqlite::params_from_iter(rusqlite_params.iter()), |row| row.get(0))
            .map_err(|e| anyhow::anyhow!("{}", e))?;
        Ok(count)
    }).map_err(|e| format!("Failed to count customers: {}", e))?;

    let order_clause = if let Some(sort) = sort_by {
        let order = sort_order.unwrap_or_else(|| "ASC".to_string());
        let allowed_cols = ["full_name", "created_at"];
        if allowed_cols.contains(&sort.as_str()) {
            format!("ORDER BY {} {}", sort, if order.to_uppercase() == "DESC" { "DESC" } else { "ASC" })
        } else {
            "ORDER BY created_at DESC".to_string()
        }
    } else {
        "ORDER BY created_at DESC".to_string()
    };

    let sql = format!("SELECT id, full_name, phone, address, email, notes, created_at, updated_at FROM customers {} {} LIMIT ? OFFSET ?", where_clause, order_clause);
    
    params.push(serde_json::Value::Number(serde_json::Number::from(per_page)));
    params.push(serde_json::Value::Number(serde_json::Number::from(offset)));

    let customers = db.with_connection(|conn| {
        let mut stmt = conn.prepare(&sql).map_err(|e| anyhow::anyhow!("{}", e))?;
        let rusqlite_params: Vec<rusqlite::types::Value> = params.iter().map(|v| {
            match v {
                serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                serde_json::Value::Number(n) => rusqlite::types::Value::Integer(n.as_i64().unwrap_or(0)),
                _ => rusqlite::types::Value::Null,
            }
        }).collect();

        let rows = stmt.query_map(rusqlite::params_from_iter(rusqlite_params.iter()), |row| {
             Ok(Customer {
                id: row.get(0)?,
                full_name: row.get(1)?,
                phone: row.get(2)?,
                address: row.get(3)?,
                email: row.get::<_, Option<String>>(4)?,
                notes: row.get::<_, Option<String>>(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        }).map_err(|e| anyhow::anyhow!("{}", e))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| anyhow::anyhow!("{}", e))?);
        }
        Ok(result)
    }).map_err(|e| format!("Failed to fetch customers: {}", e))?;

    let total_pages = (total as f64 / per_page as f64).ceil() as i64;
    
    Ok(PaginatedResponse {
        items: customers,
        total,
        page,
        per_page,
        total_pages,
    })
}

/// Update a customer
#[tauri::command]
fn update_customer(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
    full_name: String,
    phone: String,
    address: String,
    email: Option<String>,
    notes: Option<String>,
) -> Result<Customer, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Update customer
    let update_sql = "UPDATE customers SET full_name = ?, phone = ?, address = ?, email = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    let email_str: Option<&str> = email.as_ref().map(|s| s.as_str());
    let notes_str: Option<&str> = notes.as_ref().map(|s| s.as_str());
    db.execute(update_sql, &[
        &full_name as &dyn rusqlite::ToSql,
        &phone as &dyn rusqlite::ToSql,
        &address as &dyn rusqlite::ToSql,
        &email_str as &dyn rusqlite::ToSql,
        &notes_str as &dyn rusqlite::ToSql,
        &id as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to update customer: {}", e))?;

    // Get the updated customer
    let customer_sql = "SELECT id, full_name, phone, address, email, notes, created_at, updated_at FROM customers WHERE id = ?";
    let customers = db
        .query(customer_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(Customer {
                id: row.get(0)?,
                full_name: row.get(1)?,
                phone: row.get(2)?,
                address: row.get(3)?,
                email: row.get::<_, Option<String>>(4)?,
                notes: row.get::<_, Option<String>>(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to fetch customer: {}", e))?;

    if let Some(customer) = customers.first() {
        Ok(customer.clone())
    } else {
        Err("Failed to retrieve updated customer".to_string())
    }
}

/// Delete a customer
#[tauri::command]
fn delete_customer(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let delete_sql = "DELETE FROM customers WHERE id = ?";
    db.execute(delete_sql, &[&id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to delete customer: {}", e))?;

    Ok("Customer deleted successfully".to_string())
}

// Unit Model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Unit {
    pub id: i64,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Initialize units table schema
#[tauri::command]
fn init_units_table(db_state: State<'_, Mutex<Option<Database>>>) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let create_table_sql = "
        CREATE TABLE IF NOT EXISTS units (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ";

    db.execute(create_table_sql, &[])
        .map_err(|e| format!("Failed to create units table: {}", e))?;

    Ok("Units table initialized successfully".to_string())
}

/// Create a new unit
#[tauri::command]
fn create_unit(
    db_state: State<'_, Mutex<Option<Database>>>,
    name: String,
) -> Result<Unit, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Insert new unit
    let insert_sql = "INSERT INTO units (name) VALUES (?)";
    db.execute(insert_sql, &[&name as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to insert unit: {}", e))?;

    // Get the created unit
    let unit_sql = "SELECT id, name, created_at, updated_at FROM units WHERE name = ?";
    let units = db
        .query(unit_sql, &[&name as &dyn rusqlite::ToSql], |row| {
            Ok(Unit {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to fetch unit: {}", e))?;

    if let Some(unit) = units.first() {
        Ok(unit.clone())
    } else {
        Err("Failed to retrieve created unit".to_string())
    }
}

/// Get all units
#[tauri::command]
fn get_units(db_state: State<'_, Mutex<Option<Database>>>) -> Result<Vec<Unit>, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let sql = "SELECT id, name, created_at, updated_at FROM units ORDER BY name ASC";
    let units = db
        .query(sql, &[], |row| {
            Ok(Unit {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to fetch units: {}", e))?;

    Ok(units)
}

/// Update a unit
#[tauri::command]
fn update_unit(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
    name: String,
) -> Result<Unit, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Update unit
    let update_sql = "UPDATE units SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    db.execute(update_sql, &[&name as &dyn rusqlite::ToSql, &id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to update unit: {}", e))?;

    // Get the updated unit
    let unit_sql = "SELECT id, name, created_at, updated_at FROM units WHERE id = ?";
    let units = db
        .query(unit_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(Unit {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to fetch unit: {}", e))?;

    if let Some(unit) = units.first() {
        Ok(unit.clone())
    } else {
        Err("Failed to retrieve updated unit".to_string())
    }
}

/// Delete a unit
#[tauri::command]
fn delete_unit(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let delete_sql = "DELETE FROM units WHERE id = ?";
    db.execute(delete_sql, &[&id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to delete unit: {}", e))?;

    Ok("Unit deleted successfully".to_string())
}

// Product Model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Product {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub price: Option<f64>,
    pub currency_id: Option<i64>,
    pub supplier_id: Option<i64>,
    pub stock_quantity: Option<f64>,
    pub unit: Option<String>,
    pub image_path: Option<String>,
    pub bar_code: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Initialize products table schema
#[tauri::command]
fn init_products_table(db_state: State<'_, Mutex<Option<Database>>>) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let create_table_sql = "
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price REAL,
            currency_id INTEGER,
            supplier_id INTEGER,
            stock_quantity REAL,
            unit TEXT,
            image_path TEXT,
            bar_code TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (currency_id) REFERENCES currencies(id),
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        )
    ";

    db.execute(create_table_sql, &[])
        .map_err(|e| format!("Failed to create products table: {}", e))?;

    // Add new columns if they don't exist (for existing databases)
    let alter_sqls = vec![
        "ALTER TABLE products ADD COLUMN image_path TEXT",
        "ALTER TABLE products ADD COLUMN bar_code TEXT",
    ];
    
    for alter_sql in alter_sqls {
        let _ = db.execute(alter_sql, &[]);
    }

    Ok("Products table initialized successfully".to_string())
}

/// Create a new product
#[tauri::command]
fn create_product(
    db_state: State<'_, Mutex<Option<Database>>>,
    name: String,
    description: Option<String>,
    price: Option<f64>,
    currency_id: Option<i64>,
    supplier_id: Option<i64>,
    stock_quantity: Option<f64>,
    unit: Option<String>,
    image_path: Option<String>,
    bar_code: Option<String>,
) -> Result<Product, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Insert new product
    let insert_sql = "INSERT INTO products (name, description, price, currency_id, supplier_id, stock_quantity, unit, image_path, bar_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    let description_str: Option<&str> = description.as_ref().map(|s| s.as_str());
    let unit_str: Option<&str> = unit.as_ref().map(|s| s.as_str());
    let image_path_str: Option<&str> = image_path.as_ref().map(|s| s.as_str());
    let bar_code_str: Option<&str> = bar_code.as_ref().map(|s| s.as_str());
    db.execute(insert_sql, &[
        &name as &dyn rusqlite::ToSql,
        &description_str as &dyn rusqlite::ToSql,
        &price as &dyn rusqlite::ToSql,
        &currency_id as &dyn rusqlite::ToSql,
        &supplier_id as &dyn rusqlite::ToSql,
        &stock_quantity as &dyn rusqlite::ToSql,
        &unit_str as &dyn rusqlite::ToSql,
        &image_path_str as &dyn rusqlite::ToSql,
        &bar_code_str as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to insert product: {}", e))?;

    // Get the created product
    let product_sql = "SELECT id, name, description, price, currency_id, supplier_id, stock_quantity, unit, image_path, bar_code, created_at, updated_at FROM products WHERE name = ? ORDER BY id DESC LIMIT 1";
    let products = db
        .query(product_sql, &[&name as &dyn rusqlite::ToSql], |row| {
            Ok(Product {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get::<_, Option<String>>(2)?,
                price: row.get::<_, Option<f64>>(3)?,
                currency_id: row.get::<_, Option<i64>>(4)?,
                supplier_id: row.get::<_, Option<i64>>(5)?,
                stock_quantity: row.get::<_, Option<f64>>(6)?,
                unit: row.get::<_, Option<String>>(7)?,
                image_path: row.get::<_, Option<String>>(8)?,
                bar_code: row.get::<_, Option<String>>(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| format!("Failed to fetch product: {}", e))?;

    if let Some(product) = products.first() {
        Ok(product.clone())
    } else {
        Err("Failed to retrieve created product".to_string())
    }
}

/// Get all products
#[tauri::command]
fn get_products(
    db_state: State<'_, Mutex<Option<Database>>>,
    page: i64,
    per_page: i64,
    search: Option<String>,
    sort_by: Option<String>,
    sort_order: Option<String>,
) -> Result<PaginatedResponse<Product>, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let offset = (page - 1) * per_page;
    let mut where_clause = String::new();
    let mut params: Vec<serde_json::Value> = Vec::new();

    if let Some(s) = search {
        if !s.trim().is_empty() {
            let search_term = format!("%{}%", s);
            where_clause = "WHERE (name LIKE ?)".to_string();
            params.push(serde_json::Value::String(search_term.clone()));
        }
    }

    let count_sql = format!("SELECT COUNT(*) FROM products {}", where_clause);
    let total: i64 = db.with_connection(|conn| {
        let mut stmt = conn.prepare(&count_sql).map_err(|e| anyhow::anyhow!("{}", e))?;
        let rusqlite_params: Vec<rusqlite::types::Value> = params.iter().map(|v| {
            match v {
                serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                _ => rusqlite::types::Value::Null,
            }
        }).collect();
        let count: i64 = stmt.query_row(rusqlite::params_from_iter(rusqlite_params.iter()), |row| row.get(0))
            .map_err(|e| anyhow::anyhow!("{}", e))?;
        Ok(count)
    }).map_err(|e| format!("Failed to count products: {}", e))?;

    let order_clause = if let Some(sort) = sort_by {
        let order = sort_order.unwrap_or_else(|| "ASC".to_string());
        let allowed_cols = ["name", "price", "stock_quantity", "created_at"];
        if allowed_cols.contains(&sort.as_str()) {
            format!("ORDER BY {} {}", sort, if order.to_uppercase() == "DESC" { "DESC" } else { "ASC" })
        } else {
            "ORDER BY created_at DESC".to_string()
        }
    } else {
        "ORDER BY created_at DESC".to_string()
    };

    let sql = format!("SELECT id, name, description, price, currency_id, supplier_id, stock_quantity, unit, image_path, bar_code, created_at, updated_at FROM products {} {} LIMIT ? OFFSET ?", where_clause, order_clause);
    
    params.push(serde_json::Value::Number(serde_json::Number::from(per_page)));
    params.push(serde_json::Value::Number(serde_json::Number::from(offset)));

    let products = db.with_connection(|conn| {
        let mut stmt = conn.prepare(&sql).map_err(|e| anyhow::anyhow!("{}", e))?;
        let rusqlite_params: Vec<rusqlite::types::Value> = params.iter().map(|v| {
             match v {
                serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                serde_json::Value::Number(n) => rusqlite::types::Value::Integer(n.as_i64().unwrap_or(0)),
                _ => rusqlite::types::Value::Null,
            }
        }).collect();

        let rows = stmt.query_map(rusqlite::params_from_iter(rusqlite_params.iter()), |row| {
             Ok(Product {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get::<_, Option<String>>(2)?,
                price: row.get::<_, Option<f64>>(3)?,
                currency_id: row.get::<_, Option<i64>>(4)?,
                supplier_id: row.get::<_, Option<i64>>(5)?,
                stock_quantity: row.get::<_, Option<f64>>(6)?,
                unit: row.get::<_, Option<String>>(7)?,
                image_path: row.get::<_, Option<String>>(8)?,
                bar_code: row.get::<_, Option<String>>(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        }).map_err(|e| anyhow::anyhow!("{}", e))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| anyhow::anyhow!("{}", e))?);
        }
        Ok(result)
    }).map_err(|e| format!("Failed to fetch products: {}", e))?;

    let total_pages = (total as f64 / per_page as f64).ceil() as i64;
    
    Ok(PaginatedResponse {
        items: products,
        total,
        page,
        per_page,
        total_pages,
    })
}

/// Update a product
#[tauri::command]
fn update_product(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
    name: String,
    description: Option<String>,
    price: Option<f64>,
    currency_id: Option<i64>,
    supplier_id: Option<i64>,
    stock_quantity: Option<f64>,
    unit: Option<String>,
    image_path: Option<String>,
    bar_code: Option<String>,
) -> Result<Product, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Update product
    let update_sql = "UPDATE products SET name = ?, description = ?, price = ?, currency_id = ?, supplier_id = ?, stock_quantity = ?, unit = ?, image_path = ?, bar_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    let description_str: Option<&str> = description.as_ref().map(|s| s.as_str());
    let unit_str: Option<&str> = unit.as_ref().map(|s| s.as_str());
    let image_path_str: Option<&str> = image_path.as_ref().map(|s| s.as_str());
    let bar_code_str: Option<&str> = bar_code.as_ref().map(|s| s.as_str());
    db.execute(update_sql, &[
        &name as &dyn rusqlite::ToSql,
        &description_str as &dyn rusqlite::ToSql,
        &price as &dyn rusqlite::ToSql,
        &currency_id as &dyn rusqlite::ToSql,
        &supplier_id as &dyn rusqlite::ToSql,
        &stock_quantity as &dyn rusqlite::ToSql,
        &unit_str as &dyn rusqlite::ToSql,
        &image_path_str as &dyn rusqlite::ToSql,
        &bar_code_str as &dyn rusqlite::ToSql,
        &id as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to update product: {}", e))?;

    // Get the updated product
    let product_sql = "SELECT id, name, description, price, currency_id, supplier_id, stock_quantity, unit, image_path, bar_code, created_at, updated_at FROM products WHERE id = ?";
    let products = db
        .query(product_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(Product {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get::<_, Option<String>>(2)?,
                price: row.get::<_, Option<f64>>(3)?,
                currency_id: row.get::<_, Option<i64>>(4)?,
                supplier_id: row.get::<_, Option<i64>>(5)?,
                stock_quantity: row.get::<_, Option<f64>>(6)?,
                unit: row.get::<_, Option<String>>(7)?,
                image_path: row.get::<_, Option<String>>(8)?,
                bar_code: row.get::<_, Option<String>>(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| format!("Failed to fetch product: {}", e))?;

    if let Some(product) = products.first() {
        Ok(product.clone())
    } else {
        Err("Failed to retrieve updated product".to_string())
    }
}

/// Delete a product
#[tauri::command]
fn delete_product(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Check if product is used in purchase_items
    let purchase_check_sql = "SELECT COUNT(*) FROM purchase_items WHERE product_id = ?";
    let purchase_count: i64 = db
        .query(purchase_check_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(row.get(0)?)
        })
        .map_err(|e| format!("Failed to check purchase items: {}", e))?
        .first()
        .cloned()
        .unwrap_or(0);

    // Check if product is used in sale_items
    let sale_check_sql = "SELECT COUNT(*) FROM sale_items WHERE product_id = ?";
    let sale_count: i64 = db
        .query(sale_check_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(row.get(0)?)
        })
        .map_err(|e| format!("Failed to check sale items: {}", e))?
        .first()
        .cloned()
        .unwrap_or(0);

    if purchase_count > 0 || sale_count > 0 {
        let mut reasons = Vec::new();
        if purchase_count > 0 {
            reasons.push(format!("used in {} purchase(s)", purchase_count));
        }
        if sale_count > 0 {
            reasons.push(format!("used in {} sale(s)", sale_count));
        }
        return Err(format!("Cannot delete product: it is {}", reasons.join(" and ")));
    }

    let delete_sql = "DELETE FROM products WHERE id = ?";
    db.execute(delete_sql, &[&id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to delete product: {}", e))?;

    Ok("Product deleted successfully".to_string())
}

// Purchase Model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Purchase {
    pub id: i64,
    pub supplier_id: i64,
    pub date: String,
    pub notes: Option<String>,
    pub total_amount: f64,
    pub created_at: String,
    pub updated_at: String,
}

// PurchaseItem Model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseItem {
    pub id: i64,
    pub purchase_id: i64,
    pub product_id: i64,
    pub unit_id: i64,
    pub per_price: f64,
    pub amount: f64,
    pub total: f64,
    pub created_at: String,
}

/// Initialize purchases table schema
#[tauri::command]
fn init_purchases_table(db_state: State<'_, Mutex<Option<Database>>>) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let create_table_sql = "
        CREATE TABLE IF NOT EXISTS purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            notes TEXT,
            total_amount REAL NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        )
    ";

    db.execute(create_table_sql, &[])
        .map_err(|e| format!("Failed to create purchases table: {}", e))?;

    let create_items_table_sql = "
        CREATE TABLE IF NOT EXISTS purchase_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            unit_id INTEGER NOT NULL,
            per_price REAL NOT NULL,
            amount REAL NOT NULL,
            total REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id),
            FOREIGN KEY (unit_id) REFERENCES units(id)
        )
    ";

    db.execute(create_items_table_sql, &[])
        .map_err(|e| format!("Failed to create purchase_items table: {}", e))?;

    Ok("Purchases and purchase_items tables initialized successfully".to_string())
}

/// Create a new purchase with items
#[tauri::command]
fn create_purchase(
    db_state: State<'_, Mutex<Option<Database>>>,
    supplier_id: i64,
    date: String,
    notes: Option<String>,
    items: Vec<(i64, i64, f64, f64)>, // (product_id, unit_id, per_price, amount)
) -> Result<Purchase, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Calculate total amount from items
    let total_amount: f64 = items.iter().map(|(_, _, per_price, amount)| per_price * amount).sum();

    // Insert purchase
    let notes_str: Option<&str> = notes.as_ref().map(|s| s.as_str());
    let insert_sql = "INSERT INTO purchases (supplier_id, date, notes, total_amount) VALUES (?, ?, ?, ?)";
    db.execute(insert_sql, &[
        &supplier_id as &dyn rusqlite::ToSql,
        &date as &dyn rusqlite::ToSql,
        &notes_str as &dyn rusqlite::ToSql,
        &total_amount as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to insert purchase: {}", e))?;

    // Get the created purchase ID
    let purchase_id_sql = "SELECT id FROM purchases WHERE supplier_id = ? AND date = ? ORDER BY id DESC LIMIT 1";
    let purchase_ids = db
        .query(purchase_id_sql, &[&supplier_id as &dyn rusqlite::ToSql, &date as &dyn rusqlite::ToSql], |row| {
            Ok(row.get::<_, i64>(0)?)
        })
        .map_err(|e| format!("Failed to fetch purchase ID: {}", e))?;

    let purchase_id = purchase_ids.first().ok_or("Failed to retrieve purchase ID")?;

    // Insert purchase items
    for (product_id, unit_id, per_price, amount) in items {
        let total = per_price * amount;
        let insert_item_sql = "INSERT INTO purchase_items (purchase_id, product_id, unit_id, per_price, amount, total) VALUES (?, ?, ?, ?, ?, ?)";
        db.execute(insert_item_sql, &[
            purchase_id as &dyn rusqlite::ToSql,
            &product_id as &dyn rusqlite::ToSql,
            &unit_id as &dyn rusqlite::ToSql,
            &per_price as &dyn rusqlite::ToSql,
            &amount as &dyn rusqlite::ToSql,
            &total as &dyn rusqlite::ToSql,
        ])
            .map_err(|e| format!("Failed to insert purchase item: {}", e))?;
    }

    // Get the created purchase
    let purchase_sql = "SELECT id, supplier_id, date, notes, total_amount, created_at, updated_at FROM purchases WHERE id = ?";
    let purchases = db
        .query(purchase_sql, &[purchase_id as &dyn rusqlite::ToSql], |row| {
            Ok(Purchase {
                id: row.get(0)?,
                supplier_id: row.get(1)?,
                date: row.get(2)?,
                notes: row.get(3)?,
                total_amount: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| format!("Failed to fetch purchase: {}", e))?;

    if let Some(purchase) = purchases.first() {
        Ok(purchase.clone())
    } else {
        Err("Failed to retrieve created purchase".to_string())
    }
}

/// Get all purchases with pagination
#[tauri::command]
fn get_purchases(
    db_state: State<'_, Mutex<Option<Database>>>,
    page: i64,
    per_page: i64,
    search: Option<String>,
    sort_by: Option<String>,
    sort_order: Option<String>,
) -> Result<PaginatedResponse<Purchase>, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let offset = (page - 1) * per_page;

    // Build WHERE clause
    let mut where_clause = String::new();
    let mut params: Vec<serde_json::Value> = Vec::new();

    if let Some(s) = search {
        if !s.trim().is_empty() {
            let search_term = format!("%{}%", s);
            where_clause = "WHERE (CAST(p.date AS TEXT) LIKE ? OR p.notes LIKE ? OR p.supplier_id IN (SELECT id FROM suppliers WHERE full_name LIKE ?))".to_string();
            params.push(serde_json::Value::String(search_term.clone()));
            params.push(serde_json::Value::String(search_term.clone()));
            params.push(serde_json::Value::String(search_term));
        }
    }

    // Get total count
    let count_sql = format!("SELECT COUNT(*) FROM purchases p {}", where_clause);
    let total: i64 = db.with_connection(|conn| {
        let mut stmt = conn.prepare(&count_sql).map_err(|e| anyhow::anyhow!("{}", e))?;
        let rusqlite_params: Vec<rusqlite::types::Value> = params.iter().map(|v| {
            match v {
                serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                _ => rusqlite::types::Value::Null,
            }
        }).collect();
        let count: i64 = stmt.query_row(rusqlite::params_from_iter(rusqlite_params.iter()), |row| row.get(0))
            .map_err(|e| anyhow::anyhow!("{}", e))?;
        Ok(count)
    }).map_err(|e| format!("Failed to count purchases: {}", e))?;

    // Build Order By
    let order_clause = if let Some(sort) = sort_by {
        let order = sort_order.unwrap_or_else(|| "DESC".to_string());
        let allowed_cols = ["date", "total_amount", "created_at"];
        if allowed_cols.contains(&sort.as_str()) {
            format!("ORDER BY p.{} {}", sort, if order.to_uppercase() == "DESC" { "DESC" } else { "ASC" })
        } else {
            "ORDER BY p.date DESC, p.created_at DESC".to_string()
        }
    } else {
        "ORDER BY p.date DESC, p.created_at DESC".to_string()
    };

    let sql = format!("SELECT p.id, p.supplier_id, p.date, p.notes, p.total_amount, p.created_at, p.updated_at FROM purchases p {} {} LIMIT ? OFFSET ?", where_clause, order_clause);
    
    params.push(serde_json::Value::Number(serde_json::Number::from(per_page)));
    params.push(serde_json::Value::Number(serde_json::Number::from(offset)));

    let purchases = db.with_connection(|conn| {
        let mut stmt = conn.prepare(&sql).map_err(|e| anyhow::anyhow!("{}", e))?;
        let rusqlite_params: Vec<rusqlite::types::Value> = params.iter().map(|v| {
            match v {
                serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                serde_json::Value::Number(n) => rusqlite::types::Value::Integer(n.as_i64().unwrap_or(0)),
                _ => rusqlite::types::Value::Null,
            }
        }).collect();

        let rows = stmt.query_map(rusqlite::params_from_iter(rusqlite_params.iter()), |row| {
            Ok(Purchase {
                id: row.get(0)?,
                supplier_id: row.get(1)?,
                date: row.get(2)?,
                notes: row.get(3)?,
                total_amount: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        }).map_err(|e| anyhow::anyhow!("{}", e))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| anyhow::anyhow!("{}", e))?);
        }
        Ok(result)
    }).map_err(|e| format!("Failed to fetch purchases: {}", e))?;

    let total_pages = (total as f64 / per_page as f64).ceil() as i64;
    
    Ok(PaginatedResponse {
        items: purchases,
        total,
        page,
        per_page,
        total_pages,
    })
}

/// Get a single purchase with its items
#[tauri::command]
fn get_purchase(db_state: State<'_, Mutex<Option<Database>>>, id: i64) -> Result<(Purchase, Vec<PurchaseItem>), String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Get purchase
    let purchase_sql = "SELECT id, supplier_id, date, notes, total_amount, created_at, updated_at FROM purchases WHERE id = ?";
    let purchases = db
        .query(purchase_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(Purchase {
                id: row.get(0)?,
                supplier_id: row.get(1)?,
                date: row.get(2)?,
                notes: row.get(3)?,
                total_amount: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| format!("Failed to fetch purchase: {}", e))?;

    let purchase = purchases.first().ok_or("Purchase not found")?;

    // Get purchase items
    let items_sql = "SELECT id, purchase_id, product_id, unit_id, per_price, amount, total, created_at FROM purchase_items WHERE purchase_id = ?";
    let items = db
        .query(items_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(PurchaseItem {
                id: row.get(0)?,
                purchase_id: row.get(1)?,
                product_id: row.get(2)?,
                unit_id: row.get(3)?,
                per_price: row.get(4)?,
                amount: row.get(5)?,
                total: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to fetch purchase items: {}", e))?;

    Ok((purchase.clone(), items))
}

/// Update a purchase
#[tauri::command]
fn update_purchase(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
    supplier_id: i64,
    date: String,
    notes: Option<String>,
    items: Vec<(i64, i64, f64, f64)>, // (product_id, unit_id, per_price, amount)
) -> Result<Purchase, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Calculate total amount from items
    let total_amount: f64 = items.iter().map(|(_, _, per_price, amount)| per_price * amount).sum();

    // Update purchase
    let notes_str: Option<&str> = notes.as_ref().map(|s| s.as_str());
    let update_sql = "UPDATE purchases SET supplier_id = ?, date = ?, notes = ?, total_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    db.execute(update_sql, &[
        &supplier_id as &dyn rusqlite::ToSql,
        &date as &dyn rusqlite::ToSql,
        &notes_str as &dyn rusqlite::ToSql,
        &total_amount as &dyn rusqlite::ToSql,
        &id as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to update purchase: {}", e))?;

    // Delete existing items
    let delete_items_sql = "DELETE FROM purchase_items WHERE purchase_id = ?";
    db.execute(delete_items_sql, &[&id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to delete purchase items: {}", e))?;

    // Insert new items
    for (product_id, unit_id, per_price, amount) in items {
        let total = per_price * amount;
        let insert_item_sql = "INSERT INTO purchase_items (purchase_id, product_id, unit_id, per_price, amount, total) VALUES (?, ?, ?, ?, ?, ?)";
        db.execute(insert_item_sql, &[
            &id as &dyn rusqlite::ToSql,
            &product_id as &dyn rusqlite::ToSql,
            &unit_id as &dyn rusqlite::ToSql,
            &per_price as &dyn rusqlite::ToSql,
            &amount as &dyn rusqlite::ToSql,
            &total as &dyn rusqlite::ToSql,
        ])
            .map_err(|e| format!("Failed to insert purchase item: {}", e))?;
    }

    // Get the updated purchase
    let purchase_sql = "SELECT id, supplier_id, date, notes, total_amount, created_at, updated_at FROM purchases WHERE id = ?";
    let purchases = db
        .query(purchase_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(Purchase {
                id: row.get(0)?,
                supplier_id: row.get(1)?,
                date: row.get(2)?,
                notes: row.get(3)?,
                total_amount: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| format!("Failed to fetch purchase: {}", e))?;

    if let Some(purchase) = purchases.first() {
        Ok(purchase.clone())
    } else {
        Err("Failed to retrieve updated purchase".to_string())
    }
}

/// Delete a purchase (items will be deleted automatically due to CASCADE)
#[tauri::command]
fn delete_purchase(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let delete_sql = "DELETE FROM purchases WHERE id = ?";
    db.execute(delete_sql, &[&id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to delete purchase: {}", e))?;

    Ok("Purchase deleted successfully".to_string())
}

/// Create a purchase item (standalone, for adding items to existing purchase)
#[tauri::command]
fn create_purchase_item(
    db_state: State<'_, Mutex<Option<Database>>>,
    purchase_id: i64,
    product_id: i64,
    unit_id: i64,
    per_price: f64,
    amount: f64,
) -> Result<PurchaseItem, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let total = per_price * amount;

    let insert_sql = "INSERT INTO purchase_items (purchase_id, product_id, unit_id, per_price, amount, total) VALUES (?, ?, ?, ?, ?, ?)";
    db.execute(insert_sql, &[
        &purchase_id as &dyn rusqlite::ToSql,
        &product_id as &dyn rusqlite::ToSql,
        &unit_id as &dyn rusqlite::ToSql,
        &per_price as &dyn rusqlite::ToSql,
        &amount as &dyn rusqlite::ToSql,
        &total as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to insert purchase item: {}", e))?;

    // Update purchase total
    let update_purchase_sql = "UPDATE purchases SET total_amount = (SELECT COALESCE(SUM(total), 0) FROM purchase_items WHERE purchase_id = ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    db.execute(update_purchase_sql, &[&purchase_id as &dyn rusqlite::ToSql, &purchase_id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to update purchase total: {}", e))?;

    // Get the created item
    let item_sql = "SELECT id, purchase_id, product_id, unit_id, per_price, amount, total, created_at FROM purchase_items WHERE purchase_id = ? AND product_id = ? ORDER BY id DESC LIMIT 1";
    let items = db
        .query(item_sql, &[&purchase_id as &dyn rusqlite::ToSql, &product_id as &dyn rusqlite::ToSql], |row| {
            Ok(PurchaseItem {
                id: row.get(0)?,
                purchase_id: row.get(1)?,
                product_id: row.get(2)?,
                unit_id: row.get(3)?,
                per_price: row.get(4)?,
                amount: row.get(5)?,
                total: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to fetch purchase item: {}", e))?;

    if let Some(item) = items.first() {
        Ok(item.clone())
    } else {
        Err("Failed to retrieve created purchase item".to_string())
    }
}

/// Get purchase items for a purchase
#[tauri::command]
fn get_purchase_items(db_state: State<'_, Mutex<Option<Database>>>, purchase_id: i64) -> Result<Vec<PurchaseItem>, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let sql = "SELECT id, purchase_id, product_id, unit_id, per_price, amount, total, created_at FROM purchase_items WHERE purchase_id = ? ORDER BY id";
    let items = db
        .query(sql, &[&purchase_id as &dyn rusqlite::ToSql], |row| {
            Ok(PurchaseItem {
                id: row.get(0)?,
                purchase_id: row.get(1)?,
                product_id: row.get(2)?,
                unit_id: row.get(3)?,
                per_price: row.get(4)?,
                amount: row.get(5)?,
                total: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to fetch purchase items: {}", e))?;

    Ok(items)
}

/// Update a purchase item
#[tauri::command]
fn update_purchase_item(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
    product_id: i64,
    unit_id: i64,
    per_price: f64,
    amount: f64,
) -> Result<PurchaseItem, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let total = per_price * amount;

    let update_sql = "UPDATE purchase_items SET product_id = ?, unit_id = ?, per_price = ?, amount = ?, total = ? WHERE id = ?";
    db.execute(update_sql, &[
        &product_id as &dyn rusqlite::ToSql,
        &unit_id as &dyn rusqlite::ToSql,
        &per_price as &dyn rusqlite::ToSql,
        &amount as &dyn rusqlite::ToSql,
        &total as &dyn rusqlite::ToSql,
        &id as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to update purchase item: {}", e))?;

    // Get purchase_id to update purchase total
    let purchase_id_sql = "SELECT purchase_id FROM purchase_items WHERE id = ?";
    let purchase_ids = db
        .query(purchase_id_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(row.get::<_, i64>(0)?)
        })
        .map_err(|e| format!("Failed to fetch purchase_id: {}", e))?;

    if let Some(purchase_id) = purchase_ids.first() {
        // Update purchase total
        let update_purchase_sql = "UPDATE purchases SET total_amount = (SELECT COALESCE(SUM(total), 0) FROM purchase_items WHERE purchase_id = ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?";
        db.execute(update_purchase_sql, &[purchase_id as &dyn rusqlite::ToSql, purchase_id as &dyn rusqlite::ToSql])
            .map_err(|e| format!("Failed to update purchase total: {}", e))?;
    }

    // Get the updated item
    let item_sql = "SELECT id, purchase_id, product_id, unit_id, per_price, amount, total, created_at FROM purchase_items WHERE id = ?";
    let items = db
        .query(item_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(PurchaseItem {
                id: row.get(0)?,
                purchase_id: row.get(1)?,
                product_id: row.get(2)?,
                unit_id: row.get(3)?,
                per_price: row.get(4)?,
                amount: row.get(5)?,
                total: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to fetch purchase item: {}", e))?;

    if let Some(item) = items.first() {
        Ok(item.clone())
    } else {
        Err("Failed to retrieve updated purchase item".to_string())
    }
}

/// Delete a purchase item
#[tauri::command]
fn delete_purchase_item(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Get purchase_id before deleting
    let purchase_id_sql = "SELECT purchase_id FROM purchase_items WHERE id = ?";
    let purchase_ids = db
        .query(purchase_id_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(row.get::<_, i64>(0)?)
        })
        .map_err(|e| format!("Failed to fetch purchase_id: {}", e))?;

    let purchase_id = purchase_ids.first().ok_or("Purchase item not found")?;

    let delete_sql = "DELETE FROM purchase_items WHERE id = ?";
    db.execute(delete_sql, &[&id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to delete purchase item: {}", e))?;

    // Update purchase total
    let update_purchase_sql = "UPDATE purchases SET total_amount = (SELECT COALESCE(SUM(total), 0) FROM purchase_items WHERE purchase_id = ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    db.execute(update_purchase_sql, &[purchase_id as &dyn rusqlite::ToSql, purchase_id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to update purchase total: {}", e))?;

    Ok("Purchase item deleted successfully".to_string())
}

// Sale Model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sale {
    pub id: i64,
    pub customer_id: i64,
    pub date: String,
    pub notes: Option<String>,
    pub total_amount: f64,
    pub paid_amount: f64,
    pub created_at: String,
    pub updated_at: String,
}

// SaleItem Model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaleItem {
    pub id: i64,
    pub sale_id: i64,
    pub product_id: i64,
    pub unit_id: i64,
    pub per_price: f64,
    pub amount: f64,
    pub total: f64,
    pub created_at: String,
}

// SalePayment Model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SalePayment {
    pub id: i64,
    pub sale_id: i64,
    pub amount: f64,
    pub date: String,
    pub created_at: String,
}

/// Initialize sales table schema
#[tauri::command]
fn init_sales_table(db_state: State<'_, Mutex<Option<Database>>>) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let create_table_sql = "
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            notes TEXT,
            total_amount REAL NOT NULL DEFAULT 0,
            paid_amount REAL NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
    ";

    db.execute(create_table_sql, &[])
        .map_err(|e| format!("Failed to create sales table: {}", e))?;

    let create_items_table_sql = "
        CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            unit_id INTEGER NOT NULL,
            per_price REAL NOT NULL,
            amount REAL NOT NULL,
            total REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id),
            FOREIGN KEY (unit_id) REFERENCES units(id)
        )
    ";

    db.execute(create_items_table_sql, &[])
        .map_err(|e| format!("Failed to create sale_items table: {}", e))?;

    let create_payments_table_sql = "
        CREATE TABLE IF NOT EXISTS sale_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            date TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
        )
    ";

    db.execute(create_payments_table_sql, &[])
        .map_err(|e| format!("Failed to create sale_payments table: {}", e))?;

    Ok("Sales, sale_items, and sale_payments tables initialized successfully".to_string())
}

/// Create a new sale with items
#[tauri::command]
fn create_sale(
    db_state: State<'_, Mutex<Option<Database>>>,
    customer_id: i64,
    date: String,
    notes: Option<String>,
    paid_amount: f64,
    items: Vec<(i64, i64, f64, f64)>, // (product_id, unit_id, per_price, amount)
) -> Result<Sale, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Calculate total amount from items
    let total_amount: f64 = items.iter().map(|(_, _, per_price, amount)| per_price * amount).sum();

    // Insert sale
    let notes_str: Option<&str> = notes.as_ref().map(|s| s.as_str());
    let insert_sql = "INSERT INTO sales (customer_id, date, notes, total_amount, paid_amount) VALUES (?, ?, ?, ?, ?)";
    db.execute(insert_sql, &[
        &customer_id as &dyn rusqlite::ToSql,
        &date as &dyn rusqlite::ToSql,
        &notes_str as &dyn rusqlite::ToSql,
        &total_amount as &dyn rusqlite::ToSql,
        &paid_amount as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to insert sale: {}", e))?;

    // Get the created sale ID
    let sale_id_sql = "SELECT id FROM sales WHERE customer_id = ? AND date = ? ORDER BY id DESC LIMIT 1";
    let sale_ids = db
        .query(sale_id_sql, &[&customer_id as &dyn rusqlite::ToSql, &date as &dyn rusqlite::ToSql], |row| {
            Ok(row.get::<_, i64>(0)?)
        })
        .map_err(|e| format!("Failed to fetch sale ID: {}", e))?;

    let sale_id = sale_ids.first().ok_or("Failed to retrieve sale ID")?;

    // Insert initial payment if paid_amount > 0
    if paid_amount > 0.0 {
        let insert_payment_sql = "INSERT INTO sale_payments (sale_id, amount, date) VALUES (?, ?, ?)";
        db.execute(insert_payment_sql, &[
            sale_id as &dyn rusqlite::ToSql,
            &paid_amount as &dyn rusqlite::ToSql,
            &date as &dyn rusqlite::ToSql,
        ])
            .map_err(|e| format!("Failed to insert initial payment: {}", e))?;
    }

    // Insert sale items
    for (product_id, unit_id, per_price, amount) in items {
        let total = per_price * amount;
        let insert_item_sql = "INSERT INTO sale_items (sale_id, product_id, unit_id, per_price, amount, total) VALUES (?, ?, ?, ?, ?, ?)";
        db.execute(insert_item_sql, &[
            sale_id as &dyn rusqlite::ToSql,
            &product_id as &dyn rusqlite::ToSql,
            &unit_id as &dyn rusqlite::ToSql,
            &per_price as &dyn rusqlite::ToSql,
            &amount as &dyn rusqlite::ToSql,
            &total as &dyn rusqlite::ToSql,
        ])
            .map_err(|e| format!("Failed to insert sale item: {}", e))?;
    }

    // Get the created sale
    let sale_sql = "SELECT id, customer_id, date, notes, total_amount, paid_amount, created_at, updated_at FROM sales WHERE id = ?";
    let sales = db
        .query(sale_sql, &[sale_id as &dyn rusqlite::ToSql], |row| {
            Ok(Sale {
                id: row.get(0)?,
                customer_id: row.get(1)?,
                date: row.get(2)?,
                notes: row.get(3)?,
                total_amount: row.get(4)?,
                paid_amount: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to fetch sale: {}", e))?;

    if let Some(sale) = sales.first() {
        Ok(sale.clone())
    } else {
        Err("Failed to retrieve created sale".to_string())
    }
}

/// Get all sales with pagination
#[tauri::command]
fn get_sales(
    db_state: State<'_, Mutex<Option<Database>>>,
    page: i64,
    per_page: i64,
    search: Option<String>,
    sort_by: Option<String>,
    sort_order: Option<String>,
) -> Result<PaginatedResponse<Sale>, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let offset = (page - 1) * per_page;

    // Build WHERE clause
    let mut where_clause = String::new();
    let mut params: Vec<serde_json::Value> = Vec::new();

    if let Some(s) = search {
        if !s.trim().is_empty() {
            let search_term = format!("%{}%", s);
            where_clause = "WHERE (CAST(s.date AS TEXT) LIKE ? OR s.notes LIKE ? OR s.customer_id IN (SELECT id FROM customers WHERE full_name LIKE ? OR phone LIKE ?))".to_string();
            params.push(serde_json::Value::String(search_term.clone()));
            params.push(serde_json::Value::String(search_term.clone()));
            params.push(serde_json::Value::String(search_term.clone()));
            params.push(serde_json::Value::String(search_term));
        }
    }

    // Get total count
    let count_sql = format!("SELECT COUNT(*) FROM sales s {}", where_clause);
    let total: i64 = db.with_connection(|conn| {
        let mut stmt = conn.prepare(&count_sql).map_err(|e| anyhow::anyhow!("{}", e))?;
        let rusqlite_params: Vec<rusqlite::types::Value> = params.iter().map(|v| {
            match v {
                serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                _ => rusqlite::types::Value::Null,
            }
        }).collect();
        let count: i64 = stmt.query_row(rusqlite::params_from_iter(rusqlite_params.iter()), |row| row.get(0))
            .map_err(|e| anyhow::anyhow!("{}", e))?;
        Ok(count)
    }).map_err(|e| format!("Failed to count sales: {}", e))?;

    // Build Order By
    let order_clause = if let Some(sort) = sort_by {
        let order = sort_order.unwrap_or_else(|| "DESC".to_string());
        let allowed_cols = ["date", "total_amount", "paid_amount", "created_at"];
        if allowed_cols.contains(&sort.as_str()) {
            format!("ORDER BY s.{} {}", sort, if order.to_uppercase() == "DESC" { "DESC" } else { "ASC" })
        } else {
            "ORDER BY s.date DESC, s.created_at DESC".to_string()
        }
    } else {
        "ORDER BY s.date DESC, s.created_at DESC".to_string()
    };

    let sql = format!("SELECT s.id, s.customer_id, s.date, s.notes, s.total_amount, s.paid_amount, s.created_at, s.updated_at FROM sales s {} {} LIMIT ? OFFSET ?", where_clause, order_clause);
    
    params.push(serde_json::Value::Number(serde_json::Number::from(per_page)));
    params.push(serde_json::Value::Number(serde_json::Number::from(offset)));

    let sales = db.with_connection(|conn| {
        let mut stmt = conn.prepare(&sql).map_err(|e| anyhow::anyhow!("{}", e))?;
        let rusqlite_params: Vec<rusqlite::types::Value> = params.iter().map(|v| {
            match v {
                serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                serde_json::Value::Number(n) => rusqlite::types::Value::Integer(n.as_i64().unwrap_or(0)),
                _ => rusqlite::types::Value::Null,
            }
        }).collect();

        let rows = stmt.query_map(rusqlite::params_from_iter(rusqlite_params.iter()), |row| {
            Ok(Sale {
                id: row.get(0)?,
                customer_id: row.get(1)?,
                date: row.get(2)?,
                notes: row.get::<_, Option<String>>(3)?,
                total_amount: row.get(4)?,
                paid_amount: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        }).map_err(|e| anyhow::anyhow!("{}", e))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| anyhow::anyhow!("{}", e))?);
        }
        Ok(result)
    }).map_err(|e| format!("Failed to fetch sales: {}", e))?;

    let total_pages = (total as f64 / per_page as f64).ceil() as i64;
    
    Ok(PaginatedResponse {
        items: sales,
        total,
        page,
        per_page,
        total_pages,
    })
}

/// Get a single sale with its items
#[tauri::command]
fn get_sale(db_state: State<'_, Mutex<Option<Database>>>, id: i64) -> Result<(Sale, Vec<SaleItem>), String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Get sale
    let sale_sql = "SELECT id, customer_id, date, notes, total_amount, paid_amount, created_at, updated_at FROM sales WHERE id = ?";
    let sales = db
        .query(sale_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(Sale {
                id: row.get(0)?,
                customer_id: row.get(1)?,
                date: row.get(2)?,
                notes: row.get(3)?,
                total_amount: row.get(4)?,
                paid_amount: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to fetch sale: {}", e))?;

    let sale = sales.first().ok_or("Sale not found")?;

    // Get sale items
    let items_sql = "SELECT id, sale_id, product_id, unit_id, per_price, amount, total, created_at FROM sale_items WHERE sale_id = ?";
    let items = db
        .query(items_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(SaleItem {
                id: row.get(0)?,
                sale_id: row.get(1)?,
                product_id: row.get(2)?,
                unit_id: row.get(3)?,
                per_price: row.get(4)?,
                amount: row.get(5)?,
                total: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to fetch sale items: {}", e))?;

    Ok((sale.clone(), items))
}

/// Update a sale
#[tauri::command]
fn update_sale(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
    customer_id: i64,
    date: String,
    notes: Option<String>,
    _paid_amount: f64, // Ignored, handled by payments table
    items: Vec<(i64, i64, f64, f64)>, // (product_id, unit_id, per_price, amount)
) -> Result<Sale, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Calculate total amount from items
    let total_amount: f64 = items.iter().map(|(_, _, per_price, amount)| per_price * amount).sum();

    // Update sale (excluding paid_amount)
    let notes_str: Option<&str> = notes.as_ref().map(|s| s.as_str());
    let update_sql = "UPDATE sales SET customer_id = ?, date = ?, notes = ?, total_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    db.execute(update_sql, &[
        &customer_id as &dyn rusqlite::ToSql,
        &date as &dyn rusqlite::ToSql,
        &notes_str as &dyn rusqlite::ToSql,
        &total_amount as &dyn rusqlite::ToSql,
        &id as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to update sale: {}", e))?;

    // Delete existing items
    let delete_items_sql = "DELETE FROM sale_items WHERE sale_id = ?";
    db.execute(delete_items_sql, &[&id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to delete sale items: {}", e))?;

    // Insert new items
    for (product_id, unit_id, per_price, amount) in items {
        let total = per_price * amount;
        let insert_item_sql = "INSERT INTO sale_items (sale_id, product_id, unit_id, per_price, amount, total) VALUES (?, ?, ?, ?, ?, ?)";
        db.execute(insert_item_sql, &[
            &id as &dyn rusqlite::ToSql,
            &product_id as &dyn rusqlite::ToSql,
            &unit_id as &dyn rusqlite::ToSql,
            &per_price as &dyn rusqlite::ToSql,
            &amount as &dyn rusqlite::ToSql,
            &total as &dyn rusqlite::ToSql,
        ])
            .map_err(|e| format!("Failed to insert sale item: {}", e))?;
    }

    // Get the updated sale
    let sale_sql = "SELECT id, customer_id, date, notes, total_amount, paid_amount, created_at, updated_at FROM sales WHERE id = ?";
    let sales = db
        .query(sale_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(Sale {
                id: row.get(0)?,
                customer_id: row.get(1)?,
                date: row.get(2)?,
                notes: row.get(3)?,
                total_amount: row.get(4)?,
                paid_amount: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to fetch sale: {}", e))?;

    if let Some(sale) = sales.first() {
        Ok(sale.clone())
    } else {
        Err("Failed to retrieve updated sale".to_string())
    }
}

/// Delete a sale (items will be deleted automatically due to CASCADE)
#[tauri::command]
fn delete_sale(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let delete_sql = "DELETE FROM sales WHERE id = ?";
    db.execute(delete_sql, &[&id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to delete sale: {}", e))?;

    Ok("Sale deleted successfully".to_string())
}

/// Create a sale item (standalone, for adding items to existing sale)
#[tauri::command]
fn create_sale_item(
    db_state: State<'_, Mutex<Option<Database>>>,
    sale_id: i64,
    product_id: i64,
    unit_id: i64,
    per_price: f64,
    amount: f64,
) -> Result<SaleItem, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let total = per_price * amount;

    let insert_sql = "INSERT INTO sale_items (sale_id, product_id, unit_id, per_price, amount, total) VALUES (?, ?, ?, ?, ?, ?)";
    db.execute(insert_sql, &[
        &sale_id as &dyn rusqlite::ToSql,
        &product_id as &dyn rusqlite::ToSql,
        &unit_id as &dyn rusqlite::ToSql,
        &per_price as &dyn rusqlite::ToSql,
        &amount as &dyn rusqlite::ToSql,
        &total as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to insert sale item: {}", e))?;

    // Update sale total
    let update_sale_sql = "UPDATE sales SET total_amount = (SELECT COALESCE(SUM(total), 0) FROM sale_items WHERE sale_id = ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    db.execute(update_sale_sql, &[&sale_id as &dyn rusqlite::ToSql, &sale_id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to update sale total: {}", e))?;

    // Get the created item
    let item_sql = "SELECT id, sale_id, product_id, unit_id, per_price, amount, total, created_at FROM sale_items WHERE sale_id = ? AND product_id = ? ORDER BY id DESC LIMIT 1";
    let items = db
        .query(item_sql, &[&sale_id as &dyn rusqlite::ToSql, &product_id as &dyn rusqlite::ToSql], |row| {
            Ok(SaleItem {
                id: row.get(0)?,
                sale_id: row.get(1)?,
                product_id: row.get(2)?,
                unit_id: row.get(3)?,
                per_price: row.get(4)?,
                amount: row.get(5)?,
                total: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to fetch sale item: {}", e))?;

    if let Some(item) = items.first() {
        Ok(item.clone())
    } else {
        Err("Failed to retrieve created sale item".to_string())
    }
}

/// Get sale items for a sale
#[tauri::command]
fn get_sale_items(db_state: State<'_, Mutex<Option<Database>>>, sale_id: i64) -> Result<Vec<SaleItem>, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let sql = "SELECT id, sale_id, product_id, unit_id, per_price, amount, total, created_at FROM sale_items WHERE sale_id = ? ORDER BY id";
    let items = db
        .query(sql, &[&sale_id as &dyn rusqlite::ToSql], |row| {
            Ok(SaleItem {
                id: row.get(0)?,
                sale_id: row.get(1)?,
                product_id: row.get(2)?,
                unit_id: row.get(3)?,
                per_price: row.get(4)?,
                amount: row.get(5)?,
                total: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to fetch sale items: {}", e))?;

    Ok(items)
}

/// Update a sale item
#[tauri::command]
fn update_sale_item(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
    product_id: i64,
    unit_id: i64,
    per_price: f64,
    amount: f64,
) -> Result<SaleItem, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let total = per_price * amount;

    let update_sql = "UPDATE sale_items SET product_id = ?, unit_id = ?, per_price = ?, amount = ?, total = ? WHERE id = ?";
    db.execute(update_sql, &[
        &product_id as &dyn rusqlite::ToSql,
        &unit_id as &dyn rusqlite::ToSql,
        &per_price as &dyn rusqlite::ToSql,
        &amount as &dyn rusqlite::ToSql,
        &total as &dyn rusqlite::ToSql,
        &id as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to update sale item: {}", e))?;

    // Get sale_id to update sale total
    let sale_id_sql = "SELECT sale_id FROM sale_items WHERE id = ?";
    let sale_ids = db
        .query(sale_id_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(row.get::<_, i64>(0)?)
        })
        .map_err(|e| format!("Failed to fetch sale_id: {}", e))?;

    if let Some(sale_id) = sale_ids.first() {
        // Update sale total
        let update_sale_sql = "UPDATE sales SET total_amount = (SELECT COALESCE(SUM(total), 0) FROM sale_items WHERE sale_id = ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?";
        db.execute(update_sale_sql, &[sale_id as &dyn rusqlite::ToSql, sale_id as &dyn rusqlite::ToSql])
            .map_err(|e| format!("Failed to update sale total: {}", e))?;
    }

    // Get the updated item
    let item_sql = "SELECT id, sale_id, product_id, unit_id, per_price, amount, total, created_at FROM sale_items WHERE id = ?";
    let items = db
        .query(item_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(SaleItem {
                id: row.get(0)?,
                sale_id: row.get(1)?,
                product_id: row.get(2)?,
                unit_id: row.get(3)?,
                per_price: row.get(4)?,
                amount: row.get(5)?,
                total: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to fetch sale item: {}", e))?;

    if let Some(item) = items.first() {
        Ok(item.clone())
    } else {
        Err("Failed to retrieve updated sale item".to_string())
    }
}

/// Delete a sale item
#[tauri::command]
fn delete_sale_item(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Get sale_id before deleting
    let sale_id_sql = "SELECT sale_id FROM sale_items WHERE id = ?";
    let sale_ids = db
        .query(sale_id_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(row.get::<_, i64>(0)?)
        })
        .map_err(|e| format!("Failed to fetch sale_id: {}", e))?;

    let sale_id = sale_ids.first().ok_or("Sale item not found")?;

    let delete_sql = "DELETE FROM sale_items WHERE id = ?";
    db.execute(delete_sql, &[&id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to delete sale item: {}", e))?;

    // Update sale total
    let update_sale_sql = "UPDATE sales SET total_amount = (SELECT COALESCE(SUM(total), 0) FROM sale_items WHERE sale_id = ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    db.execute(update_sale_sql, &[sale_id as &dyn rusqlite::ToSql, sale_id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to update sale total: {}", e))?;

    Ok("Sale item deleted successfully".to_string())
}

/// Create a sale payment
#[tauri::command]
fn create_sale_payment(
    db_state: State<'_, Mutex<Option<Database>>>,
    sale_id: i64,
    amount: f64,
    date: String,
) -> Result<SalePayment, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let insert_sql = "INSERT INTO sale_payments (sale_id, amount, date) VALUES (?, ?, ?)";
    db.execute(insert_sql, &[
        &sale_id as &dyn rusqlite::ToSql,
        &amount as &dyn rusqlite::ToSql,
        &date as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to insert sale payment: {}", e))?;

    // Update sale paid_amount
    let update_sale_sql = "UPDATE sales SET paid_amount = (SELECT COALESCE(SUM(amount), 0) FROM sale_payments WHERE sale_id = ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    db.execute(update_sale_sql, &[&sale_id as &dyn rusqlite::ToSql, &sale_id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to update sale paid amount: {}", e))?;

    // Get the created payment
    let payment_sql = "SELECT id, sale_id, amount, date, created_at FROM sale_payments WHERE sale_id = ? ORDER BY id DESC LIMIT 1";
    let payments = db
        .query(payment_sql, &[&sale_id as &dyn rusqlite::ToSql], |row| {
            Ok(SalePayment {
                id: row.get(0)?,
                sale_id: row.get(1)?,
                amount: row.get(2)?,
                date: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| format!("Failed to fetch sale payment: {}", e))?;

    if let Some(payment) = payments.first() {
        Ok(payment.clone())
    } else {
        Err("Failed to retrieve created sale payment".to_string())
    }
}

/// Get payments for a sale
#[tauri::command]
fn get_sale_payments(db_state: State<'_, Mutex<Option<Database>>>, sale_id: i64) -> Result<Vec<SalePayment>, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let sql = "SELECT id, sale_id, amount, date, created_at FROM sale_payments WHERE sale_id = ? ORDER BY date DESC, created_at DESC";
    let payments = db
        .query(sql, &[&sale_id as &dyn rusqlite::ToSql], |row| {
            Ok(SalePayment {
                id: row.get(0)?,
                sale_id: row.get(1)?,
                amount: row.get(2)?,
                date: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| format!("Failed to fetch sale payments: {}", e))?;

    Ok(payments)
}

/// Delete a sale payment
#[tauri::command]
fn delete_sale_payment(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Get sale_id before deleting
    let sale_id_sql = "SELECT sale_id FROM sale_payments WHERE id = ?";
    let sale_ids = db
        .query(sale_id_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(row.get::<_, i64>(0)?)
        })
        .map_err(|e| format!("Failed to fetch sale_id: {}", e))?;

    let sale_id = sale_ids.first().ok_or("Sale payment not found")?;

    let delete_sql = "DELETE FROM sale_payments WHERE id = ?";
    db.execute(delete_sql, &[&id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to delete sale payment: {}", e))?;

    // Update sale paid_amount
    let update_sale_sql = "UPDATE sales SET paid_amount = (SELECT COALESCE(SUM(amount), 0) FROM sale_payments WHERE sale_id = ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    db.execute(update_sale_sql, &[sale_id as &dyn rusqlite::ToSql, sale_id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to update sale paid amount: {}", e))?;

    Ok("Sale payment deleted successfully".to_string())
}

// ExpenseType Model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpenseType {
    pub id: i64,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Initialize expense_types table schema
#[tauri::command]
fn init_expense_types_table(db_state: State<'_, Mutex<Option<Database>>>) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let create_table_sql = "
        CREATE TABLE IF NOT EXISTS expense_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ";

    db.execute(create_table_sql, &[])
        .map_err(|e| format!("Failed to create expense_types table: {}", e))?;

    Ok("Expense types table initialized successfully".to_string())
}

/// Create a new expense type
#[tauri::command]
fn create_expense_type(
    db_state: State<'_, Mutex<Option<Database>>>,
    name: String,
) -> Result<ExpenseType, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Insert new expense type
    let insert_sql = "INSERT INTO expense_types (name) VALUES (?)";
    db.execute(insert_sql, &[&name as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to insert expense type: {}", e))?;

    // Get the created expense type
    let expense_type_sql = "SELECT id, name, created_at, updated_at FROM expense_types WHERE name = ?";
    let expense_types = db
        .query(expense_type_sql, &[&name as &dyn rusqlite::ToSql], |row| {
            Ok(ExpenseType {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to fetch expense type: {}", e))?;

    if let Some(expense_type) = expense_types.first() {
        Ok(expense_type.clone())
    } else {
        Err("Failed to retrieve created expense type".to_string())
    }
}

/// Get all expense types
#[tauri::command]
fn get_expense_types(db_state: State<'_, Mutex<Option<Database>>>) -> Result<Vec<ExpenseType>, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let sql = "SELECT id, name, created_at, updated_at FROM expense_types ORDER BY name ASC";
    let expense_types = db
        .query(sql, &[], |row| {
            Ok(ExpenseType {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to fetch expense types: {}", e))?;

    Ok(expense_types)
}

/// Update an expense type
#[tauri::command]
fn update_expense_type(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
    name: String,
) -> Result<ExpenseType, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Update expense type
    let update_sql = "UPDATE expense_types SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    db.execute(update_sql, &[&name as &dyn rusqlite::ToSql, &id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to update expense type: {}", e))?;

    // Get the updated expense type
    let expense_type_sql = "SELECT id, name, created_at, updated_at FROM expense_types WHERE id = ?";
    let expense_types = db
        .query(expense_type_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(ExpenseType {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to fetch expense type: {}", e))?;

    if let Some(expense_type) = expense_types.first() {
        Ok(expense_type.clone())
    } else {
        Err("Failed to retrieve updated expense type".to_string())
    }
}

/// Delete an expense type
#[tauri::command]
fn delete_expense_type(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let delete_sql = "DELETE FROM expense_types WHERE id = ?";
    db.execute(delete_sql, &[&id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to delete expense type: {}", e))?;

    Ok("Expense type deleted successfully".to_string())
}

// Expense Model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Expense {
    pub id: i64,
    pub expense_type_id: i64,
    pub amount: f64,
    pub currency: String,
    pub rate: f64,
    pub total: f64,
    pub date: String,
    pub bill_no: Option<String>,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Initialize expenses table schema
#[tauri::command]
fn init_expenses_table(db_state: State<'_, Mutex<Option<Database>>>) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // First ensure expense_types table exists
    let create_expense_types_sql = "
        CREATE TABLE IF NOT EXISTS expense_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ";
    db.execute(create_expense_types_sql, &[])
        .map_err(|e| format!("Failed to create expense_types table: {}", e))?;

    // Create expenses table with expense_type_id
    // If table already exists with old schema, we'll handle migration
    let create_table_sql = "
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            expense_type_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL,
            rate REAL NOT NULL DEFAULT 1.0,
            total REAL NOT NULL,
            date TEXT NOT NULL,
            bill_no TEXT,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (expense_type_id) REFERENCES expense_types(id)
        )
    ";
    
    // Try to create the table (will fail silently if it exists)
    let _ = db.execute(create_table_sql, &[]);
    
    // Check if columns exist, if not, try to add them
    let check_column_sql = "PRAGMA table_info(expenses)";
    if let Ok(columns) = db.query(check_column_sql, &[], |row| {
        Ok(row.get::<_, String>(1)?)
    }) {
        let has_expense_type_id = columns.iter().any(|c| c == "expense_type_id");
        let has_bill_no = columns.iter().any(|c| c == "bill_no");
        let has_description = columns.iter().any(|c| c == "description");
        let has_name = columns.iter().any(|c| c == "name");
        
        if !has_expense_type_id && has_name {
            // Old schema detected - add expense_type_id column
            // Note: SQLite doesn't support adding NOT NULL columns to existing tables easily
            // So we'll add it as nullable first, then the app should handle migration
            let add_column_sql = "ALTER TABLE expenses ADD COLUMN expense_type_id INTEGER";
            let _ = db.execute(add_column_sql, &[]);
        }
        
        if !has_bill_no {
            let add_column_sql = "ALTER TABLE expenses ADD COLUMN bill_no TEXT";
            let _ = db.execute(add_column_sql, &[]);
        }
        
        if !has_description {
            let add_column_sql = "ALTER TABLE expenses ADD COLUMN description TEXT";
            let _ = db.execute(add_column_sql, &[]);
        }
    }

    Ok("Expenses table initialized successfully".to_string())
}

/// Create a new expense
#[tauri::command]
fn create_expense(
    db_state: State<'_, Mutex<Option<Database>>>,
    expense_type_id: i64,
    amount: f64,
    currency: String,
    rate: f64,
    total: f64,
    date: String,
    bill_no: Option<String>,
    description: Option<String>,
) -> Result<Expense, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Insert new expense
    let insert_sql = "INSERT INTO expenses (expense_type_id, amount, currency, rate, total, date, bill_no, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    db.execute(insert_sql, &[
        &expense_type_id as &dyn rusqlite::ToSql,
        &amount as &dyn rusqlite::ToSql,
        &currency as &dyn rusqlite::ToSql,
        &rate as &dyn rusqlite::ToSql,
        &total as &dyn rusqlite::ToSql,
        &date as &dyn rusqlite::ToSql,
        &bill_no as &dyn rusqlite::ToSql,
        &description as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to insert expense: {}", e))?;

    // Get the created expense
    let expense_sql = "SELECT id, expense_type_id, amount, currency, rate, total, date, bill_no, description, created_at, updated_at FROM expenses WHERE expense_type_id = ? AND date = ? ORDER BY id DESC LIMIT 1";
    let expenses = db
        .query(expense_sql, &[&expense_type_id as &dyn rusqlite::ToSql, &date as &dyn rusqlite::ToSql], |row| {
            Ok(Expense {
                id: row.get(0)?,
                expense_type_id: row.get(1)?,
                amount: row.get(2)?,
                currency: row.get(3)?,
                rate: row.get(4)?,
                total: row.get(5)?,
                date: row.get(6)?,
                bill_no: row.get(7)?,
                description: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|e| format!("Failed to fetch expense: {}", e))?;

    if let Some(expense) = expenses.first() {
        Ok(expense.clone())
    } else {
        Err("Failed to retrieve created expense".to_string())
    }
}

#[tauri::command]
fn get_expenses(
    db_state: State<'_, Mutex<Option<Database>>>,
    page: i64,
    per_page: i64,
    search: Option<String>,
    sort_by: Option<String>,
    sort_order: Option<String>,
) -> Result<PaginatedResponse<Expense>, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let offset = (page - 1) * per_page;

    // Build WHERE clause
    let mut where_clause = String::new();
    let mut params: Vec<serde_json::Value> = Vec::new();

    if let Some(s) = search {
        if !s.trim().is_empty() {
             let search_term = format!("%{}%", s);
             where_clause = "WHERE (currency LIKE ? OR date LIKE ? OR bill_no LIKE ? OR description LIKE ?)".to_string();
             params.push(serde_json::Value::String(search_term.clone()));
             params.push(serde_json::Value::String(search_term.clone()));
             params.push(serde_json::Value::String(search_term.clone()));
             params.push(serde_json::Value::String(search_term));
        }
    }

    // Get total count
    let count_sql = format!("SELECT COUNT(*) FROM expenses {}", where_clause);
    let total: i64 = db.with_connection(|conn| {
         let mut stmt = conn.prepare(&count_sql).map_err(|e| anyhow::anyhow!("{}", e))?;
         let rusqlite_params: Vec<rusqlite::types::Value> = params.iter().map(|v| {
            match v {
                serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                _ => rusqlite::types::Value::Null,
            }
        }).collect();
         let count: i64 = stmt.query_row(rusqlite::params_from_iter(rusqlite_params.iter()), |row| row.get(0))
             .map_err(|e| anyhow::anyhow!("{}", e))?;
         Ok(count)
    }).map_err(|e| format!("Failed to count expenses: {}", e))?;

    // Build Order By
    let order_clause = if let Some(sort) = sort_by {
        let order = sort_order.unwrap_or_else(|| "ASC".to_string());
        let allowed_cols = ["amount", "currency", "rate", "total", "date", "created_at"];
        if allowed_cols.contains(&sort.as_str()) {
             format!("ORDER BY {} {}", sort, if order.to_uppercase() == "DESC" { "DESC" } else { "ASC" })
        } else {
            "ORDER BY date DESC, created_at DESC".to_string()
        }
    } else {
        "ORDER BY date DESC, created_at DESC".to_string()
    };

    let sql = format!("SELECT id, expense_type_id, amount, currency, rate, total, date, bill_no, description, created_at, updated_at FROM expenses {} {} LIMIT ? OFFSET ?", where_clause, order_clause);
    
    params.push(serde_json::Value::Number(serde_json::Number::from(per_page)));
    params.push(serde_json::Value::Number(serde_json::Number::from(offset)));

    let expenses = db.with_connection(|conn| {
        let mut stmt = conn.prepare(&sql).map_err(|e| anyhow::anyhow!("{}", e))?;
        let rusqlite_params: Vec<rusqlite::types::Value> = params.iter().map(|v| {
             match v {
                serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                serde_json::Value::Number(n) => rusqlite::types::Value::Integer(n.as_i64().unwrap_or(0)),
                _ => rusqlite::types::Value::Null,
            }
        }).collect();

        let rows = stmt.query_map(rusqlite::params_from_iter(rusqlite_params.iter()), |row| {
             Ok(Expense {
                id: row.get(0)?,
                expense_type_id: row.get(1)?,
                amount: row.get(2)?,
                currency: row.get(3)?,
                rate: row.get(4)?,
                total: row.get(5)?,
                date: row.get(6)?,
                bill_no: row.get(7)?,
                description: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        }).map_err(|e| anyhow::anyhow!("{}", e))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| anyhow::anyhow!("{}", e))?);
        }
        Ok(result)
    }).map_err(|e| format!("Failed to fetch expenses: {}", e))?;

    let total_pages = (total as f64 / per_page as f64).ceil() as i64;
    
    Ok(PaginatedResponse {
        items: expenses,
        total,
        page,
        per_page,
        total_pages,
    })
}

/// Get a single expense
#[tauri::command]
fn get_expense(db_state: State<'_, Mutex<Option<Database>>>, id: i64) -> Result<Expense, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let expense_sql = "SELECT id, expense_type_id, amount, currency, rate, total, date, bill_no, description, created_at, updated_at FROM expenses WHERE id = ?";
    let expenses = db
        .query(expense_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(Expense {
                id: row.get(0)?,
                expense_type_id: row.get(1)?,
                amount: row.get(2)?,
                currency: row.get(3)?,
                rate: row.get(4)?,
                total: row.get(5)?,
                date: row.get(6)?,
                bill_no: row.get(7)?,
                description: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|e| format!("Failed to fetch expense: {}", e))?;

    let expense = expenses.first().ok_or("Expense not found")?;
    Ok(expense.clone())
}

/// Update an expense
#[tauri::command]
fn update_expense(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
    expense_type_id: i64,
    amount: f64,
    currency: String,
    rate: f64,
    total: f64,
    date: String,
    bill_no: Option<String>,
    description: Option<String>,
) -> Result<Expense, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Update expense
    let update_sql = "UPDATE expenses SET expense_type_id = ?, amount = ?, currency = ?, rate = ?, total = ?, date = ?, bill_no = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    db.execute(update_sql, &[
        &expense_type_id as &dyn rusqlite::ToSql,
        &amount as &dyn rusqlite::ToSql,
        &currency as &dyn rusqlite::ToSql,
        &rate as &dyn rusqlite::ToSql,
        &total as &dyn rusqlite::ToSql,
        &date as &dyn rusqlite::ToSql,
        &bill_no as &dyn rusqlite::ToSql,
        &description as &dyn rusqlite::ToSql,
        &id as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to update expense: {}", e))?;

    // Get the updated expense
    let expense_sql = "SELECT id, expense_type_id, amount, currency, rate, total, date, bill_no, description, created_at, updated_at FROM expenses WHERE id = ?";
    let expenses = db
        .query(expense_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(Expense {
                id: row.get(0)?,
                expense_type_id: row.get(1)?,
                amount: row.get(2)?,
                currency: row.get(3)?,
                rate: row.get(4)?,
                total: row.get(5)?,
                date: row.get(6)?,
                bill_no: row.get(7)?,
                description: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|e| format!("Failed to fetch expense: {}", e))?;

    if let Some(expense) = expenses.first() {
        Ok(expense.clone())
    } else {
        Err("Failed to retrieve updated expense".to_string())
    }
}

/// Delete an expense
#[tauri::command]
fn delete_expense(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let delete_sql = "DELETE FROM expenses WHERE id = ?";
    db.execute(delete_sql, &[&id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to delete expense: {}", e))?;

    Ok("Expense deleted successfully".to_string())
}

// Employee Model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Employee {
    pub id: i64,
    pub full_name: String,
    pub phone: String,
    pub email: Option<String>,
    pub address: String,
    pub position: Option<String>,
    pub hire_date: Option<String>,
    pub base_salary: Option<f64>,
    pub photo_path: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Initialize employees table schema
#[tauri::command]
fn init_employees_table(db_state: State<'_, Mutex<Option<Database>>>) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let create_table_sql = "
        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT,
            address TEXT NOT NULL,
            position TEXT,
            hire_date TEXT,
            base_salary REAL,
            photo_path TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ";

    db.execute(create_table_sql, &[])
        .map_err(|e| format!("Failed to create employees table: {}", e))?;

    Ok("Employees table initialized successfully".to_string())
}

/// Create a new employee
#[tauri::command]
fn create_employee(
    db_state: State<'_, Mutex<Option<Database>>>,
    full_name: String,
    phone: String,
    email: Option<String>,
    address: String,
    position: Option<String>,
    hire_date: Option<String>,
    base_salary: Option<f64>,
    photo_path: Option<String>,
    notes: Option<String>,
) -> Result<Employee, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Insert new employee
    let insert_sql = "INSERT INTO employees (full_name, phone, email, address, position, hire_date, base_salary, photo_path, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    let email_str: Option<&str> = email.as_ref().map(|s| s.as_str());
    let position_str: Option<&str> = position.as_ref().map(|s| s.as_str());
    let hire_date_str: Option<&str> = hire_date.as_ref().map(|s| s.as_str());
    let photo_path_str: Option<&str> = photo_path.as_ref().map(|s| s.as_str());
    let notes_str: Option<&str> = notes.as_ref().map(|s| s.as_str());
    
    db.execute(insert_sql, &[
        &full_name as &dyn rusqlite::ToSql,
        &phone as &dyn rusqlite::ToSql,
        &email_str as &dyn rusqlite::ToSql,
        &address as &dyn rusqlite::ToSql,
        &position_str as &dyn rusqlite::ToSql,
        &hire_date_str as &dyn rusqlite::ToSql,
        &base_salary as &dyn rusqlite::ToSql,
        &photo_path_str as &dyn rusqlite::ToSql,
        &notes_str as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to insert employee: {}", e))?;

    // Get the created employee
    let employee_sql = "SELECT id, full_name, phone, email, address, position, hire_date, base_salary, photo_path, notes, created_at, updated_at FROM employees WHERE full_name = ? AND phone = ? ORDER BY id DESC LIMIT 1";
    let employees = db
        .query(employee_sql, &[&full_name as &dyn rusqlite::ToSql, &phone as &dyn rusqlite::ToSql], |row| {
            Ok(Employee {
                id: row.get(0)?,
                full_name: row.get(1)?,
                phone: row.get(2)?,
                email: row.get::<_, Option<String>>(3)?,
                address: row.get(4)?,
                position: row.get::<_, Option<String>>(5)?,
                hire_date: row.get::<_, Option<String>>(6)?,
                base_salary: row.get::<_, Option<f64>>(7)?,
                photo_path: row.get::<_, Option<String>>(8)?,
                notes: row.get::<_, Option<String>>(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| format!("Failed to fetch employee: {}", e))?;

    if let Some(employee) = employees.first() {
        Ok(employee.clone())
    } else {
        Err("Failed to retrieve created employee".to_string())
    }
}

/// Get all employees
#[tauri::command]
fn get_employees(
    db_state: State<'_, Mutex<Option<Database>>>,
    page: i64,
    per_page: i64,
    search: Option<String>,
    sort_by: Option<String>,
    sort_order: Option<String>,
) -> Result<PaginatedResponse<Employee>, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let offset = (page - 1) * per_page;
    
    // Build WHERE clause
    let mut where_clause = String::new();
    let mut params: Vec<serde_json::Value> = Vec::new();

    if let Some(s) = search {
        if !s.trim().is_empty() {
            let search_term = format!("%{}%", s);
            where_clause = "WHERE (full_name LIKE ? OR phone LIKE ? OR email LIKE ? OR position LIKE ?)".to_string();
            params.push(serde_json::Value::String(search_term.clone())); // full_name
            params.push(serde_json::Value::String(search_term.clone())); // phone
            params.push(serde_json::Value::String(search_term.clone())); // email
            params.push(serde_json::Value::String(search_term)); // position
        }
    }

    // Get total count
    let count_sql = format!("SELECT COUNT(*) FROM employees {}", where_clause);
    // We need to use db_query logic here or similar. 
    // Since we are inside the lib, we can access db.query directly if we construct params correctly.
    // But db.query uses `rusqlite::ToSql`. `params` above are `serde_json::Value`.
    // Let's reuse the logic from `db_query` or just implement it here cleanly.
    
    // We'll reimplement a simple query wrapper here for the count since strict ownership is annoying
    let total: i64 = db.with_connection(|conn| {
        let mut stmt = conn.prepare(&count_sql).map_err(|e| anyhow::anyhow!("{}", e))?;
        
        // Convert json params to sqlite params
        let rusqlite_params: Vec<rusqlite::types::Value> = params.iter().map(|v| {
            match v {
                serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                _ => rusqlite::types::Value::Null, // simplified for search which is only string
            }
        }).collect();

        let count: i64 = stmt.query_row(rusqlite::params_from_iter(rusqlite_params.iter()), |row| row.get(0))
             .map_err(|e| anyhow::anyhow!("{}", e))?;
        Ok(count)
    }).map_err(|e| format!("Failed to count employees: {}", e))?;

    // Build Order By
    let order_clause = if let Some(sort) = sort_by {
        let order = sort_order.unwrap_or_else(|| "ASC".to_string());
        // Validate sort column to prevent injection (basic check)
        let allowed_cols = ["full_name", "phone", "email", "address", "position", "hire_date", "base_salary", "created_at"];
        if allowed_cols.contains(&sort.as_str()) {
             format!("ORDER BY {} {}", sort, if order.to_uppercase() == "DESC" { "DESC" } else { "ASC" })
        } else {
            "ORDER BY created_at DESC".to_string()
        }
    } else {
        "ORDER BY created_at DESC".to_string()
    };

    let sql = format!("SELECT id, full_name, phone, email, address, position, hire_date, base_salary, photo_path, notes, created_at, updated_at FROM employees {} {} LIMIT ? OFFSET ?", where_clause, order_clause);

    // Add pagination params
    params.push(serde_json::Value::Number(serde_json::Number::from(per_page)));
    params.push(serde_json::Value::Number(serde_json::Number::from(offset)));

    let employees = db.with_connection(|conn| {
        let mut stmt = conn.prepare(&sql).map_err(|e| anyhow::anyhow!("{}", e))?;
        
        let rusqlite_params: Vec<rusqlite::types::Value> = params.iter().map(|v| {
            match v {
                serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                serde_json::Value::Number(n) => rusqlite::types::Value::Integer(n.as_i64().unwrap_or(0)),
                _ => rusqlite::types::Value::Null,
            }
        }).collect();

        let rows = stmt.query_map(rusqlite::params_from_iter(rusqlite_params.iter()), |row| {
             Ok(Employee {
                id: row.get(0)?,
                full_name: row.get(1)?,
                phone: row.get(2)?,
                email: row.get::<_, Option<String>>(3)?,
                address: row.get(4)?,
                position: row.get::<_, Option<String>>(5)?,
                hire_date: row.get::<_, Option<String>>(6)?,
                base_salary: row.get::<_, Option<f64>>(7)?,
                photo_path: row.get::<_, Option<String>>(8)?,
                notes: row.get::<_, Option<String>>(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        }).map_err(|e| anyhow::anyhow!("{}", e))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| anyhow::anyhow!("{}", e))?);
        }
        Ok(result)
    }).map_err(|e| format!("Failed to fetch employees: {}", e))?;

    let total_pages = (total as f64 / per_page as f64).ceil() as i64;

    Ok(PaginatedResponse {
        items: employees,
        total,
        page,
        per_page,
        total_pages,
    })
}

/// Get employee by ID
#[tauri::command]
fn get_employee(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
) -> Result<Employee, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let sql = "SELECT id, full_name, phone, email, address, position, hire_date, base_salary, photo_path, notes, created_at, updated_at FROM employees WHERE id = ?";
    let employees = db
        .query(sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(Employee {
                id: row.get(0)?,
                full_name: row.get(1)?,
                phone: row.get(2)?,
                email: row.get::<_, Option<String>>(3)?,
                address: row.get(4)?,
                position: row.get::<_, Option<String>>(5)?,
                hire_date: row.get::<_, Option<String>>(6)?,
                base_salary: row.get::<_, Option<f64>>(7)?,
                photo_path: row.get::<_, Option<String>>(8)?,
                notes: row.get::<_, Option<String>>(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| format!("Failed to fetch employee: {}", e))?;

    if let Some(employee) = employees.first() {
        Ok(employee.clone())
    } else {
        Err("Employee not found".to_string())
    }
}

/// Update an employee
#[tauri::command]
fn update_employee(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
    full_name: String,
    phone: String,
    email: Option<String>,
    address: String,
    position: Option<String>,
    hire_date: Option<String>,
    base_salary: Option<f64>,
    photo_path: Option<String>,
    notes: Option<String>,
) -> Result<Employee, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Update employee
    let update_sql = "UPDATE employees SET full_name = ?, phone = ?, email = ?, address = ?, position = ?, hire_date = ?, base_salary = ?, photo_path = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    let email_str: Option<&str> = email.as_ref().map(|s| s.as_str());
    let position_str: Option<&str> = position.as_ref().map(|s| s.as_str());
    let hire_date_str: Option<&str> = hire_date.as_ref().map(|s| s.as_str());
    let photo_path_str: Option<&str> = photo_path.as_ref().map(|s| s.as_str());
    let notes_str: Option<&str> = notes.as_ref().map(|s| s.as_str());
    
    db.execute(update_sql, &[
        &full_name as &dyn rusqlite::ToSql,
        &phone as &dyn rusqlite::ToSql,
        &email_str as &dyn rusqlite::ToSql,
        &address as &dyn rusqlite::ToSql,
        &position_str as &dyn rusqlite::ToSql,
        &hire_date_str as &dyn rusqlite::ToSql,
        &base_salary as &dyn rusqlite::ToSql,
        &photo_path_str as &dyn rusqlite::ToSql,
        &notes_str as &dyn rusqlite::ToSql,
        &id as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to update employee: {}", e))?;

    // Get the updated employee
    let employee_sql = "SELECT id, full_name, phone, email, address, position, hire_date, base_salary, photo_path, notes, created_at, updated_at FROM employees WHERE id = ?";
    let employees = db
        .query(employee_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(Employee {
                id: row.get(0)?,
                full_name: row.get(1)?,
                phone: row.get(2)?,
                email: row.get::<_, Option<String>>(3)?,
                address: row.get(4)?,
                position: row.get::<_, Option<String>>(5)?,
                hire_date: row.get::<_, Option<String>>(6)?,
                base_salary: row.get::<_, Option<f64>>(7)?,
                photo_path: row.get::<_, Option<String>>(8)?,
                notes: row.get::<_, Option<String>>(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| format!("Failed to fetch employee: {}", e))?;

    if let Some(employee) = employees.first() {
        Ok(employee.clone())
    } else {
        Err("Failed to retrieve updated employee".to_string())
    }
}

/// Delete an employee
#[tauri::command]
fn delete_employee(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let delete_sql = "DELETE FROM employees WHERE id = ?";
    db.execute(delete_sql, &[&id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to delete employee: {}", e))?;

    Ok("Employee deleted successfully".to_string())
}

// Salary Model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Salary {
    pub id: i64,
    pub employee_id: i64,
    pub year: i32,
    pub month: String, // Dari month name like حمل, ثور
    pub amount: f64,
    pub deductions: f64,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Initialize salaries table schema
#[tauri::command]
fn init_salaries_table(db_state: State<'_, Mutex<Option<Database>>>) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Create table if it doesn't exist
    let create_table_sql = "
        CREATE TABLE IF NOT EXISTS salaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            year INTEGER NOT NULL,
            month TEXT NOT NULL,
            amount REAL NOT NULL,
            deductions REAL NOT NULL DEFAULT 0,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
            UNIQUE(employee_id, year, month)
        )
    ";
    db.execute(create_table_sql, &[])
        .map_err(|e| format!("Failed to create salaries table: {}", e))?;

    // Check if deductions column exists, if not add it
    let check_column_sql = "PRAGMA table_info(salaries)";
    if let Ok(columns) = db.query(check_column_sql, &[], |row| {
        Ok(row.get::<_, String>(1)?)
    }) {
        let has_deductions = columns.iter().any(|c| c == "deductions");
        if !has_deductions {
            // Add deductions column
            let add_column_sql = "ALTER TABLE salaries ADD COLUMN deductions REAL NOT NULL DEFAULT 0";
            let _ = db.execute(add_column_sql, &[]);
        }
    }

    db.execute(create_table_sql, &[])
        .map_err(|e| format!("Failed to create salaries table: {}", e))?;

    Ok("Salaries table initialized successfully".to_string())
}

/// Create a new salary
#[tauri::command]
fn create_salary(
    db_state: State<'_, Mutex<Option<Database>>>,
    employee_id: i64,
    year: i32,
    month: String,
    amount: f64,
    deductions: f64,
    notes: Option<String>,
) -> Result<Salary, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Insert new salary
    let insert_sql = "INSERT INTO salaries (employee_id, year, month, amount, deductions, notes) VALUES (?, ?, ?, ?, ?, ?)";
    let notes_str: Option<&str> = notes.as_ref().map(|s| s.as_str());
    
    db.execute(insert_sql, &[
        &employee_id as &dyn rusqlite::ToSql,
        &year as &dyn rusqlite::ToSql,
        &month as &dyn rusqlite::ToSql,
        &amount as &dyn rusqlite::ToSql,
        &deductions as &dyn rusqlite::ToSql,
        &notes_str as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to insert salary: {}", e))?;

    // Get the created salary
    let salary_sql = "SELECT id, employee_id, year, month, amount, deductions, notes, created_at, updated_at FROM salaries WHERE employee_id = ? AND year = ? AND month = ? ORDER BY id DESC LIMIT 1";
    let salaries = db
        .query(salary_sql, &[&employee_id as &dyn rusqlite::ToSql, &year as &dyn rusqlite::ToSql, &month as &dyn rusqlite::ToSql], |row| {
            Ok(Salary {
                id: row.get(0)?,
                employee_id: row.get(1)?,
                year: row.get(2)?,
                month: row.get(3)?,
                amount: row.get(4)?,
                deductions: row.get(5)?,
                notes: row.get::<_, Option<String>>(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to fetch salary: {}", e))?;

    if let Some(salary) = salaries.first() {
        Ok(salary.clone())
    } else {
        Err("Failed to retrieve created salary".to_string())
    }
}

/// Get all salaries
#[tauri::command]
fn get_salaries(
    db_state: State<'_, Mutex<Option<Database>>>,
    page: i64,
    per_page: i64,
    search: Option<String>,
    sort_by: Option<String>,
    sort_order: Option<String>,
) -> Result<PaginatedResponse<Salary>, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let offset = (page - 1) * per_page;

    // Build WHERE clause
    let mut where_clause = String::new();
    let mut params: Vec<serde_json::Value> = Vec::new();

    if let Some(s) = search {
        if !s.trim().is_empty() {
             let search_term = format!("%{}%", s);
             where_clause = "WHERE (CAST(s.year AS TEXT) LIKE ? OR s.month LIKE ? OR s.employee_id IN (SELECT id FROM employees WHERE full_name LIKE ?))".to_string();
             params.push(serde_json::Value::String(search_term.clone()));
             params.push(serde_json::Value::String(search_term.clone()));
             params.push(serde_json::Value::String(search_term));
        }
    }

    // Get total count
    let count_sql = format!("SELECT COUNT(*) FROM salaries s {}", where_clause);
    let total: i64 = db.with_connection(|conn| {
         let mut stmt = conn.prepare(&count_sql).map_err(|e| anyhow::anyhow!("{}", e))?;
         let rusqlite_params: Vec<rusqlite::types::Value> = params.iter().map(|v| {
            match v {
                serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                _ => rusqlite::types::Value::Null,
            }
        }).collect();
         let count: i64 = stmt.query_row(rusqlite::params_from_iter(rusqlite_params.iter()), |row| row.get(0))
             .map_err(|e| anyhow::anyhow!("{}", e))?;
         Ok(count)
    }).map_err(|e| format!("Failed to count salaries: {}", e))?;

    // Build Order By
    let order_clause = if let Some(sort) = sort_by {
        let order = sort_order.unwrap_or_else(|| "ASC".to_string());
        let allowed_cols = ["amount", "year", "month", "created_at"];
        if allowed_cols.contains(&sort.as_str()) {
             format!("ORDER BY s.{} {}", sort, if order.to_uppercase() == "DESC" { "DESC" } else { "ASC" })
        } else {
            "ORDER BY s.year DESC, s.month DESC".to_string()
        }
    } else {
        "ORDER BY s.year DESC, s.month DESC".to_string()
    };

    let sql = format!("SELECT s.id, s.employee_id, s.year, s.month, s.amount, COALESCE(s.deductions, 0) as deductions, s.notes, s.created_at, s.updated_at FROM salaries s {} {} LIMIT ? OFFSET ?", where_clause, order_clause);
    
    params.push(serde_json::Value::Number(serde_json::Number::from(per_page)));
    params.push(serde_json::Value::Number(serde_json::Number::from(offset)));

    let salaries = db.with_connection(|conn| {
        let mut stmt = conn.prepare(&sql).map_err(|e| anyhow::anyhow!("{}", e))?;
        let rusqlite_params: Vec<rusqlite::types::Value> = params.iter().map(|v| {
             match v {
                serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                serde_json::Value::Number(n) => rusqlite::types::Value::Integer(n.as_i64().unwrap_or(0)),
                _ => rusqlite::types::Value::Null,
            }
        }).collect();

        let rows = stmt.query_map(rusqlite::params_from_iter(rusqlite_params.iter()), |row| {
             Ok(Salary {
                id: row.get(0)?,
                employee_id: row.get(1)?,
                year: row.get(2)?,
                month: row.get(3)?,
                amount: row.get(4)?,
                deductions: row.get(5)?,
                notes: row.get::<_, Option<String>>(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        }).map_err(|e| anyhow::anyhow!("{}", e))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| anyhow::anyhow!("{}", e))?);
        }
        Ok(result)
    }).map_err(|e| format!("Failed to fetch salaries: {}", e))?;

    let total_pages = (total as f64 / per_page as f64).ceil() as i64;
    
    Ok(PaginatedResponse {
        items: salaries,
        total,
        page,
        per_page,
        total_pages,
    })
}

/// Get salaries by employee ID
#[tauri::command]
fn get_salaries_by_employee(
    db_state: State<'_, Mutex<Option<Database>>>,
    employee_id: i64,
) -> Result<Vec<Salary>, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let sql = "SELECT id, employee_id, year, month, amount, COALESCE(deductions, 0) as deductions, notes, created_at, updated_at FROM salaries WHERE employee_id = ? ORDER BY year DESC, month DESC";
    let salaries = db
        .query(sql, &[&employee_id as &dyn rusqlite::ToSql], |row| {
            Ok(Salary {
                id: row.get(0)?,
                employee_id: row.get(1)?,
                year: row.get(2)?,
                month: row.get(3)?,
                amount: row.get(4)?,
                deductions: row.get(5)?,
                notes: row.get::<_, Option<String>>(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to fetch salaries: {}", e))?;

    Ok(salaries)
}

/// Get salary by ID
#[tauri::command]
fn get_salary(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
) -> Result<Salary, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let sql = "SELECT id, employee_id, year, month, amount, COALESCE(deductions, 0) as deductions, notes, created_at, updated_at FROM salaries WHERE id = ?";
    let salaries = db
        .query(sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(Salary {
                id: row.get(0)?,
                employee_id: row.get(1)?,
                year: row.get(2)?,
                month: row.get(3)?,
                amount: row.get(4)?,
                deductions: row.get(5)?,
                notes: row.get::<_, Option<String>>(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to fetch salary: {}", e))?;

    if let Some(salary) = salaries.first() {
        Ok(salary.clone())
    } else {
        Err("Salary not found".to_string())
    }
}

/// Update a salary
#[tauri::command]
fn update_salary(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
    employee_id: i64,
    year: i32,
    month: String,
    amount: f64,
    deductions: f64,
    notes: Option<String>,
) -> Result<Salary, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Update salary
    let update_sql = "UPDATE salaries SET employee_id = ?, year = ?, month = ?, amount = ?, deductions = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    let notes_str: Option<&str> = notes.as_ref().map(|s| s.as_str());
    
    db.execute(update_sql, &[
        &employee_id as &dyn rusqlite::ToSql,
        &year as &dyn rusqlite::ToSql,
        &month as &dyn rusqlite::ToSql,
        &amount as &dyn rusqlite::ToSql,
        &deductions as &dyn rusqlite::ToSql,
        &notes_str as &dyn rusqlite::ToSql,
        &id as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to update salary: {}", e))?;

    // Get the updated salary
    let salary_sql = "SELECT id, employee_id, year, month, amount, COALESCE(deductions, 0) as deductions, notes, created_at, updated_at FROM salaries WHERE id = ?";
    let salaries = db
        .query(salary_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(Salary {
                id: row.get(0)?,
                employee_id: row.get(1)?,
                year: row.get(2)?,
                month: row.get(3)?,
                amount: row.get(4)?,
                deductions: row.get(5)?,
                notes: row.get::<_, Option<String>>(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to fetch salary: {}", e))?;

    if let Some(salary) = salaries.first() {
        Ok(salary.clone())
    } else {
        Err("Failed to retrieve updated salary".to_string())
    }
}

/// Delete a salary
#[tauri::command]
fn delete_salary(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let delete_sql = "DELETE FROM salaries WHERE id = ?";
    db.execute(delete_sql, &[&id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to delete salary: {}", e))?;

    Ok("Salary deleted successfully".to_string())
}

// Deduction Model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Deduction {
    pub id: i64,
    pub employee_id: i64,
    pub year: i32,
    pub month: String, // Dari month name like حمل, ثور
    pub currency: String,
    pub rate: f64,
    pub amount: f64,
    pub created_at: String,
    pub updated_at: String,
}

/// Initialize deductions table schema
#[tauri::command]
fn init_deductions_table(db_state: State<'_, Mutex<Option<Database>>>) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Create table if it doesn't exist
    let create_table_sql = "
        CREATE TABLE IF NOT EXISTS deductions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            year INTEGER NOT NULL DEFAULT 1403,
            month TEXT NOT NULL DEFAULT 'حمل',
            currency TEXT NOT NULL,
            rate REAL NOT NULL DEFAULT 1.0,
            amount REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        )
    ";

    db.execute(create_table_sql, &[])
        .map_err(|e| format!("Failed to create deductions table: {}", e))?;

    // Check if year column exists, if not add it
    let check_column_sql = "PRAGMA table_info(deductions)";
    if let Ok(columns) = db.query(check_column_sql, &[], |row| {
        Ok(row.get::<_, String>(1)?)
    }) {
        let has_year = columns.iter().any(|c| c == "year");
        if !has_year {
            // Add year column
            let add_year_sql = "ALTER TABLE deductions ADD COLUMN year INTEGER NOT NULL DEFAULT 1403";
            let _ = db.execute(add_year_sql, &[]);
        }
        
        let has_month = columns.iter().any(|c| c == "month");
        if !has_month {
            // Add month column
            let add_month_sql = "ALTER TABLE deductions ADD COLUMN month TEXT NOT NULL DEFAULT 'حمل'";
            let _ = db.execute(add_month_sql, &[]);
        }
    }

    Ok("Deductions table initialized successfully".to_string())
}

/// Create a new deduction
#[tauri::command]
fn create_deduction(
    db_state: State<'_, Mutex<Option<Database>>>,
    employee_id: i64,
    year: i32,
    month: String,
    currency: String,
    rate: f64,
    amount: f64,
) -> Result<Deduction, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Insert new deduction
    let insert_sql = "INSERT INTO deductions (employee_id, year, month, currency, rate, amount) VALUES (?, ?, ?, ?, ?, ?)";
    db.execute(insert_sql, &[
        &employee_id as &dyn rusqlite::ToSql,
        &year as &dyn rusqlite::ToSql,
        &month as &dyn rusqlite::ToSql,
        &currency as &dyn rusqlite::ToSql,
        &rate as &dyn rusqlite::ToSql,
        &amount as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to insert deduction: {}", e))?;

    // Get the created deduction
    let deduction_sql = "SELECT id, employee_id, year, month, currency, rate, amount, created_at, updated_at FROM deductions WHERE employee_id = ? AND year = ? AND month = ? AND currency = ? AND rate = ? AND amount = ? ORDER BY id DESC LIMIT 1";
    let deductions = db
        .query(deduction_sql, &[
            &employee_id as &dyn rusqlite::ToSql,
            &year as &dyn rusqlite::ToSql,
            &month as &dyn rusqlite::ToSql,
            &currency as &dyn rusqlite::ToSql,
            &rate as &dyn rusqlite::ToSql,
            &amount as &dyn rusqlite::ToSql,
        ], |row| {
            Ok(Deduction {
                id: row.get(0)?,
                employee_id: row.get(1)?,
                year: row.get(2)?,
                month: row.get(3)?,
                currency: row.get(4)?,
                rate: row.get(5)?,
                amount: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to fetch deduction: {}", e))?;

    if let Some(deduction) = deductions.first() {
        Ok(deduction.clone())
    } else {
        Err("Failed to retrieve created deduction".to_string())
    }
}

/// Get all deductions with pagination
#[tauri::command]
fn get_deductions(
    db_state: State<'_, Mutex<Option<Database>>>,
    page: i64,
    per_page: i64,
    search: Option<String>,
    sort_by: Option<String>,
    sort_order: Option<String>,
) -> Result<PaginatedResponse<Deduction>, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let offset = (page - 1) * per_page;

    // Build WHERE clause
    let mut where_clause = String::new();
    let mut params: Vec<serde_json::Value> = Vec::new();

    if let Some(s) = search {
        if !s.trim().is_empty() {
             let search_term = format!("%{}%", s);
             where_clause = "WHERE (currency LIKE ? OR month LIKE ? OR CAST(year AS TEXT) LIKE ?)".to_string();
             params.push(serde_json::Value::String(search_term.clone()));
             params.push(serde_json::Value::String(search_term.clone()));
             params.push(serde_json::Value::String(search_term));
        }
    }

    // Get total count
    let count_sql = format!("SELECT COUNT(*) FROM deductions {}", where_clause);
    let total: i64 = db.with_connection(|conn| {
         let mut stmt = conn.prepare(&count_sql).map_err(|e| anyhow::anyhow!("{}", e))?;
         let rusqlite_params: Vec<rusqlite::types::Value> = params.iter().map(|v| {
            match v {
                serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                _ => rusqlite::types::Value::Null,
            }
        }).collect();
         let count: i64 = stmt.query_row(rusqlite::params_from_iter(rusqlite_params.iter()), |row| row.get(0))
             .map_err(|e| anyhow::anyhow!("{}", e))?;
         Ok(count)
    }).map_err(|e| format!("Failed to count deductions: {}", e))?;

    // Build Order By
    let order_clause = if let Some(sort) = sort_by {
        let order = sort_order.unwrap_or_else(|| "ASC".to_string());
        let allowed_cols = ["amount", "year", "month", "currency", "rate", "created_at"];
        if allowed_cols.contains(&sort.as_str()) {
             format!("ORDER BY {} {}", sort, if order.to_uppercase() == "DESC" { "DESC" } else { "ASC" })
        } else {
            "ORDER BY year DESC, month DESC, created_at DESC".to_string()
        }
    } else {
        "ORDER BY year DESC, month DESC, created_at DESC".to_string()
    };

    let sql = format!("SELECT id, employee_id, COALESCE(year, 1403) as year, COALESCE(month, 'حمل') as month, currency, rate, amount, created_at, updated_at FROM deductions {} {} LIMIT ? OFFSET ?", where_clause, order_clause);
    
    params.push(serde_json::Value::Number(serde_json::Number::from(per_page)));
    params.push(serde_json::Value::Number(serde_json::Number::from(offset)));

    let deductions = db.with_connection(|conn| {
        let mut stmt = conn.prepare(&sql).map_err(|e| anyhow::anyhow!("{}", e))?;
        let rusqlite_params: Vec<rusqlite::types::Value> = params.iter().map(|v| {
             match v {
                serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                serde_json::Value::Number(n) => rusqlite::types::Value::Integer(n.as_i64().unwrap_or(0)),
                _ => rusqlite::types::Value::Null,
            }
        }).collect();

        let rows = stmt.query_map(rusqlite::params_from_iter(rusqlite_params.iter()), |row| {
             Ok(Deduction {
                id: row.get(0)?,
                employee_id: row.get(1)?,
                year: row.get(2)?,
                month: row.get(3)?,
                currency: row.get(4)?,
                rate: row.get(5)?,
                amount: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        }).map_err(|e| anyhow::anyhow!("{}", e))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| anyhow::anyhow!("{}", e))?);
        }
        Ok(result)
    }).map_err(|e| format!("Failed to fetch deductions: {}", e))?;

    let total_pages = (total as f64 / per_page as f64).ceil() as i64;
    
    Ok(PaginatedResponse {
        items: deductions,
        total,
        page,
        per_page,
        total_pages,
    })
}

/// Get deductions by employee ID
#[tauri::command]
fn get_deductions_by_employee(
    db_state: State<'_, Mutex<Option<Database>>>,
    employee_id: i64,
) -> Result<Vec<Deduction>, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let sql = "SELECT id, employee_id, COALESCE(year, 1403) as year, COALESCE(month, 'حمل') as month, currency, rate, amount, created_at, updated_at FROM deductions WHERE employee_id = ? ORDER BY year DESC, month DESC, created_at DESC";
    let deductions = db
        .query(sql, &[&employee_id as &dyn rusqlite::ToSql], |row| {
            Ok(Deduction {
                id: row.get(0)?,
                employee_id: row.get(1)?,
                year: row.get(2)?,
                month: row.get(3)?,
                currency: row.get(4)?,
                rate: row.get(5)?,
                amount: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to fetch deductions: {}", e))?;

    Ok(deductions)
}

/// Get deductions by employee ID, year, and month
#[tauri::command]
fn get_deductions_by_employee_year_month(
    db_state: State<'_, Mutex<Option<Database>>>,
    employee_id: i64,
    year: i32,
    month: String,
) -> Result<Vec<Deduction>, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let sql = "SELECT id, employee_id, COALESCE(year, 1403) as year, COALESCE(month, 'حمل') as month, currency, rate, amount, created_at, updated_at FROM deductions WHERE employee_id = ? AND year = ? AND month = ? ORDER BY created_at DESC";
    let deductions = db
        .query(sql, &[
            &employee_id as &dyn rusqlite::ToSql,
            &year as &dyn rusqlite::ToSql,
            &month as &dyn rusqlite::ToSql,
        ], |row| {
            Ok(Deduction {
                id: row.get(0)?,
                employee_id: row.get(1)?,
                year: row.get(2)?,
                month: row.get(3)?,
                currency: row.get(4)?,
                rate: row.get(5)?,
                amount: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to fetch deductions: {}", e))?;

    Ok(deductions)
}

/// Get deduction by ID
#[tauri::command]
fn get_deduction(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
) -> Result<Deduction, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let sql = "SELECT id, employee_id, COALESCE(year, 1403) as year, COALESCE(month, 'حمل') as month, currency, rate, amount, created_at, updated_at FROM deductions WHERE id = ?";
    let deductions = db
        .query(sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(Deduction {
                id: row.get(0)?,
                employee_id: row.get(1)?,
                year: row.get(2)?,
                month: row.get(3)?,
                currency: row.get(4)?,
                rate: row.get(5)?,
                amount: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to fetch deduction: {}", e))?;

    let deduction = deductions.first().ok_or("Deduction not found")?;
    Ok(deduction.clone())
}

/// Update a deduction
#[tauri::command]
fn update_deduction(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
    employee_id: i64,
    currency: String,
    rate: f64,
    amount: f64,
) -> Result<Deduction, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Update deduction
    let update_sql = "UPDATE deductions SET employee_id = ?, currency = ?, rate = ?, amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    db.execute(update_sql, &[
        &employee_id as &dyn rusqlite::ToSql,
        &currency as &dyn rusqlite::ToSql,
        &rate as &dyn rusqlite::ToSql,
        &amount as &dyn rusqlite::ToSql,
        &id as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to update deduction: {}", e))?;

    // Get the updated deduction
    let deduction_sql = "SELECT id, employee_id, COALESCE(year, 1403) as year, COALESCE(month, 'حمل') as month, currency, rate, amount, created_at, updated_at FROM deductions WHERE id = ?";
    let deductions = db
        .query(deduction_sql, &[&id as &dyn rusqlite::ToSql], |row| {
            Ok(Deduction {
                id: row.get(0)?,
                employee_id: row.get(1)?,
                year: row.get(2)?,
                month: row.get(3)?,
                currency: row.get(4)?,
                rate: row.get(5)?,
                amount: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to fetch deduction: {}", e))?;

    if let Some(deduction) = deductions.first() {
        Ok(deduction.clone())
    } else {
        Err("Failed to retrieve updated deduction".to_string())
    }
}

/// Delete a deduction
#[tauri::command]
fn delete_deduction(
    db_state: State<'_, Mutex<Option<Database>>>,
    id: i64,
) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let delete_sql = "DELETE FROM deductions WHERE id = ?";
    db.execute(delete_sql, &[&id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to delete deduction: {}", e))?;

    Ok("Deduction deleted successfully".to_string())
}

// ========== Company Settings ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanySettings {
    pub id: i64,
    pub name: String,
    pub logo: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Initialize company_settings table schema
#[tauri::command]
fn init_company_settings_table(db_state: State<'_, Mutex<Option<Database>>>) -> Result<String, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let create_table_sql = "
        CREATE TABLE IF NOT EXISTS company_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            logo TEXT,
            phone TEXT,
            address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ";

    db.execute(create_table_sql, &[])
        .map_err(|e| format!("Failed to create company_settings table: {}", e))?;

    // Insert default row if table is empty
    let count_sql = "SELECT COUNT(*) FROM company_settings";
    let counts = db.query(count_sql, &[], |row| Ok(row.get::<_, i64>(0)?))
        .unwrap_or_else(|_| vec![]);
    let count: i64 = counts.first().copied().unwrap_or(0);
    
    if count == 0 {
        let insert_sql = "INSERT INTO company_settings (name, logo, phone, address) VALUES (?, ?, ?, ?)";
        db.execute(insert_sql, &[
            &"شرکت" as &dyn rusqlite::ToSql,
            &None::<String> as &dyn rusqlite::ToSql,
            &None::<String> as &dyn rusqlite::ToSql,
            &None::<String> as &dyn rusqlite::ToSql,
        ])
        .map_err(|e| format!("Failed to insert default company settings: {}", e))?;
    }

    Ok("Company settings table initialized successfully".to_string())
}

/// Get company settings (only one row should exist)
#[tauri::command]
fn get_company_settings(db_state: State<'_, Mutex<Option<Database>>>) -> Result<CompanySettings, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let sql = "SELECT id, name, logo, phone, address, created_at, updated_at FROM company_settings ORDER BY id LIMIT 1";
    let settings_list = db
        .query(sql, &[], |row| {
            Ok(CompanySettings {
                id: row.get(0)?,
                name: row.get(1)?,
                logo: row.get(2)?,
                phone: row.get(3)?,
                address: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| format!("Failed to fetch company settings: {}", e))?;

    let settings = settings_list.first().ok_or("No company settings found")?;
    Ok(settings.clone())
}

/// Update company settings
#[tauri::command]
fn update_company_settings(
    db_state: State<'_, Mutex<Option<Database>>>,
    name: String,
    logo: Option<String>,
    phone: Option<String>,
    address: Option<String>,
) -> Result<CompanySettings, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Check if settings exist
    let count_sql = "SELECT COUNT(*) FROM company_settings";
    let counts = db.query(count_sql, &[], |row| Ok(row.get::<_, i64>(0)?))
        .unwrap_or_else(|_| vec![]);
    let count: i64 = counts.first().copied().unwrap_or(0);

    if count == 0 {
        // Insert new settings
        let insert_sql = "INSERT INTO company_settings (name, logo, phone, address) VALUES (?, ?, ?, ?)";
        db.execute(insert_sql, &[
            &name as &dyn rusqlite::ToSql,
            &logo as &dyn rusqlite::ToSql,
            &phone as &dyn rusqlite::ToSql,
            &address as &dyn rusqlite::ToSql,
        ])
        .map_err(|e| format!("Failed to insert company settings: {}", e))?;
    } else {
        // Update existing settings (update first row)
        let update_sql = "UPDATE company_settings SET name = ?, logo = ?, phone = ?, address = ?, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM company_settings ORDER BY id LIMIT 1)";
        db.execute(update_sql, &[
            &name as &dyn rusqlite::ToSql,
            &logo as &dyn rusqlite::ToSql,
            &phone as &dyn rusqlite::ToSql,
            &address as &dyn rusqlite::ToSql,
        ])
        .map_err(|e| format!("Failed to update company settings: {}", e))?;
    }

    // Get the updated settings (reuse the same db reference)
    let get_sql = "SELECT id, name, logo, phone, address, created_at, updated_at FROM company_settings ORDER BY id LIMIT 1";
    let settings_list = db
        .query(get_sql, &[], |row| {
            Ok(CompanySettings {
                id: row.get(0)?,
                name: row.get(1)?,
                logo: row.get(2)?,
                phone: row.get(3)?,
                address: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| format!("Failed to fetch updated company settings: {}", e))?;

    let settings = settings_list.first().ok_or("No company settings found")?;
    Ok(settings.clone())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load environment variables at startup
    load_env();
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(None::<Database>))
        .invoke_handler(tauri::generate_handler![
            db_create,
            db_open,
            db_close,
            db_is_open,
            db_execute,
            db_query,
            get_database_path,
            init_users_table,
            register_user,
            login_user,
            init_currencies_table,
            create_currency,
            get_currencies,
            update_currency,
            delete_currency,
            init_suppliers_table,
            create_supplier,
            get_suppliers,
            update_supplier,
            delete_supplier,
            init_products_table,
            create_product,
            get_products,
            update_product,
            delete_product,
            init_purchases_table,
            create_purchase,
            get_purchases,
            get_purchase,
            update_purchase,
            delete_purchase,
            create_purchase_item,
            get_purchase_items,
            update_purchase_item,
            delete_purchase_item,
            init_units_table,
            create_unit,
            get_units,
            update_unit,
            delete_unit,
            init_customers_table,
            create_customer,
            get_customers,
            update_customer,
            delete_customer,
            init_sales_table,
            create_sale,
            get_sales,
            get_sale,
            update_sale,
            delete_sale,
            create_sale_item,
            get_sale_items,
            update_sale_item,
            delete_sale_item,
            create_sale_payment,
            get_sale_payments,
            delete_sale_payment,
            init_expense_types_table,
            create_expense_type,
            get_expense_types,
            update_expense_type,
            delete_expense_type,
            init_expenses_table,
            create_expense,
            get_expenses,
            get_expense,
            update_expense,
            delete_expense,
            init_employees_table,
            create_employee,
            get_employees,
            get_employee,
            update_employee,
            delete_employee,
            init_salaries_table,
            create_salary,
            get_salaries,
            get_salaries_by_employee,
            get_salary,
            update_salary,
            delete_salary,
            init_deductions_table,
            create_deduction,
            get_deductions,
            get_deductions_by_employee,
            get_deductions_by_employee_year_month,
            get_deduction,
            update_deduction,
            delete_deduction,
            init_company_settings_table,
            get_company_settings,
            update_company_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
