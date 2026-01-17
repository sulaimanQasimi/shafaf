import { getProducts } from './product';
import { getSuppliers } from './supplier';
import { getPurchases } from './purchase';
import { getSales } from './sales';
import moment from 'moment-jalaali';

export interface DashboardStats {
  productsCount: number;
  suppliersCount: number;
  purchasesCount: number;
  monthlyIncome: number;
}

/**
 * Get dashboard statistics
 * @returns Promise with dashboard stats
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    // Get all data in parallel
    const [products, suppliers, purchases, sales] = await Promise.all([
      getProducts(),
      getSuppliers(),
      getPurchases(),
      getSales(),
    ]);

    // Get current month in Georgian calendar (for database comparison)
    const now = moment();
    const currentMonthStart = now.startOf('month').format('YYYY-MM-DD');
    const currentMonthEnd = now.endOf('month').format('YYYY-MM-DD');

    // Calculate monthly income from sales
    const monthlyIncome = sales
      .filter((sale) => {
        // Filter sales from current month
        const saleDate = sale.date; // Already in YYYY-MM-DD format (Georgian)
        return saleDate >= currentMonthStart && saleDate <= currentMonthEnd;
      })
      .reduce((sum, sale) => sum + (sale.paid_amount || 0), 0);

    return {
      productsCount: products.length,
      suppliersCount: suppliers.length,
      purchasesCount: purchases.length,
      monthlyIncome,
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    // Return default values on error
    return {
      productsCount: 0,
      suppliersCount: 0,
      purchasesCount: 0,
      monthlyIncome: 0,
    };
  }
}

/**
 * Format number with Persian digits and thousand separators
 * @param num Number to format
 * @returns Formatted string with Persian digits
 */
export function formatPersianNumber(num: number): string {
  return new Intl.NumberFormat('fa-IR').format(num);
}

/**
 * Format large numbers with K, M suffixes in Persian
 * @param num Number to format
 * @returns Formatted string
 */
export function formatLargeNumber(num: number): string {
  if (num >= 1000000) {
    const millions = num / 1000000;
    return `${formatPersianNumber(Math.round(millions * 10) / 10)}M`;
  } else if (num >= 1000) {
    const thousands = num / 1000;
    return `${formatPersianNumber(Math.round(thousands * 10) / 10)}K`;
  }
  return formatPersianNumber(Math.round(num));
}
