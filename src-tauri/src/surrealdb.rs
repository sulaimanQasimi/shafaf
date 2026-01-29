use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use surrealdb::engine::local::{Db, SurrealKv};
use surrealdb::engine::remote::ws::{Client, Ws};
use surrealdb::opt::auth::Root;
use surrealdb::Surreal;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConnectionMode {
    #[serde(rename = "offline")]
    Offline,
    #[serde(rename = "online")]
    Online,
    #[serde(rename = "both")]
    Both,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub mode: ConnectionMode,
    pub offline_path: Option<String>,
    pub online_url: Option<String>,
    pub namespace: Option<String>,
    pub database: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
}

#[derive(Clone)]
pub struct SurrealDatabase {
    pub offline: Option<Arc<Surreal<Db>>>,
    pub online: Option<Arc<Surreal<Client>>>,
    #[allow(dead_code)]
    pub config: DatabaseConfig,
}

impl SurrealDatabase {
    pub fn new(config: DatabaseConfig) -> Self {
        SurrealDatabase {
            offline: None,
            online: None,
            config,
        }
    }

    /// Connect in offline mode (local file-based)
    pub async fn connect_offline(&mut self, db_path: PathBuf) -> Result<()> {
        // Create parent directory if it doesn't exist
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        // Convert PathBuf to string for SurrealKv connection
        // Surreal::new::<SurrealKv> returns Surreal<Db>
        let db_path_str = db_path.to_string_lossy().to_string();
        let db: Surreal<Db> = Surreal::new::<SurrealKv>(db_path_str).await?;
        self.offline = Some(Arc::new(db));
        Ok(())
    }

    /// Connect in online mode (remote server)
    pub async fn connect_online(
        &mut self,
        url: &str,
        namespace: &str,
        database: &str,
        username: &str,
        password: &str,
    ) -> Result<()> {
        let db = Surreal::new::<Ws>(url).await?;
        db.signin(Root { username, password }).await?;
        db.use_ns(namespace).use_db(database).await?;
        self.online = Some(Arc::new(db));
        Ok(())
    }

    /// Connect in both modes (offline + online)
    pub async fn connect_both(
        &mut self,
        db_path: PathBuf,
        url: &str,
        namespace: &str,
        database: &str,
        username: &str,
        password: &str,
    ) -> Result<()> {
        // Connect offline
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        // Convert PathBuf to string for SurrealKv connection
        // Surreal::new::<SurrealKv> returns Surreal<Db>
        let db_path_str = db_path.to_string_lossy().to_string();
        let offline_db: Surreal<Db> = Surreal::new::<SurrealKv>(db_path_str).await?;
        self.offline = Some(Arc::new(offline_db));

        // Connect online
        let online_db = Surreal::new::<Ws>(url).await?;
        online_db.signin(Root { username, password }).await?;
        online_db.use_ns(namespace).use_db(database).await?;
        self.online = Some(Arc::new(online_db));

        Ok(())
    }

    /// Get the active database connection (offline takes priority if both are available)
    pub fn get_connection(&self) -> Result<DatabaseConnection> {
        match (&self.offline, &self.online) {
            (Some(offline), _) => Ok(DatabaseConnection::Offline(offline.clone())),
            (None, Some(online)) => Ok(DatabaseConnection::Online(online.clone())),
            (None, None) => Err(anyhow::anyhow!("No database connection available")),
        }
    }

    /// Get offline connection
    pub fn get_offline(&self) -> Option<Arc<Surreal<Db>>> {
        self.offline.clone()
    }

    /// Get online connection
    pub fn get_online(&self) -> Option<Arc<Surreal<Client>>> {
        self.online.clone()
    }

    /// Check if offline is connected
    pub fn is_offline_connected(&self) -> bool {
        self.offline.is_some()
    }

    /// Check if online is connected
    pub fn is_online_connected(&self) -> bool {
        self.online.is_some()
    }

    /// Sync data from offline to online
    pub async fn sync_offline_to_online(&self) -> Result<()> {
        let offline = self.offline.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Offline database not connected"))?;
        let online = self.online.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Online database not connected"))?;

        // Get all tables from schema
        let tables = vec![
            "users", "currencies", "suppliers", "customers", "unit_groups", "units",
            "products", "purchases", "purchase_items", "purchase_additional_costs",
            "purchase_payments", "sales", "sale_items", "sale_payments",
            "sale_additional_costs", "expense_types", "expenses", "employees",
            "salaries", "deductions", "company_settings", "coa_categories",
            "accounts", "account_currency_balances", "journal_entries",
            "journal_entry_lines", "currency_exchange_rates", "account_transactions",
        ];

        for table in tables {
            // Get all records from offline
            let query = format!("SELECT * FROM {}", table);
            let mut response = offline.query(&query).await?;
            
            // Try to get results
            if let Ok(records) = response.take::<Vec<serde_json::Value>>(0) {
                for record in records {
                    if let Some(id) = record.get("id") {
                        // Create or update record in online
                        let id_str = id.to_string().trim_matches('"').to_string();
                        let update_query = format!("UPDATE {}:{} MERGE $data", table, id_str);
                        let mut update_response = online.query(&update_query).await?;
                        let _ = update_response.take::<Vec<serde_json::Value>>(0);
                    }
                }
            }
        }

        Ok(())
    }

