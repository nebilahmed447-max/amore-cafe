import { Product } from "./types";

export const CATALOG_KEY = "amore-products-v2";

function cleanBool(value: string | undefined, fallback = false) {
  if (value === undefined) return fallback;
  return ["true", "1", "yes", "y"].includes(value.trim().toLowerCase());
}

export function normalizeProduct(row: Record<string, string>): Product | null {
  const name = (row.name || "").trim();
  if (!name) return null;
  return {
    id: (row.id || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")).trim(),
    name,
    amharic: (row.amharic || row.name_am || "").trim(),
    category: (row.category || "Burgers").trim(),
    price: Number(row.price || 0),
    image: (row.image || row.image_url || "").trim(),
    description: (row.description || "").trim(),
    prepTime: Number(row.prep_time || row.prepTime || 0),
    takeawayPackFee: Number(row.takeaway_pack_fee || row.takeawayPackFee || 0),
    popular: cleanBool(row.popular),
    fasting: cleanBool(row.fasting),
    available: row.available === undefined ? true : cleanBool(row.available, true),
  };
}

export function parseCSV(text: string): Product[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i++; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === ',' && !quoted) { row.push(cell); cell = ""; continue; }
    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell); cell = "";
      if (row.some(v => v.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  if (cell || row.length) { row.push(cell); if (row.some(v => v.trim() !== "")) rows.push(row); }
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1).map(values => normalizeProduct(Object.fromEntries(headers.map((h, i) => [h, values[i] || ""]))))
    .filter((p): p is Product => Boolean(p));
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function productsToCSV(products: Product[]) {
  const headers = ["id","name","amharic","category","price","image","description","prep_time","takeaway_pack_fee","popular","fasting","available"];
  return [headers.join(","), ...products.map(p => headers.map(h => csvCell((p as any)[h])).join(","))].join("\n");
}

export function saveCatalog(products: Product[]) {
  localStorage.setItem(CATALOG_KEY, JSON.stringify(products));
  window.dispatchEvent(new Event("amore-catalog-updated"));
}

export function loadCatalog(): Product[] | null {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}
