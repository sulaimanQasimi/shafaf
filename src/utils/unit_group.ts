import { invoke } from "@tauri-apps/api/core";

export interface UnitGroup {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

/**
 * Initialize the unit_groups table schema
 * @returns Promise with success message
 */
export async function initUnitGroupsTable(): Promise<string> {
  return await invoke<string>("init_unit_groups_table");
}

/**
 * Get all unit groups
 * @returns Promise with array of UnitGroup
 */
export async function getUnitGroups(): Promise<UnitGroup[]> {
  return await invoke<UnitGroup[]>("get_unit_groups");
}

/**
 * Create a new unit group
 * @param name Unit group name (in Persian/Dari)
 * @returns Promise with UnitGroup
 */
export async function createUnitGroup(name: string): Promise<UnitGroup> {
  return await invoke<UnitGroup>("create_unit_group", {
    name,
  });
}
