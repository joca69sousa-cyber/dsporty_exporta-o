import { ProductData } from './types';

// App ID fallback
export const APP_ID = typeof (window as any).__app_id !== 'undefined' ? (window as any).__app_id : 'default-app-id';

// Admin Password
export const ADMIN_MASTER_KEY = "producao2026";

export const PRODUCT_OPTIONS = ['Regata', 'Short', 'Conjunto', 'Camisa', 'Bandeira', 'Basqueteira'];
export const VALUE_PER_SHEET = 0.05;

export const PRODUCT_DATA: Record<string, ProductData> = {
    'Regata': { sheets: 2, value: 2 * VALUE_PER_SHEET, color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800' },
    'Short': { sheets: 2, value: 2 * VALUE_PER_SHEET, color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-800' },
    'Conjunto': { sheets: 5, value: 5 * VALUE_PER_SHEET, color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800' },
    'Camisa': { sheets: 3, value: 3 * VALUE_PER_SHEET, color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800' },
    'Bandeira': { sheets: 0, value: 3.00, color: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800' },
    'Basqueteira': { sheets: 2, value: 2 * VALUE_PER_SHEET, color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800' }
};

export const calculateValue = (product: string, quantity: number) => {
    const data = PRODUCT_DATA[product];
    return data ? (product === 'Bandeira' ? data.value * quantity : data.value * quantity) : 0;
};
