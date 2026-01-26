import { createCurrency, updateCurrency, getCurrencies } from "./currency";
import { createSupplier, updateSupplier, getSuppliers } from "./supplier";
import { createCustomer, updateCustomer } from "./customer";
import { createUnit, updateUnit } from "./unit";
import { createUnitGroup } from "./unit_group";
import { createExpenseType, updateExpenseType } from "./expense_type";
import { createProduct, updateProduct } from "./product";

export interface CreateUpdateIntent {
  action: "create" | "update";
  entity: string;
  data: Record<string, unknown>;
}

export interface GenerateCreateUpdateOptions {
  model?: string;
  lookups?: {
    currencies?: { id: number; name: string }[];
    suppliers?: { id: number; full_name: string }[];
  };
}

const ENTITIES = [
  "currency",
  "supplier",
  "customer",
  "unit",
  "unit_group",
  "expense_type",
  "product",
] as const;

function normalizeEntity(s: string): string {
  const low = s.toLowerCase().trim();
  if (low === "expensetype") return "expense_type";
  if (low === "unitgroup") return "unit_group";
  return low;
}

const SYSTEM_PROMPT_BASE = `You are a create/update assistant for a Persian/English finance and inventory app. You ONLY support create and update. No delete, no read.

Supported entities and fields (use camelCase: fullName, currencyId, supplierId, stockQuantity, groupId, imagePath, barCode):
- currency: name (required), base (boolean, default false), rate (number, default 1). Update: id (required).
- supplier: fullName (required), phone (required), address (required), email (optional), notes (optional). Update: id (required).
- customer: fullName (required), phone (required), address (required), email (optional), notes (optional). Update: id (required).
- unit: name (required), groupId (optional), ratio (optional, number), isBase (optional, boolean). Update: id (required).
- unit_group: name (required). CREATE ONLY, no update.
- expense_type: name (required). Update: id (required).
- product: name (required), description (optional), price (optional), currencyId (optional), supplierId (optional), currencyName (optional, resolve to currencyId), supplierName (optional, resolve to supplierId), stockQuantity (optional), unit (optional), imagePath (optional), barCode (optional). Update: id (required).

Output ONLY a valid JSON object, no markdown, no \`\`\`json, no extra text:
{ "action": "create" | "update", "entity": "<entity>", "data": { ... } }`;

function extractJson(text: string): string {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) return m[1].trim();
  return text.trim();
}

export async function generateCreateUpdateIntent(
  userPrompt: string,
  opts?: GenerateCreateUpdateOptions
): Promise<CreateUpdateIntent> {
  const w = typeof window !== "undefined" ? (window as Window & { puter?: { ai?: { chat: unknown } } }) : undefined;
  const puter = w?.puter;
  if (!puter?.ai?.chat) {
    throw new Error("Puter SDK بارگذاری نشده. شناسه اپ و توکن Puter را وارد کرده و «اعمال» بزنید.");
  }

  let systemPrompt = SYSTEM_PROMPT_BASE;
  if (opts?.lookups) {
    const parts: string[] = [];
    if (opts.lookups.currencies?.length) {
      parts.push("Available currencies: " + JSON.stringify(opts.lookups.currencies.map((c) => ({ id: c.id, name: c.name }))));
    }
    if (opts.lookups.suppliers?.length) {
      parts.push("Available suppliers: " + JSON.stringify(opts.lookups.suppliers.map((s) => ({ id: s.id, full_name: s.full_name }))));
    }
    if (parts.length) systemPrompt += "\n\n" + parts.join(". ");
  }

  const chat = puter.ai.chat as (
    messages: { role: string; content: string }[],
    options?: { model?: string }
  ) => Promise<{ message?: { content?: string }; text?: string }>;

  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  let response = await chat(messages, { model: opts?.model });
  let raw = (response?.message?.content ?? response?.text ?? "").trim();
  if (!raw) throw new Error("Empty response from AI.");

  let jsonStr = extractJson(raw);
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    messages.push({ role: "assistant", content: raw });
    messages.push({ role: "user", content: "پاسخ قبلی JSON معتبر نبود. فقط آبجکت JSON را بدون markdown یا متن اضافه برگردان: { \"action\": \"create\"|\"update\", \"entity\": \"...\", \"data\": {} }." });
    const retry = await chat(messages, { model: opts?.model });
    const retryRaw = (retry?.message?.content ?? retry?.text ?? "").trim();
    if (!retryRaw) throw new Error("Invalid JSON after retry. " + (e as Error).message);
    jsonStr = extractJson(retryRaw);
    parsed = JSON.parse(jsonStr);
  }

  const obj = parsed as Record<string, unknown>;
  if (!obj || typeof obj.action !== "string" || typeof obj.entity !== "string" || !obj.data || typeof obj.data !== "object") {
    throw new Error("Intent must have action, entity, and data.");
  }
  if (obj.action !== "create" && obj.action !== "update") {
    throw new Error("Action must be create or update.");
  }
  const entity = normalizeEntity(obj.entity);
  if (!(ENTITIES as readonly string[]).includes(entity)) {
    throw new Error("Entity not supported: " + obj.entity);
  }

  return {
    action: obj.action as "create" | "update",
    entity,
    data: obj.data as Record<string, unknown>,
  };
}

