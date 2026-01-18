import { getProducts } from './product';
import { getSuppliers } from './supplier';
import { getPurchases } from './purchase';
import { getSales } from './sales';
import { getDeductions } from './deduction';
import moment from 'moment-jalaali';

export interface DashboardStats {
  productsCount: number;
  suppliersCount: number;
  purchasesCount: number;
  monthlyIncome: number;
  deductionsCount: number;
  totalDeductions: number;
}

/**
 * Get dashboard statistics
 * @returns Promise with dashboard stats
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    // Get all data in parallel with large page sizes to get all items
    const [productsResponse, suppliersResponse, purchasesResponse, salesResponse, deductionsResponse] = await Promise.all([
      getProducts(1, 10000), // Get all products
      getSuppliers(1, 10000), // Get all suppliers
      getPurchases(1, 10000), // Get all purchases
      getSales(1, 10000), // Get all sales
      getDeductions(1, 10000), // Get all deductions
    ]);

    // Extract items from paginated responses
    const products = productsResponse.items;
    const suppliers = suppliersResponse.items;
    const purchases = purchasesResponse.items;
    const sales = salesResponse.items;
    const deductions = deductionsResponse.items;

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

    // Calculate total deductions (amount * rate for each deduction)
    const totalDeductions = deductions.reduce((sum, deduction) => {
      return sum + (deduction.amount * deduction.rate);
    }, 0);

    return {
      productsCount: products.length,
      suppliersCount: suppliers.length,
      purchasesCount: purchases.length,
      monthlyIncome,
      deductionsCount: deductions.length,
      totalDeductions,
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    // Return default values on error
    return {
      productsCount: 0,
      suppliersCount: 0,
      purchasesCount: 0,
      monthlyIncome: 0,
      deductionsCount: 0,
      totalDeductions: 0,
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
