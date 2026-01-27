import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Check if the app is running in Tauri environment
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  // Check for Tauri v2
  if ('__TAURI__' in window) {
    return true;
  }
  
  // Also check for Tauri API availability
  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
    return true;
  }
  
  return false;
}

/**
 * Format currency in Ghana Cedis (GHS)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
  }).format(value);
}

/**
 * Format number with locale-specific formatting
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-GH').format(value);
}
