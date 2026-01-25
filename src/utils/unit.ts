import { invoke } from "@tauri-apps/api/core";

export interface Unit {
  id: number;
  name: string;
  group_id?: number | null;
  ratio: number;
  is_base: boolean;
  group_name?: string | null;
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
 * @param groupId Optional unit group ID
 * @param ratio Conversion ratio to base unit (default 1)
 * @param isBase Whether this is the base unit in its group (default false)
 * @returns Promise with Unit
 */
export async function createUnit(
  name: string,
  groupId?: number | null,
  ratio?: number,
  isBase?: boolean
): Promise<Unit> {
  return await invoke<Unit>("create_unit", {
    name,
    groupId: groupId ?? null,
    ratio: ratio ?? 1,
    isBase: isBase ?? false,
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
 * @param groupId Optional unit group ID
 * @param ratio Conversion ratio to base unit (default 1)
 * @param isBase Whether this is the base unit in its group (default false)
 * @returns Promise with Unit
 */
export async function updateUnit(
  id: number,
  name: string,
  groupId?: number | null,
  ratio?: number,
  isBase?: boolean
): Promise<Unit> {
  return await invoke<Unit>("update_unit", {
    id,
    name,
    groupId: groupId ?? null,
    ratio: ratio ?? 1,
    isBase: isBase ?? false,
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
