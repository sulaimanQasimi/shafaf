import { invoke } from "@tauri-apps/api/core";

export interface CoaCategory {
    id: number;
    parent_id: number | null;
    name: string;
    code: string;
    category_type: string; // Asset, Liability, Equity, Revenue, Expense
    level: number;
    created_at: string;
    updated_at: string;
}

/**
 * Initialize the COA categories table schema
 * @returns Promise with success message
 */
export async function initCoaCategoriesTable(): Promise<string> {
    return await invoke<string>("init_coa_categories_table");
}

/**
 * Initialize all standard COA categories statically
 * @returns Promise with success message
 */
export async function initStandardCoaCategories(): Promise<string> {
    return await invoke<string>("init_standard_coa_categories");
}

/**
 * Create a new COA category
 * @param parent_id Parent category ID (optional for root categories)
 * @param name Category name
 * @param code Category code (unique)
 * @param category_type Category type (Asset, Liability, Equity, Revenue, Expense)
 * @returns Promise with CoaCategory
 */
export async function createCoaCategory(
    parent_id: number | null,
    name: string,
    code: string,
    category_type: string
): Promise<CoaCategory> {
    return await invoke<CoaCategory>("create_coa_category", {
        parentId: parent_id,
        name,
        code,
        categoryType: category_type,
    });
}

/**
 * Get all COA categories
 * @returns Promise with array of CoaCategory
 */
export async function getCoaCategories(): Promise<CoaCategory[]> {
    return await invoke<CoaCategory[]>("get_coa_categories");
}

/**
 * Get COA category tree (hierarchical structure)
 * @returns Promise with array of CoaCategory (frontend can build tree)
 */
export async function getCoaCategoryTree(): Promise<CoaCategory[]> {
    return await invoke<CoaCategory[]>("get_coa_category_tree");
}

/**
 * Update a COA category
 * @param id Category ID
 * @param parent_id Parent category ID (optional)
 * @param name Category name
 * @param code Category code
 * @param category_type Category type
 * @returns Promise with CoaCategory
 */
export async function updateCoaCategory(
    id: number,
    parent_id: number | null,
    name: string,
    code: string,
    category_type: string
): Promise<CoaCategory> {
    return await invoke<CoaCategory>("update_coa_category", {
        id,
        parentId: parent_id,
        name,
        code,
        categoryType: category_type,
    });
}

/**
 * Delete a COA category
 * @param id Category ID
 * @returns Promise with success message
 */
export async function deleteCoaCategory(id: number): Promise<string> {
    return await invoke<string>("delete_coa_category", { id });
}

/**
 * Build a tree structure from flat category list
 * @param categories Flat list of categories
 * @returns Tree structure with children
 */
export function buildCategoryTree(categories: CoaCategory[]): (CoaCategory & { children?: CoaCategory[] })[] {
    const categoryMap = new Map<number, CoaCategory & { children?: CoaCategory[] }>();
    const rootCategories: (CoaCategory & { children?: CoaCategory[] })[] = [];

    // First pass: create map of all categories
    categories.forEach(cat => {
        categoryMap.set(cat.id, { ...cat, children: [] });
    });

    // Second pass: build tree structure
    categories.forEach(cat => {
        const category = categoryMap.get(cat.id)!;
        if (cat.parent_id === null) {
            rootCategories.push(category);
        } else {
            const parent = categoryMap.get(cat.parent_id);
            if (parent) {
                if (!parent.children) {
                    parent.children = [];
                }
                parent.children.push(category);
            }
        }
    });

    return rootCategories;
}
