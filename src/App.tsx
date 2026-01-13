import { useState, useEffect } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import { motion } from "framer-motion";
import {
  openDatabase,
  closeDatabase,
  isDatabaseOpen,
  executeQuery,
  queryDatabase,
  type QueryResult,
} from "./utils/db";
import Login from "./components/Login";
import CurrencyManagement from "./components/Currency";
import "./App.css";

interface User {
  id: number;
  username: string;
  email: string;
}

type Page = "dashboard" | "currency";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [dbStatus, setDbStatus] = useState<string>("Not connected");
  const [dbName, setDbName] = useState("db");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string>("");

  // Initialize database on mount - open C:\db.sqlite
  useEffect(() => {
    const initDb = async () => {
      try {
        const dbOpen = await isDatabaseOpen();
        if (!dbOpen) {
          // Open existing database at C:\db.sqlite
          try {
            await openDatabase("db");
            setDbStatus("Database opened from C:\\data\\db.sqlite");
          } catch (err: any) {
            setDbStatus(`Error: ${err.toString()}`);
            console.error("Database init error:", err);
          }
        } else {
          setDbStatus("Database already open");
        }
      } catch (err: any) {
        console.log("Database init:", err);
      }
    };
    initDb();
  }, []);

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  async function handleCreateDatabase() {
    setError("Database creation is disabled. Please create C:\\data\\db.sqlite manually.");
    setDbStatus("Using fixed database path: C:\\data\\db.sqlite");
  }

  async function handleOpenDatabase() {
    try {
      setError("");
      const result = await openDatabase(dbName);
      setDbStatus(`Database opened: ${result}`);
      await checkDbStatus();
    } catch (err: any) {
      setError(err.toString());
    }
  }

  async function handleCloseDatabase() {
    try {
      setError("");
      await closeDatabase();
      setDbStatus("Database closed");
      setQueryResult(null);
    } catch (err: any) {
      setError(err.toString());
    }
  }

  async function checkDbStatus() {
    try {
      const isOpen = await isDatabaseOpen();
      if (!isOpen) {
        setDbStatus("Not connected");
      }
    } catch (err: any) {
      setError(err.toString());
    }
  }

  async function handleCreateTable() {
    try {
      setError("");
      const sql = `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      const result = await executeQuery(sql);
      setDbStatus(`Table created. Rows affected: ${result.rows_affected}`);
    } catch (err: any) {
      setError(err.toString());
    }
  }

  async function handleInsertData() {
    try {
      setError("");
      const sql = `INSERT INTO users (name, email) VALUES (?, ?)`;
      const result = await executeQuery(sql, ["John Doe", "john@example.com"]);
      setDbStatus(`Data inserted. Rows affected: ${result.rows_affected}`);
    } catch (err: any) {
      setError(err.toString());
    }
  }

  async function handleQueryData() {
    try {
      setError("");
      const sql = `SELECT * FROM users`;
      const result = await queryDatabase(sql);
      setQueryResult(result);
      setDbStatus(`Query executed. Found ${result.rows.length} rows`);
    } catch (err: any) {
      setError(err.toString());
    }
  }

  // Show login screen if not logged in
  if (!user) {
    return <Login onLoginSuccess={(user) => setUser(user)} />;
  }

  const handleLogout = () => {
    setUser(null);
    setQueryResult(null);
    setError("");
    setDbStatus("Not connected");
    setCurrentPage("dashboard");
  };

  // Show currency page if selected
  if (currentPage === "currency") {
    return (
      <CurrencyManagement onBack={() => setCurrentPage("dashboard")} />
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-6xl">
        {/* Header with user info and logout */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              Welcome, {user.username}!
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {user.email}
            </p>
          </div>
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCurrentPage("currency")}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl"
              dir="rtl"
            >
              مدیریت ارزها
            </motion.button>
            <button
              onClick={handleLogout}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Logout
            </button>
          </div>
        </div>

      <div className="flex gap-8 mb-8">
        <a href="https://vite.dev" target="_blank" className="transition-transform hover:scale-110">
          <img src="/vite.svg" className="h-24 w-24" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank" className="transition-transform hover:scale-110">
          <img src="/tauri.svg" className="h-24 w-24" alt="Tauri logo" />
        </a>
        <a href="https://react.dev" target="_blank" className="transition-transform hover:scale-110">
          <img src={reactLogo} className="h-24 w-24 animate-spin-slow" alt="React logo" />
        </a>
      </div>
      <p className="text-gray-600 dark:text-gray-300 mb-8">
        Click on the Tauri, Vite, and React logos to learn more.
      </p>

      <form
        className="flex gap-2 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button 
          type="submit"
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Greet
        </button>
      </form>
      {greetMsg && (
        <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
          {greetMsg}
        </p>
      )}

        {/* SQLite Database Section */}
        <div className="mt-8 w-full">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          SQLite Database Integration
        </h2>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Database Name
            </label>
            <input
              type="text"
              value={dbName}
              onChange={(e) => setDbName(e.currentTarget.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="myapp"
            />
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={handleCreateDatabase}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              Create DB
            </button>
            <button
              onClick={handleOpenDatabase}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Open DB
            </button>
            <button
              onClick={handleCloseDatabase}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Close DB
            </button>
            <button
              onClick={checkDbStatus}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              Check Status
            </button>
          </div>

          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Status: <span className="font-semibold">{dbStatus}</span>
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded">
              Error: {error}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={handleCreateTable}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              Create Table
            </button>
            <button
              onClick={handleInsertData}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              Insert Data
            </button>
            <button
              onClick={handleQueryData}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
            >
              Query Data
            </button>
          </div>

          {queryResult && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Query Results
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      {queryResult.columns.map((col) => (
                        <th
                          key={col}
                          className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {queryResult.rows.map((row, idx) => (
                      <tr key={idx}>
                        {row.map((cell, cellIdx) => (
                          <td
                            key={cellIdx}
                            className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300"
                          >
                            {cell === null ? (
                              <span className="text-gray-400">NULL</span>
                            ) : (
                              String(cell)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </main>
  );
}

export default App;
