import { invoke } from "@tauri-apps/api/core";
import { queryDatabase, executeQuery, resultToObjects } from "./db";

export interface User {
    id: number;
    username: string;
    email: string;
    full_name?: string;
    phone?: string;
    role: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface UserFormData {
    username: string;
    email: string;
    password?: string;
    full_name?: string;
    phone?: string;
    role: string;
    is_active: boolean;
}

/**
 * Initialize the users table with extended fields for user management
 * @returns Promise with success message
 */
export async function initExtendedUsersTable(): Promise<string> {
    const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT,
      phone TEXT,
      role TEXT DEFAULT 'user',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
    await executeQuery(sql);

    // Add missing columns if table already exists
    try {
        await executeQuery("ALTER TABLE users ADD COLUMN full_name TEXT");
    } catch (e) {
        // Column might already exist
    }

    try {
        await executeQuery("ALTER TABLE users ADD COLUMN phone TEXT");
    } catch (e) {
        // Column might already exist
    }

    try {
        await executeQuery("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
    } catch (e) {
        // Column might already exist
    }

    try {
        await executeQuery("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1");
    } catch (e) {
        // Column might already exist
    }

    try {
        await executeQuery("ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP");
    } catch (e) {
        // Column might already exist
    }

    return "Users table initialized with extended fields";
}

/**
 * Get all users
 * @returns Promise with array of users
 */
export async function getUsers(): Promise<User[]> {
    const result = await queryDatabase(
        "SELECT id, username, email, full_name, phone, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC"
    );
    return resultToObjects(result).map((row) => ({
        ...row,
        is_active: Boolean(row.is_active),
    })) as User[];
}

/**
 * Get a single user by ID
 * @param id User ID
 * @returns Promise with user or null
 */
export async function getUserById(id: number): Promise<User | null> {
    const result = await queryDatabase(
        "SELECT id, username, email, full_name, phone, role, is_active, created_at, updated_at FROM users WHERE id = ?",
        [id]
    );
    const users = resultToObjects(result);
    if (users.length === 0) return null;
    return {
        ...users[0],
        is_active: Boolean(users[0].is_active),
    } as User;
}

/**
 * Create a new user
 * @param userData User data
 * @returns Promise with success message
 */
export async function createUser(userData: UserFormData): Promise<string> {
    // Hash password using bcrypt-like approach (SHA256 for now, should use invoke for proper hashing)
    const hashedPassword = await invoke<string>("hash_password", { password: userData.password });

    await executeQuery(
        `INSERT INTO users (username, email, password, full_name, phone, role, is_active, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
            userData.username,
            userData.email,
            hashedPassword,
            userData.full_name || null,
            userData.phone || null,
            userData.role || "user",
            userData.is_active ? 1 : 0,
        ]
    );
    return "User created successfully";
}

/**
 * Update an existing user
 * @param id User ID
 * @param userData User data
 * @returns Promise with success message
 */
export async function updateUser(id: number, userData: Partial<UserFormData>): Promise<string> {
    const updates: string[] = [];
    const params: any[] = [];

    if (userData.username !== undefined) {
        updates.push("username = ?");
        params.push(userData.username);
    }
    if (userData.email !== undefined) {
        updates.push("email = ?");
        params.push(userData.email);
    }
    if (userData.password !== undefined && userData.password.length > 0) {
        const hashedPassword = await invoke<string>("hash_password", { password: userData.password });
        updates.push("password = ?");
        params.push(hashedPassword);
    }
    if (userData.full_name !== undefined) {
        updates.push("full_name = ?");
        params.push(userData.full_name || null);
    }
    if (userData.phone !== undefined) {
        updates.push("phone = ?");
        params.push(userData.phone || null);
    }
    if (userData.role !== undefined) {
        updates.push("role = ?");
        params.push(userData.role);
    }
    if (userData.is_active !== undefined) {
        updates.push("is_active = ?");
        params.push(userData.is_active ? 1 : 0);
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    await executeQuery(
        `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
        params
    );
    return "User updated successfully";
}

/**
 * Update user's own profile
 * @param id User ID
 * @param profileData Profile data
 * @returns Promise with updated user
 */
export async function updateUserProfile(
    id: number,
    profileData: {
        username?: string;
        email?: string;
        full_name?: string;
        phone?: string;
        currentPassword?: string;
        newPassword?: string;
    }
): Promise<User | null> {
    const updates: string[] = [];
    const params: any[] = [];

    if (profileData.username) {
        updates.push("username = ?");
        params.push(profileData.username);
    }
    if (profileData.email) {
        updates.push("email = ?");
        params.push(profileData.email);
    }
    if (profileData.full_name !== undefined) {
        updates.push("full_name = ?");
        params.push(profileData.full_name || null);
    }
    if (profileData.phone !== undefined) {
        updates.push("phone = ?");
        params.push(profileData.phone || null);
    }

    // Handle password change
    if (profileData.newPassword && profileData.currentPassword) {
        // Verify current password
        const result = await queryDatabase(
            "SELECT password FROM users WHERE id = ?",
            [id]
        );
        const users = resultToObjects(result);
        if (users.length === 0) {
            throw new Error("User not found");
        }

        const isValid = await invoke<boolean>("verify_password", {
            password: profileData.currentPassword,
            hash: users[0].password,
        });

        if (!isValid) {
            throw new Error("Current password is incorrect");
        }

        const hashedPassword = await invoke<string>("hash_password", {
            password: profileData.newPassword,
        });
        updates.push("password = ?");
        params.push(hashedPassword);
    }

    if (updates.length > 0) {
        updates.push("updated_at = CURRENT_TIMESTAMP");
        params.push(id);

        await executeQuery(
            `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
            params
        );
    }

    return getUserById(id);
}

/**
 * Delete a user
 * @param id User ID
 * @returns Promise with success message
 */
export async function deleteUser(id: number): Promise<string> {
    await executeQuery("DELETE FROM users WHERE id = ?", [id]);
    return "User deleted successfully";
}

/**
 * Toggle user active status
 * @param id User ID
 * @param isActive New active status
 * @returns Promise with success message
 */
export async function toggleUserStatus(id: number, isActive: boolean): Promise<string> {
    await executeQuery(
        "UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [isActive ? 1 : 0, id]
    );
    return "User status updated successfully";
}

/**
 * Get user stats
 * @returns Promise with user statistics
 */
export async function getUserStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    admins: number;
}> {
    const result = await queryDatabase(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive,
      SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins
    FROM users
  `);
    const stats = resultToObjects(result)[0];
    return {
        total: stats.total || 0,
        active: stats.active || 0,
        inactive: stats.inactive || 0,
        admins: stats.admins || 0,
    };
}
