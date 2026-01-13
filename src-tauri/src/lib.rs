mod db;

use db::Database;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecuteResult {
    pub rows_affected: usize,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Get database path - always use C:\data\db.sqlite
fn get_db_path(_app: &AppHandle, _db_name: &str) -> Result<PathBuf, String> {
    let db_path = PathBuf::from("E:\\db.sqlite");
    
    // Create data directory if it doesn't exist
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create data directory: {}", e))?;
    }
    
    Ok(db_path)
}

/// Create a new SQLite database file (not used - database must exist at C:\data\db.sqlite)
#[tauri::command]
fn db_create(_app: AppHandle, _db_name: String) -> Result<String, String> {
    Err("Database creation is disabled. Please create C:\\data\\db.sqlite manually.".to_string())
}

/// Open an existing database from C:\db.sqlite
#[tauri::command]
fn db_open(app: AppHandle, _db_name: String) -> Result<String, String> {
    let db_path = get_db_path(&app, "")?;
    
    if !db_path.exists() {
        return Err(format!("Database does not exist at C:\\data\\db.sqlite. Please create it first."));
    }

    let db = Database::new(db_path.clone());
    db.open()
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Update existing database state
    let db_state: State<'_, Mutex<Option<Database>>> = app.state();
    let mut db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    *db_guard = Some(db);

    Ok(format!("Database opened: {:?}", db_path))
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
fn get_suppliers(db_state: State<'_, Mutex<Option<Database>>>) -> Result<Vec<Supplier>, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let sql = "SELECT id, full_name, phone, address, email, notes, created_at, updated_at FROM suppliers ORDER BY created_at DESC";
    let suppliers = db
        .query(sql, &[], |row| {
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
        .map_err(|e| format!("Failed to fetch suppliers: {}", e))?;

    Ok(suppliers)
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (currency_id) REFERENCES currencies(id),
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        )
    ";

    db.execute(create_table_sql, &[])
        .map_err(|e| format!("Failed to create products table: {}", e))?;

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
) -> Result<Product, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Insert new product
    let insert_sql = "INSERT INTO products (name, description, price, currency_id, supplier_id, stock_quantity, unit) VALUES (?, ?, ?, ?, ?, ?, ?)";
    let description_str: Option<&str> = description.as_ref().map(|s| s.as_str());
    let unit_str: Option<&str> = unit.as_ref().map(|s| s.as_str());
    db.execute(insert_sql, &[
        &name as &dyn rusqlite::ToSql,
        &description_str as &dyn rusqlite::ToSql,
        &price as &dyn rusqlite::ToSql,
        &currency_id as &dyn rusqlite::ToSql,
        &supplier_id as &dyn rusqlite::ToSql,
        &stock_quantity as &dyn rusqlite::ToSql,
        &unit_str as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to insert product: {}", e))?;

    // Get the created product
    let product_sql = "SELECT id, name, description, price, currency_id, supplier_id, stock_quantity, unit, created_at, updated_at FROM products WHERE name = ? ORDER BY id DESC LIMIT 1";
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
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
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
fn get_products(db_state: State<'_, Mutex<Option<Database>>>) -> Result<Vec<Product>, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let sql = "SELECT id, name, description, price, currency_id, supplier_id, stock_quantity, unit, created_at, updated_at FROM products ORDER BY created_at DESC";
    let products = db
        .query(sql, &[], |row| {
            Ok(Product {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get::<_, Option<String>>(2)?,
                price: row.get::<_, Option<f64>>(3)?,
                currency_id: row.get::<_, Option<i64>>(4)?,
                supplier_id: row.get::<_, Option<i64>>(5)?,
                stock_quantity: row.get::<_, Option<f64>>(6)?,
                unit: row.get::<_, Option<String>>(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|e| format!("Failed to fetch products: {}", e))?;

    Ok(products)
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
) -> Result<Product, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    // Update product
    let update_sql = "UPDATE products SET name = ?, description = ?, price = ?, currency_id = ?, supplier_id = ?, stock_quantity = ?, unit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    let description_str: Option<&str> = description.as_ref().map(|s| s.as_str());
    let unit_str: Option<&str> = unit.as_ref().map(|s| s.as_str());
    db.execute(update_sql, &[
        &name as &dyn rusqlite::ToSql,
        &description_str as &dyn rusqlite::ToSql,
        &price as &dyn rusqlite::ToSql,
        &currency_id as &dyn rusqlite::ToSql,
        &supplier_id as &dyn rusqlite::ToSql,
        &stock_quantity as &dyn rusqlite::ToSql,
        &unit_str as &dyn rusqlite::ToSql,
        &id as &dyn rusqlite::ToSql,
    ])
        .map_err(|e| format!("Failed to update product: {}", e))?;

    // Get the updated product
    let product_sql = "SELECT id, name, description, price, currency_id, supplier_id, stock_quantity, unit, created_at, updated_at FROM products WHERE id = ?";
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
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
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
    pub unit_id: String,
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
            unit_id TEXT NOT NULL,
            per_price REAL NOT NULL,
            amount REAL NOT NULL,
            total REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id)
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
    items: Vec<(i64, String, f64, f64)>, // (product_id, unit_id, per_price, amount)
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

/// Get all purchases
#[tauri::command]
fn get_purchases(db_state: State<'_, Mutex<Option<Database>>>) -> Result<Vec<Purchase>, String> {
    let db_guard = db_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let db = db_guard.as_ref().ok_or("No database is currently open")?;

    let sql = "SELECT id, supplier_id, date, notes, total_amount, created_at, updated_at FROM purchases ORDER BY date DESC, created_at DESC";
    let purchases = db
        .query(sql, &[], |row| {
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
        .map_err(|e| format!("Failed to fetch purchases: {}", e))?;

    Ok(purchases)
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
    items: Vec<(i64, String, f64, f64)>, // (product_id, unit_id, per_price, amount)
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
    unit_id: String,
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
    unit_id: String,
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(None::<Database>))
        .invoke_handler(tauri::generate_handler![
            greet,
            db_create,
            db_open,
            db_close,
            db_is_open,
            db_execute,
            db_query,
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
            delete_purchase_item
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
