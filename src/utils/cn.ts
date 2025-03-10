/**
 * Tailwind CSS class merging utility
 * ---------------------------------
 * Combines multiple class names while handling Tailwind conflicts.
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines multiple class names and resolves Tailwind CSS conflicts
 * @param inputs Any number of class name arguments
 * @returns Merged class string with conflicts resolved
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
