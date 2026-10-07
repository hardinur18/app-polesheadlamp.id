import fs from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const envFiles = [".env.local", ".env", "supabase/functions/.env.local"];

for (const file of envFiles) {
  if (!fs.existsSync(file)) continue;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL/key. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY or service role env.");
  process.exit(1);
}

const normalizePhone = (value) => {
  const digits = String(value || "").trim().replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("620")) return `62${digits.slice(3)}`;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
};

const normalizeName = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("id-ID");

const openStatuses = new Set(["Pending", "Follow Up", "Booking"]);
const supabase = createClient(supabaseUrl, supabaseKey);

const pageSize = 1000;
let from = 0;
const rows = [];

while (true) {
  const { data, error } = await supabase
    .from("leads")
    .select("id,name,phone,status,cs_id,created_at")
    .range(from, from + pageSize - 1)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error.message || error);
    process.exit(1);
  }

  rows.push(...(data || []));
  if (!data || data.length < pageSize) break;
  from += pageSize;
}

const exact = new Map();
const byPhone = new Map();

for (const row of rows) {
  if (!openStatuses.has(row.status)) continue;
  const phone = normalizePhone(row.phone);
  const name = normalizeName(row.name);
  if (!phone) continue;

  const phoneList = byPhone.get(phone) || [];
  phoneList.push(row);
  byPhone.set(phone, phoneList);

  if (!name) continue;
  const exactKey = `${phone}|${name}`;
  const exactList = exact.get(exactKey) || [];
  exactList.push(row);
  exact.set(exactKey, exactList);
}

const exactDuplicates = [...exact.values()].filter((items) => items.length > 1);
const phoneDuplicates = [...byPhone.values()].filter((items) => items.length > 1);

console.log(`Total leads read: ${rows.length}`);
console.log(`Open exact duplicate groups (name + phone): ${exactDuplicates.length}`);
console.log(`Open phone duplicate groups: ${phoneDuplicates.length}`);

const printGroup = (title, groups) => {
  console.log(`\n${title}`);
  for (const group of groups.slice(0, 20)) {
    console.log(`- ${group[0].phone} / ${group[0].name} (${group.length} rows)`);
    for (const item of group.slice(0, 5)) {
      console.log(`  ${item.id} | ${item.status} | ${item.cs_id || "-"} | ${item.created_at || "-"}`);
    }
  }
};

printGroup("Top exact duplicates", exactDuplicates);
printGroup("Top phone duplicates", phoneDuplicates);
