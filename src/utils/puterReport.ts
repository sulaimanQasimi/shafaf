import { queryDatabase } from "./db";
import { REPORT_SCHEMA } from "./reportSchema";

declare global {
  interface Window {
    puter?: {
      ai?: {
        chat: (
          prompt: string | { role: string; content: string }[],
          options?: { tools?: unknown[]; model?: string }
        ) => Promise<{ message?: { content?: string; tool_calls?: PuterToolCall[] }; text?: string }>;
      };
    };
  }
}

interface PuterToolCall {
  id: string;
  function: { name: string; arguments: string };
}

export interface ReportTableColumn {
  key: string;
  label: string;
}

export interface ReportTable {
  columns: ReportTableColumn[];
  rows: Record<string, unknown>[];
}

export interface ReportChartSeries {
  name: string;
  data: number[];
}

export interface ReportChart {
  type: "line" | "bar" | "area" | "pie" | "donut";
  categories?: string[];
  series: ReportChartSeries[];
  labels?: string[];
}

export interface ReportSection {
  type: "table" | "chart";
  title: string;
  table?: ReportTable;
  chart?: ReportChart;
}

export interface ReportJson {
  title: string;
  summary?: string;
  sections: ReportSection[];
}

const SYSTEM_PROMPT = `You are a report generator for a Persian/English finance and inventory app. Use ONLY the run_query tool to fetch data. SQL must be SELECT only. Use SUM, COUNT, AVG, GROUP BY, JOIN across the tables as needed. Prefer LIMIT 500 for large listing queries.

Database schema:
${REPORT_SCHEMA}

Your final response must be ONLY a valid JSON object (no markdown, no \`\`\`json, no extra text) with this exact structure:
{
  "title": "string",
  "summary": "string or omit",
  "sections": [
    {
      "type": "table",
      "title": "string",
      "table": {
        "columns": [{"key": "colKey", "label": "Display Label"}],
        "rows": [{"colKey": "value", ...}]
      }
    },
    {
      "type": "chart",
      "title": "string",
      "chart": {
        "type": "line"|"bar"|"area"|"pie"|"donut",
        "categories": ["cat1","cat2"],
        "series": [{"name": "string", "data": [1,2,3]}],
        "labels": ["l1","l2"]
      }
    }
  ]
}
- For table: convert query result columns/rows into columns (key=column name, label=human label) and rows as objects keyed by column.
- For line/bar/area: categories = x-axis, series = [{name, data}].
- For pie/donut: series[0].data = values, labels = slice labels.
Respond ONLY with the JSON object.`;

const RUN_QUERY_TOOL = {
  type: "function" as const,
  function: {
    name: "run_query",
    description:
      "Execute a read-only SELECT query on the database. Use for report data. SQL must be SELECT only. params: JSON array string, e.g. '[]' or '[\"2024-01-01\"]'.",
    parameters: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SELECT query" },
        params: { type: "string", description: "JSON array of parameters" }
      },
      required: ["sql"] as const
    }
  }
};

function isSelectOnly(sql: string): boolean {
  const t = sql.trim().toUpperCase();
  return t.startsWith("SELECT");
}

async function handleRunQuery(args: { sql?: string; params?: string }): Promise<string> {
  const sql = args?.sql;
  if (!sql || typeof sql !== "string") {
    return JSON.stringify({ error: "Missing sql" });
  }
  if (!isSelectOnly(sql)) {
    return JSON.stringify({ error: "Only SELECT queries are allowed" });
  }
  let params: unknown[] = [];
  try {
    params = JSON.parse(args?.params || "[]");
  } catch {
    params = [];
  }
  if (!Array.isArray(params)) params = [];
  const res = await queryDatabase(sql, params);
  return JSON.stringify({ columns: res.columns, rows: res.rows });
}

function extractJson(text: string): string {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) return m[1].trim();
  return text.trim();
}

export function isPuterAvailable(): boolean {
  return typeof window !== "undefined" && !!window.puter?.ai?.chat;
}

export async function generateReport(userPrompt: string): Promise<ReportJson> {
  const puter = (typeof window !== "undefined" && window.puter) || undefined;
  if (!puter?.ai?.chat) {
    throw new Error("Puter SDK بارگذاری نشده. شناسه اپ و توکن Puter را وارد کرده و «اعمال» بزنید.");
  }

  const messages: { role: string; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt }
  ];

  const tools = [RUN_QUERY_TOOL];
  let response = await puter.ai.chat(messages, { tools });

  while (response?.message?.tool_calls?.length) {
    const msg = response.message;
    const assistantMsg: Record<string, unknown> = { role: "assistant", content: msg.content || "" };
    if (msg.tool_calls?.length) assistantMsg.tool_calls = msg.tool_calls;
    messages.push(assistantMsg as { role: string; content: string });

    for (const tc of msg.tool_calls ?? []) {
      if (tc.function?.name !== "run_query") continue;
      let args: { sql?: string; params?: string } = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}");
      } catch {
        args = {};
      }
      const content = await handleRunQuery(args);
      messages.push({ role: "tool", content, tool_call_id: tc.id } as { role: string; content: string; tool_call_id: string });
    }

    response = await puter.ai.chat(messages, { tools });
  }

  const raw = (response?.message?.content ?? response?.text ?? "").trim();
  if (!raw) throw new Error("Empty response from AI.");

  const jsonStr = extractJson(raw);
  let report: ReportJson;
  try {
    report = JSON.parse(jsonStr) as ReportJson;
  } catch (e) {
    throw new Error(`Invalid report JSON: ${(e as Error).message}. Raw: ${raw.slice(0, 500)}`);
  }

  if (!report || typeof report.title !== "string" || !Array.isArray(report.sections)) {
    throw new Error("Report must have title and sections array.");
  }

  return report;
}
