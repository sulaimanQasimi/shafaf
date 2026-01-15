import moment from 'moment-jalaali';

/**
 * Convert Persian (Jalali) date string to Georgian date string
 * Input format: "YYYY/MM/DD" (Persian)
 * Output format: "YYYY-MM-DD" (Georgian) for database storage
 */
export function persianToGeorgian(persianDate: string): string {
  if (!persianDate) return '';
  
  // Parse Persian date (format: YYYY/MM/DD)
  const parts = persianDate.split('/');
  if (parts.length !== 3) return '';
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  
  if (isNaN(year) || isNaN(month) || isNaN(day)) return '';
  
  // Convert to Georgian using moment-jalaali
  const georgianDate = moment(`${year}/${month}/${day}`, 'jYYYY/jMM/jDD');
  return georgianDate.format('YYYY-MM-DD');
}

/**
 * Convert Georgian date string to Persian (Jalali) date string
 * Input format: "YYYY-MM-DD" (Georgian from database)
 * Output format: "YYYY/MM/DD" (Persian) for display
 */
export function georgianToPersian(georgianDate: string): string {
  if (!georgianDate) return '';
  
  // Parse Georgian date
  const date = moment(georgianDate, 'YYYY-MM-DD');
  if (!date.isValid()) return '';
  
  // Convert to Persian
  return date.format('jYYYY/jMM/jDD');
}

/**
 * Get current Persian date in YYYY/MM/DD format
 */
export function getCurrentPersianDate(): string {
  return moment().format('jYYYY/jMM/jDD');
}

/**
 * Format Persian date for display (e.g., "1403/01/15")
 */
export function formatPersianDate(date: string): string {
  if (!date) return '';
  return georgianToPersian(date);
}

/**
 * Format Persian date with Persian month names for display
 */
export function formatPersianDateLong(georgianDate: string): string {
  if (!georgianDate) return '';
  
  const date = moment(georgianDate, 'YYYY-MM-DD');
  if (!date.isValid()) return '';
  
  // Get Persian month names
  const monthNames = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
  ];
  
  const jYear = date.jYear();
  const jMonth = date.jMonth();
  const jDay = date.jDate();
  
  return `${jDay} ${monthNames[jMonth]} ${jYear}`;
}
