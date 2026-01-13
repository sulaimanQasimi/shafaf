import { invoke } from "@tauri-apps/api/core";

export interface Unit {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

/**
 * Initialize the units table schema
 * @returns Promise with success message
 */
export async function initUnitsTable(): Promise<string> {
  return await invoke<string>("init_units_table");
}

/**
 * Create a new unit
 * @param name Unit name (in Persian/Dari)
 * @returns Promise with Unit
 */
export async function createUnit(name: string): Promise<Unit> {
  return await invoke<Unit>("create_unit", {
    name,
  });
}

/**
 * Get all units
 * @returns Promise with array of Unit
 */
export async function getUnits(): Promise<Unit[]> {
  return await invoke<Unit[]>("get_units");
}

/**
 * Update a unit
 * @param id Unit ID
 * @param name Unit name (in Persian/Dari)
 * @returns Promise with Unit
 */
export async function updateUnit(id: number, name: string): Promise<Unit> {
  return await invoke<Unit>("update_unit", {
    id,
    name,
  });
}

/**
 * Delete a unit
 * @param id Unit ID
 * @returns Promise with success message
 */
export async function deleteUnit(id: number): Promise<string> {
  return await invoke<string>("delete_unit", { id });
}
