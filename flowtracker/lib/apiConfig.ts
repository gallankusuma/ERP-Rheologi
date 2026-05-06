/**
 * FlowTracker API Configuration
 * 
 * In development: call VPS API directly
 * In production: call VPS API (same server, different port behind Nginx)
 */

// VPS API Base URL — the FlowTracker scraper service
const VPS_DIRECT = "http://76.13.22.155:3100";

// Use environment variable or fallback to VPS direct
export const API_BASE = typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_API_BASE || VPS_DIRECT)
  : (process.env.API_BASE || "http://localhost:3100");

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
