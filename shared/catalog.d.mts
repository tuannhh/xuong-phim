// Kiểu cho shared/catalog.mjs (để remotion/ đọc chung một danh mục bối cảnh).
export const KINDS: Record<string, { label: string; gender: 'nam' | 'nu' | 'ca' }>;
export const HAIRS: { nam: Record<string, string>; nu: Record<string, string> };
export const SETS: Record<string, { label: string; times: string[] }>;
export const MASCOTS: Record<string, unknown>;
export function allHairs(): Record<string, string>;
