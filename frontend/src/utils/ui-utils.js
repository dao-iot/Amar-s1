import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility for combining tailwind classes safely
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Unit formatters for futuristic UI
 */
export const units = {
  speed: 'km/h',
  voltage: 'V',
  current: 'A',
  soc: '%',
  temp: '°C',
  rpm: 'RPM'
};

/**
 * Severity to color mapping
 */
export const severityColors = {
  CRITICAL: 'text-red-400 border-red-500/50 bg-red-500/10',
  WARNING: 'text-amber-400 border-amber-500/50 bg-amber-500/10',
  INFO: 'text-cyan-400 border-cyan-500/50 bg-cyan-500/10'
};