    /// Sync data from online to offline
    #[allow(dead_code)]
    pub async fn sync_online_to_offline(&self) -> Result<()> {
        let offline = self.offline.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Offline database not connected"))?;
        let online = self.online.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Online database not connected"))?;

        // Get all tables from schema
        let tables = vec![
            "users", "currencies", "suppliers", "customers", "unit_groups", "units",
            "products", "purchases", "purchase_items", "purchase_additional_costs",
            "purchase_payments", "sales", "sale_items", "sale_payments",
            "sale_additional_costs", "expense_types", "expenses", "employees",
            "salaries", "deductions", "company_settings", "coa_categories",
            "accounts", "account_currency_balances", "journal_entries",
            "journal_entry_lines", "currency_exchange_rates", "account_transactions",
        ];

        for table in tables {
            // Get all records from online
            let query = format!("SELECT * FROM {}", table);
            let mut response = online.query(&query).await?;
            
            // Try to get results
            if let Ok(records) = response.take::<Vec<serde_json::Value>>(0) {
                for record in records {
                    if let Some(id) = record.get("id") {
                        // Create or update record in offline
                        let id_str = id.to_string().trim_matches('"').to_string();
                        let update_query = format!("UPDATE {}:{} MERGE $data", table, id_str);
                        let mut update_response = offline.query(&update_query).await?;
                        let _ = update_response.take::<Vec<serde_json::Value>>(0);
                    }
                }
            }
        }

        Ok(())
    }

    /// Execute a query on the active connection
    pub async fn query<T>(&self, query: &str) -> Result<Vec<T>>
    where
        T: serde::de::DeserializeOwned,
    {
        let conn = self.get_connection()?;
        match conn {
            DatabaseConnection::Offline(db) => {
                let mut response = db.query(query).await?;
                let result: Vec<T> = response.take(0)
                    .map_err(|e| anyhow::anyhow!("Failed to deserialize: {}", e))?;
                Ok(result)
            }
            DatabaseConnection::Online(db) => {
                let mut response = db.query(query).await?;
                let result: Vec<T> = response.take(0)
                    .map_err(|e| anyhow::anyhow!("Failed to deserialize: {}", e))?;
                Ok(result)
            }
        }
    }

    /// Execute a query that returns a single result
    #[allow(dead_code)]
    pub async fn query_one<T>(&self, query: &str) -> Result<Option<T>>
    where
        T: serde::de::DeserializeOwned,
    {
        let results = self.query::<T>(query).await?;
        Ok(results.into_iter().next())
    }

    /// Execute a query and return raw JSON values
    pub async fn query_json(&self, query: &str) -> Result<Vec<serde_json::Value>> {
        // Use the generic query method with serde_json::Value
        self.query::<serde_json::Value>(query).await
    }

    /// Execute a query that doesn't return results (CREATE, UPDATE, DELETE)
    pub async fn execute(&self, query: &str) -> Result<()> {
        let conn = self.get_connection()?;
        match conn {
            DatabaseConnection::Offline(db) => {
                db.query(query).await?;
                Ok(())
            }
            DatabaseConnection::Online(db) => {
                db.query(query).await?;
                Ok(())
            }
        }
    }

    /// Close all connections
    pub async fn close(&mut self) -> Result<()> {
        self.offline = None;
        self.online = None;
        Ok(())
    }
}

#[derive(Clone)]
pub enum DatabaseConnection {
    Offline(Arc<Surreal<Db>>),
    Online(Arc<Surreal<Client>>),
}

/// Initialize SurrealDB schema
pub async fn init_schema(db: &SurrealDatabase) -> Result<()> {
    let schema = include_str!("../data/surreal_schema.surql");
    
    // Execute schema on offline if available
    if let Some(offline) = db.get_offline() {
        let _ = offline.query(schema).await?;
    }
    
    // Execute schema on online if available
    if let Some(online) = db.get_online() {
        let _ = online.query(schema).await?;
    }
    
    Ok(())
}
