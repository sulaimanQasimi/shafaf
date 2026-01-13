import { invoke } from "@tauri-apps/api/core";

export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface LoginResult {
  success: boolean;
  user: User | null;
  message: string;
}

/**
 * Initialize the users table schema
 * @returns Promise with success message
 */
export async function initUsersTable(): Promise<string> {
  return await invoke<string>("init_users_table");
}

/**
 * Register a new user
 * @param username Username for the new user
 * @param email Email for the new user
 * @param password Password for the new user
 * @returns Promise with LoginResult
 */
export async function registerUser(
  username: string,
  email: string,
  password: string
): Promise<LoginResult> {
  return await invoke<LoginResult>("register_user", {
    username,
    email,
    password,
  });
}

/**
 * Login a user
 * @param username Username or email
 * @param password User password
 * @returns Promise with LoginResult
 */
export async function loginUser(
  username: string,
  password: string
): Promise<LoginResult> {
  return await invoke<LoginResult>("login_user", {
    username,
    password,
  });
}
