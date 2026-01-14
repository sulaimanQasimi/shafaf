    use rusqlite::{Connection, Result as SqliteResult, OpenFlags};
use std::path::PathBuf;
use std::sync::Mutex;
use anyhow::Result;

pub struct Database {
    conn: Mutex<Option<Connection>>,
    db_path: PathBuf,
}

impl Database {
    pub fn new(db_path: PathBuf) -> Self {
        Database {
            conn: Mutex::new(None),
            db_path,
        }
    }

    /// Create a new database file (does not open it)
    pub fn create_database(&self) -> Result<()> {
        if self.db_path.exists() {
            return Err(anyhow::anyhow!("Database already exists at {:?}", self.db_path));
        }
        
        // Create the database by opening a connection with read-write access
        let flags = OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE;
        let conn = Connection::open_with_flags(&self.db_path, flags)?;
        conn.close().map_err(|(_, e)| anyhow::anyhow!("Failed to close connection: {}", e))?;
        
        Ok(())
    }

    /// Open the database connection with explicit read-write access
    /// Creates the database file if it doesn't exist
    pub fn open(&self) -> Result<()> {
        let mut conn_guard = self.conn.lock().unwrap();
        if conn_guard.is_some() {
            return Ok(()); // Already open
        }

        // Open with explicit read-write flags to ensure write access
        // SQLITE_OPEN_CREATE flag will create the database if it doesn't exist
        let flags = OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE;
        let conn = Connection::open_with_flags(&self.db_path, flags)?;
        *conn_guard = Some(conn);
        Ok(())
    }

    /// Close the database connection
    pub fn close(&self) -> Result<()> {
        let mut conn_guard = self.conn.lock().unwrap();
        if let Some(conn) = conn_guard.take() {
            conn.close().map_err(|(_, e)| anyhow::anyhow!("Failed to close connection: {}", e))?;
        }
        Ok(())
    }

    /// Check if database is open
    pub fn is_open(&self) -> bool {
        let conn_guard = self.conn.lock().unwrap();
        conn_guard.is_some()
    }

    /// Execute a SQL query that doesn't return results
    pub fn execute(&self, sql: &str, params: &[&dyn rusqlite::ToSql]) -> Result<usize> {
        let mut conn_guard = self.conn.lock().unwrap();
        let conn = conn_guard.as_mut().ok_or_else(|| anyhow::anyhow!("Database is not open. Please open it first."))?;
        Ok(conn.execute(sql, params)?)
    }

    /// Execute a SQL query and return results
    pub fn query<T, F>(&self, sql: &str, params: &[&dyn rusqlite::ToSql], f: F) -> Result<Vec<T>>
    where
        F: FnMut(&rusqlite::Row<'_>) -> SqliteResult<T>,
    {
        let mut conn_guard = self.conn.lock().unwrap();
        let conn = conn_guard.as_mut().ok_or_else(|| anyhow::anyhow!("Database is not open. Please open it first."))?;
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt.query_map(params, f)?;
        let mut results = Vec::new();
        for row in rows {
            results.push(row?);
        }
        Ok(results)
    }

    /// Get column names from a prepared statement
    pub fn get_columns(&self, sql: &str) -> Result<Vec<String>> {
        let mut conn_guard = self.conn.lock().unwrap();
        let conn = conn_guard.as_mut().ok_or_else(|| anyhow::anyhow!("Database is not open. Please open it first."))?;
        let stmt = conn.prepare(sql)?;
        let column_count = stmt.column_count();
        let columns: Vec<String> = (0..column_count)
            .map(|i| stmt.column_name(i).unwrap_or("").to_string())
            .collect();
        Ok(columns)
    }

    /// Get connection for advanced operations (internal use)
    pub fn with_connection<F, R>(&self, f: F) -> Result<R>
    where
        F: FnOnce(&mut Connection) -> Result<R>,
    {
        let mut conn_guard = self.conn.lock().unwrap();
        let conn = conn_guard.as_mut().ok_or_else(|| anyhow::anyhow!("Database is not open. Please open it first."))?;
        f(conn)
    }

    /// Get the database path
    pub fn get_path(&self) -> &PathBuf {
        &self.db_path
    }

    /// Check if database file exists
    pub fn exists(&self) -> bool {
        self.db_path.exists()
    }
}
