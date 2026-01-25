/**
 * Helpers for PDF and Excel export (AI Report, etc.)
 */

export function sanitizeFilename(s: string): string {
  if (typeof s !== "string" || !s.trim()) return "report";
  return s.replace(/[\\/:*?"<>|]/g, "").trim() || "report";
}

export function sanitizeSheetName(s: string): string {
  if (typeof s !== "string") return "";
  return s.replace(/[\\/*?:[\]]/g, "").trim().slice(0, 31) || "";
}

export function formatCellForExcel(v: unknown): string | number {
  if (v == null) return "";
  return typeof v === "number" ? v : String(v);
}
