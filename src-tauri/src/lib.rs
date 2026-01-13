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
            delete_supplier
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