function getStr(d: Record<string, unknown>, k: string, def: string = ""): string {
  const v = d[k];
  if (v == null) return def;
  return String(v).trim();
}

function getNum(d: Record<string, unknown>, k: string): number | null {
  const v = d[k];
  if (v == null) return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function getBool(d: Record<string, unknown>, k: string): boolean {
  const v = d[k];
  if (v == null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return /^(1|true|yes|بله|آری)$/i.test(v.trim());
  return Boolean(v);
}

export async function executeIntent(
  intent: CreateUpdateIntent
): Promise<{ success: boolean; message: string; result?: unknown }> {
  const { action, entity, data } = intent;

  if (entity === "unit_group" && action === "update") {
    return { success: false, message: "unit_group فقط ایجاد دارد، بروزرسانی پشتیبانی نمی‌شود." };
  }

  // Resolve currencyName/supplierName for product
  if (entity === "product") {
    const d = data as Record<string, unknown>;
    if (d.currencyName && d.currencyId == null) {
      try {
        const list = await getCurrencies();
        const c = list.find((x) => String(x.name).toLowerCase() === String(d.currencyName).toLowerCase());
        if (c) d.currencyId = c.id; else return { success: false, message: "ارز با نام «" + d.currencyName + "» یافت نشد." };
      } catch (e) {
        return { success: false, message: (e as Error).message };
      }
    }
    if (d.supplierName && d.supplierId == null) {
      try {
        const resp = await getSuppliers(1, 500, "");
        const s = resp.items.find((x) => String(x.full_name || "").toLowerCase() === String(d.supplierName).toLowerCase());
        if (s) d.supplierId = s.id; else return { success: false, message: "تمویل‌کننده با نام «" + d.supplierName + "» یافت نشد." };
      } catch (e) {
        return { success: false, message: (e as Error).message };
      }
    }
    delete d.currencyName;
    delete d.supplierName;
  }

  try {
    switch (entity) {
      case "currency": {
        const name = getStr(data, "name");
        if (!name) return { success: false, message: "نام ارز الزامی است." };
        const base = getBool(data, "base");
        const rate = getNum(data, "rate") ?? 1;
        if (action === "create") {
          const r = await createCurrency(name, base, rate);
          return { success: true, message: "ارز " + name + " ایجاد شد.", result: r };
        } else {
          const id = getNum(data, "id");
          if (id == null) return { success: false, message: "برای بروزرسانی ارز، id الزامی است." };
          const r = await updateCurrency(id, name, base, rate);
          return { success: true, message: "ارز " + name + " بروزرسانی شد.", result: r };
        }
      }
      case "supplier": {
        const fullName = getStr(data, "fullName");
        const phone = getStr(data, "phone");
        const address = getStr(data, "address");
        if (!fullName || !phone || !address) return { success: false, message: "نام، تلفن و آدرس تمویل‌کننده الزامی است." };
        const email = getStr(data, "email") || null;
        const notes = getStr(data, "notes") || null;
        if (action === "create") {
          const r = await createSupplier(fullName, phone, address, email, notes);
          return { success: true, message: "تمویل‌کننده " + fullName + " ایجاد شد.", result: r };
        } else {
          const id = getNum(data, "id");
          if (id == null) return { success: false, message: "برای بروزرسانی تمویل‌کننده، id الزامی است." };
          const r = await updateSupplier(id, fullName, phone, address, email, notes);
          return { success: true, message: "تمویل‌کننده " + fullName + " بروزرسانی شد.", result: r };
        }
      }
      case "customer": {
        const fullName = getStr(data, "fullName");
        const phone = getStr(data, "phone");
        const address = getStr(data, "address");
        if (!fullName || !phone || !address) return { success: false, message: "نام، تلفن و آدرس مشتری الزامی است." };
        const email = getStr(data, "email") || null;
        const notes = getStr(data, "notes") || null;
        if (action === "create") {
          const r = await createCustomer(fullName, phone, address, email, notes);
          return { success: true, message: "مشتری " + fullName + " ایجاد شد.", result: r };
        } else {
          const id = getNum(data, "id");
          if (id == null) return { success: false, message: "برای بروزرسانی مشتری، id الزامی است." };
          const r = await updateCustomer(id, fullName, phone, address, email, notes);
          return { success: true, message: "مشتری " + fullName + " بروزرسانی شد.", result: r };
        }
      }
      case "unit": {
        const name = getStr(data, "name");
        if (!name) return { success: false, message: "نام واحد الزامی است." };
        const groupId = getNum(data, "groupId") ?? null;
        const ratio = getNum(data, "ratio") ?? 1;
        const isBase = getBool(data, "isBase");
        if (action === "create") {
          const r = await createUnit(name, groupId, ratio, isBase);
          return { success: true, message: "واحد " + name + " ایجاد شد.", result: r };
        } else {
          const id = getNum(data, "id");
          if (id == null) return { success: false, message: "برای بروزرسانی واحد، id الزامی است." };
          const r = await updateUnit(id, name, groupId, ratio, isBase);
          return { success: true, message: "واحد " + name + " بروزرسانی شد.", result: r };
        }
      }
      case "unit_group": {
        if (action === "update") return { success: false, message: "unit_group فقط ایجاد دارد." };
        const name = getStr(data, "name");
        if (!name) return { success: false, message: "نام گروه واحد الزامی است." };
        const r = await createUnitGroup(name);
        return { success: true, message: "گروه واحد " + name + " ایجاد شد.", result: r };
      }
      case "expense_type": {
        const name = getStr(data, "name");
        if (!name) return { success: false, message: "نام نوع مصارف الزامی است." };
        if (action === "create") {
          const r = await createExpenseType(name);
          return { success: true, message: "نوع مصارف " + name + " ایجاد شد.", result: r };
        } else {
          const id = getNum(data, "id");
          if (id == null) return { success: false, message: "برای بروزرسانی نوع مصارف، id الزامی است." };
          const r = await updateExpenseType(id, name);
          return { success: true, message: "نوع مصارف " + name + " بروزرسانی شد.", result: r };
        }
      }
      case "product": {
        const name = getStr(data, "name");
        if (!name) return { success: false, message: "نام محصول الزامی است." };
        const description = getStr(data, "description") || null;
        const price = getNum(data, "price") ?? null;
        const currencyId = getNum(data, "currencyId") ?? null;
        const supplierId = getNum(data, "supplierId") ?? null;
        const stockQuantity = getNum(data, "stockQuantity") ?? null;
        const unit = getStr(data, "unit") || null;
        const imagePath = getStr(data, "imagePath") || null;
        const barCode = getStr(data, "barCode") || null;
        if (action === "create") {
          const r = await createProduct(name, description, price, currencyId, supplierId, stockQuantity, unit, imagePath, barCode);
          return { success: true, message: "محصول " + name + " ایجاد شد.", result: r };
        } else {
          const id = getNum(data, "id");
          if (id == null) return { success: false, message: "برای بروزرسانی محصول، id الزامی است." };
          const r = await updateProduct(id, name, description, price, currencyId, supplierId, stockQuantity, unit, imagePath, barCode);
          return { success: true, message: "محصول " + name + " بروزرسانی شد.", result: r };
        }
      }
      default:
        return { success: false, message: "موجودیت پشتیبانی نشده: " + entity };
    }
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}
