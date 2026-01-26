import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import ReactApexChart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import moment from "moment-jalaali";
import { generateReport, type ReportJson, type ReportSection } from "../utils/puterReport";
import { formatPersianNumber } from "../utils/dashboard";
import { sanitizeFilename, sanitizeSheetName, formatCellForExcel } from "../utils/exportHelpers";

interface AiReportProps {
  onBack: () => void;
}

const LS_PUTER_APP_ID = "shafaf_puter_app_id";
const LS_PUTER_TOKEN = "shafaf_puter_auth_token";
const LS_PUTER_MODEL = "shafaf_puter_model";
const LS_HISTORY = "shafaf_ai_report_history";
const HISTORY_MAX = 5;

const QUICK_PROMPTS: { label: string; prompt: string }[] = [
  { label: "درآمد ماهانه ۶ ماه گذشته", prompt: "درآمد ماهانه ۶ ماه گذشته به تفکیک ماه" },
  { label: "فروش به تفکیک محصول", prompt: "تعداد و مبلغ فروش به تفکیک محصول" },
  { label: "مقایسه خرید و فروش هر ماه", prompt: "مقایسه مجموع خرید و فروش هر ماه" },
  { label: "ده محصول پرفروش", prompt: "ده محصول پرفروش بر اساس تعداد یا مبلغ" },
  { label: "هزینه‌های هر ماه", prompt: "مجموع هزینه‌ها (expenses) به تفکیک ماه" },
  { label: "وضعیت موجودی انبار", prompt: "وضعیت موجودی انبار (محصولات و تعداد)" },
];

const DATE_PRESETS: { id: string; label: string; getRange: () => { from: string; to: string } }[] = [
  { id: "today", label: "امروز", getRange: () => { const d = moment().format("YYYY-MM-DD"); return { from: d, to: d }; } },
  { id: "week", label: "این هفته", getRange: () => ({ from: moment().subtract(6, "days").format("YYYY-MM-DD"), to: moment().format("YYYY-MM-DD") }) },
  { id: "month", label: "این ماه", getRange: () => ({ from: moment().startOf("month").format("YYYY-MM-DD"), to: moment().format("YYYY-MM-DD") }) },
  { id: "3m", label: "۳ ماه", getRange: () => ({ from: moment().subtract(3, "months").format("YYYY-MM-DD"), to: moment().format("YYYY-MM-DD") }) },
  { id: "6m", label: "۶ ماه", getRange: () => ({ from: moment().subtract(6, "months").format("YYYY-MM-DD"), to: moment().format("YYYY-MM-DD") }) },
  { id: "year", label: "امسال", getRange: () => ({ from: moment().startOf("year").format("YYYY-MM-DD"), to: moment().format("YYYY-MM-DD") }) },
];

interface HistoryItem {
  id: number;
  prompt: string;
  title: string;
  timestamp: number;
  report: ReportJson;
}

function formatCellValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") return formatPersianNumber(v);
  return String(v);
}

function applyDatePreset(prompt: string, presetId: string): string {
  const p = DATE_PRESETS.find((x) => x.id === presetId);
  if (!p) return prompt;
  const { from, to } = p.getRange();
  return `${prompt} [بازهٔ زمانی: از ${from} تا ${to}]`;
}

function TableSection({ section }: { section: ReportSection }) {
  const t = section.table;
  if (!t?.columns?.length || !t?.rows) return null;
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 shadow-lg">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            {t.columns.map((c) => (
              <th key={c.key} className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {t.rows.map((row, i) => (
            <tr key={i} className="hover:bg-purple-50/50 dark:hover:bg-gray-700/30">
              {t.columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                  {formatCellValue(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartSection({ section, index }: { section: ReportSection; index: number }) {
  const c = section.chart;
  if (!c?.type || !c?.series?.length) return null;

  // Chart validation: align series/labels/categories lengths
  let categories = c.categories ?? [];
  let labels = c.labels ?? [];
  let series = c.series.map((s) => ({ ...s, data: [...(s.data || [])] }));

  if (c.type === "pie" || c.type === "donut") {
    const vals = series[0]?.data ?? [];
    const n = Math.min(vals.length, labels.length || vals.length);
    if (n === 0) return null;
    series = [{ ...series[0], data: vals.slice(0, n) }];
    labels = (labels.length ? labels : categories).slice(0, n);
  } else {
    const cats = categories.length ? categories : labels;
    const n = Math.min(...[cats.length, ...series.map((s) => s.data.length)].filter(Boolean)) || 0;
    if (n === 0) return null;
    categories = cats.slice(0, n);
    series = series.map((s) => ({ ...s, data: s.data.slice(0, n) }));
  }

  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  const baseOptions: ApexOptions = {
    chart: { id: `report-chart-${index}`, type: c.type as "line" | "bar" | "area" | "pie" | "donut", toolbar: { show: true } },
    theme: { mode: isDark ? "dark" : "light" },
    labels: c.type === "pie" || c.type === "donut" ? labels : undefined,
  };

  let options: ApexOptions = { ...baseOptions };
  let chartSeries: ApexOptions["series"];

  if (c.type === "pie" || c.type === "donut") {
    chartSeries = series[0]?.data ?? [];
    if (c.type === "donut") {
      options.plotOptions = { pie: { donut: { size: "60%" } } };
    }
  } else {
    chartSeries = series.map((s) => ({ name: s.name, data: s.data }));
    options.xaxis = { categories };
  }

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 p-4 shadow-lg">
      <ReactApexChart
        type={c.type as "line" | "bar" | "area" | "pie" | "donut"}
        options={options}
        series={chartSeries}
        height={320}
      />
    </div>
  );
}

const PUTER_SCRIPT_BASE = "https://js.puter.com/v2/";

export default function AiReport({ onBack }: AiReportProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportJson | null>(null);
  const [lastMessages, setLastMessages] = useState<{ role: string; content: string }[] | null>(null);
  const [refinementText, setRefinementText] = useState("");
  const [puterLoaded, setPuterLoaded] = useState(false);
  const [appId, setAppId] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [model, setModel] = useState("");
  const [datePreset, setDatePreset] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const reportRef = useRef<HTMLDivElement>(null);

  const puter = typeof window !== "undefined" ? (window as Window & { puter?: { ai?: { chat: unknown } } }).puter : undefined;
  const puterOk = puterLoaded && !!puter?.ai?.chat;

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedId = localStorage.getItem(LS_PUTER_APP_ID);
      const savedToken = localStorage.getItem(LS_PUTER_TOKEN);
      const savedModel = localStorage.getItem(LS_PUTER_MODEL);
      const savedHistory = localStorage.getItem(LS_HISTORY);
      if (savedId) setAppId(savedId);
      if (savedToken) setAuthToken(savedToken);
      if (savedModel) setModel(savedModel);
      if (savedHistory) {
        const arr = JSON.parse(savedHistory) as HistoryItem[];
        setHistory(Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : []);
      }
    } catch (_) {}
  }, []);

  const loadPuterWithCreds = useCallback((id: string, token: string) => {
    if (typeof window === "undefined") return;
    const w = window as Window & { puter?: { ai?: { chat: unknown } } };
    if (w.puter?.ai?.chat) {
      setPuterLoaded(true);
      setApplying(false);
      try {
        localStorage.setItem(LS_PUTER_APP_ID, id);
        localStorage.setItem(LS_PUTER_TOKEN, token);
      } catch (_) {}
      return;
    }
    const existing = document.querySelector(`script[src^="${PUTER_SCRIPT_BASE}"]`);
    if (existing) existing.remove();
    (window as Window & { __puterAppId?: string; __puterAuthToken?: string }).__puterAppId = id;
    (window as Window & { __puterAuthToken?: string }).__puterAuthToken = token;
    const params = new URLSearchParams({ appId: id, authToken: token });
    const src = `${PUTER_SCRIPT_BASE}?${params.toString()}`;
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => {
      setApplying(false);
      const pw = window as Window & { puter?: { ai?: { chat: unknown } } };
      setPuterLoaded(!!pw.puter?.ai?.chat);
      if (pw.puter?.ai?.chat) {
        try {
          localStorage.setItem(LS_PUTER_APP_ID, id);
          localStorage.setItem(LS_PUTER_TOKEN, token);
        } catch (_) {}
      } else {
        setError("Puter SDK بارگذاری شد ولی ai.chat در دسترس نیست.");
      }
    };
    s.onerror = () => {
      setApplying(false);
      setError("بارگذاری Puter ناموفق بود. اتصال شبکه و مقدارهای وارد شده را بررسی کنید.");
      setPuterLoaded(false);
    };
    document.body.appendChild(s);
  }, []);

  const handleApply = () => {
    const id = appId.trim();
    const token = authToken.trim();
    if (!id || !token) {
      setError("هر دو فیلد «شناسه اپ Puter» و «توکن احراز هویت Puter» را وارد کنید.");
      return;
    }
    setError(null);
    setApplying(true);
    setPuterLoaded(false);
    loadPuterWithCreds(id, token);
  };

  useEffect(() => {
    if (puterLoaded) return;
    const w = window as Window & { puter?: { ai?: { chat: unknown } } };
    if (w.puter?.ai?.chat) setPuterLoaded(true);
  }, [puterLoaded]);

  const persistHistory = useCallback((next: HistoryItem[]) => {
    setHistory(next);
    try {
      localStorage.setItem(LS_HISTORY, JSON.stringify(next));
    } catch (_) {}
  }, []);

  const runReport = useCallback(
    async (effectivePrompt: string, opts: { isRefinement?: boolean; skipDatePreset?: boolean } = {}) => {
      setLoading(true);
      setError(null);
      setReport(null);
      try {
        const res = opts.isRefinement
          ? await generateReport("", {
              previousMessages: lastMessages ?? undefined,
              refinementText: effectivePrompt,
              model: model || undefined,
            })
          : await generateReport(effectivePrompt, { model: model || undefined });

        setReport(res.report);
        setLastMessages(res.messages);

        const toAdd: HistoryItem = {
          id: Date.now(),
          prompt: effectivePrompt,
          title: res.report.title,
          timestamp: Date.now(),
          report: res.report,
        };
        persistHistory([toAdd, ...history].slice(0, HISTORY_MAX));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [lastMessages, model, history, persistHistory]
  );

  const handleSubmit = (overridePrompt?: string, skipDatePreset?: boolean) => {
    const q = (overridePrompt !== undefined ? overridePrompt : prompt).trim();
    if (!q) return;
    const effective = !skipDatePreset && datePreset ? applyDatePreset(q, datePreset) : q;
    runReport(effective);
  };

  const handleRefine = () => {
    const t = refinementText.trim();
    if (!t || !lastMessages?.length) return;
    setRefinementText("");
    runReport(t, { isRefinement: true });
  };

  const handleExportPDF = async () => {
    if (!reportRef.current || !report) {
      toast.error("خطا در تولید PDF");
      return;
    }
    let actionButtons: Element | null = null;
    let styleElement: HTMLStyleElement | null = null;
    const elementsToFix: Array<{ element: HTMLElement; originalClasses: string; originalStyle: string }> = [];
    try {
      setIsExportingPdf(true);
      actionButtons = document.querySelector(".no-print");
      if (actionButtons) (actionButtons as HTMLElement).style.display = "none";

      const styleId = "pdf-export-oklch-fix";
      styleElement = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!styleElement) {
        styleElement = document.createElement("style");
        styleElement.id = styleId;
        styleElement.textContent = `
          * { background-image: none !important; }
          [class*="gradient"], [class*="from-"], [class*="to-"] {
            background: #3b82f6 !important; background-color: #3b82f6 !important; background-image: none !important;
          }
        `;
        document.head.appendChild(styleElement);
      }

      if (reportRef.current) {
        reportRef.current.querySelectorAll("*").forEach((el) => {
          const htmlEl = el as HTMLElement;
          const computedStyle = window.getComputedStyle(htmlEl);
          const bg = computedStyle.background || computedStyle.backgroundColor || "";
          if (bg.includes("oklch") || /gradient|from-|to-/.test(htmlEl.className || "")) {
            elementsToFix.push({ element: htmlEl, originalClasses: htmlEl.className, originalStyle: htmlEl.style.cssText });
            htmlEl.style.background = "#f8fafc";
            htmlEl.style.backgroundColor = "#f8fafc";
            htmlEl.style.backgroundImage = "none";
            htmlEl.className = (htmlEl.className || "").split(" ").filter((c) => !/gradient|from-|to-|hover:(from|to)-/.test(c)).join(" ");
          }
        });
      }

      await new Promise((r) => setTimeout(r, 250));

      const PDF_STYLE = `
        * { background-image: none !important; box-sizing: border-box !important; }
        [class*="gradient"], [class*="from-"], [class*="to-"] { background: #e5e7eb !important; background-color: #e5e7eb !important; }
        html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; width: 210mm !important; overflow: visible !important; }
        [data-pdf-root] { width: 210mm !important; max-width: 100% !important; margin: 0 auto !important; padding: 15mm !important; background: #fff !important; }
        [data-pdf-root] h2 { font-size: 18pt !important; margin: 0 0 10px 0 !important; color: #111 !important; }
        [data-pdf-root] h3 { font-size: 14pt !important; margin: 14px 0 8px 0 !important; color: #333 !important; }
        [data-pdf-root] p { font-size: 11pt !important; margin: 0 0 8px 0 !important; color: #444 !important; line-height: 1.5 !important; }
        [data-pdf-root] table { width: 100% !important; border-collapse: collapse !important; font-size: 10pt !important; table-layout: auto !important; }
        [data-pdf-root] th, [data-pdf-root] td { border: 1px solid #ccc !important; padding: 8px 10px !important; text-align: right !important; color: #222 !important; }
        [data-pdf-root] th { background: #f5f5f5 !important; font-weight: 600 !important; }
        [data-pdf-root] [class*="overflow-x-auto"] { overflow: visible !important; }
      `;

      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvas(reportRef.current, {
          scale: 3,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          onclone: (clonedDoc) => {
            clonedDoc.querySelectorAll("style").forEach((s) => {
              if (s.textContent?.includes("oklch")) s.remove();
            });
            const pdfStyle = clonedDoc.createElement("style");
            pdfStyle.textContent = PDF_STYLE;
            const target = clonedDoc.head || clonedDoc.documentElement;
            if (target) target.insertBefore(pdfStyle, target.firstChild);
          },
        });
      } catch (err) {
        console.warn("html2canvas failed, trying simplified clone", err);
        const clone = reportRef.current.cloneNode(true) as HTMLElement;
        clone.style.position = "absolute";
        clone.style.left = "-9999px";
        clone.style.top = "0";
        clone.style.width = "210mm";
        clone.style.background = "#fff";
        clone.querySelectorAll("*").forEach((el) => {
          const htmlEl = el as HTMLElement;
          if (/gradient|from-|to-/.test(htmlEl.className || "")) {
            htmlEl.className = (htmlEl.className || "").split(" ").filter((c) => !/gradient|from-|to-|hover/.test(c)).join(" ");
            htmlEl.style.background = "#e5e7eb";
            htmlEl.style.backgroundColor = "#e5e7eb";
            htmlEl.style.backgroundImage = "none";
          }
        });
        document.body.appendChild(clone);
        const override = document.createElement("style");
        override.id = "pdf-fallback-override";
        override.textContent = PDF_STYLE;
        document.head.appendChild(override);
        try {
          canvas = await html2canvas(clone, { scale: 3, useCORS: true, logging: false, backgroundColor: "#ffffff" });
        } finally {
          document.body.removeChild(clone);
          const o = document.getElementById("pdf-fallback-override");
          if (o) o.remove();
        }
      }

      const imgWidthMm = 210;
      const totalHeightMm = (canvas.height / canvas.width) * imgWidthMm;
      const pageHeightMm = 297;
      const numPages = Math.ceil(totalHeightMm / pageHeightMm);

      const pdf = new jsPDF("p", "mm", "a4");
      for (let i = 0; i < numPages; i++) {
        if (i > 0) pdf.addPage();
        const ySrc = (i * pageHeightMm / totalHeightMm) * canvas.height;
        const hSrc = Math.min((pageHeightMm / totalHeightMm) * canvas.height, canvas.height - ySrc);
        const imgHeightMm = Math.min(pageHeightMm, (hSrc / canvas.width) * imgWidthMm);
        const temp = document.createElement("canvas");
        temp.width = canvas.width;
        temp.height = hSrc;
        const ctx = temp.getContext("2d")!;
        ctx.drawImage(canvas, 0, ySrc, canvas.width, hSrc, 0, 0, canvas.width, hSrc);
        pdf.addImage(temp.toDataURL("image/png"), "PNG", 0, 0, imgWidthMm, imgHeightMm);
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      pdf.save(`گزارش-هوشمند-${sanitizeFilename(report.title)}-${dateStr}.pdf`);
      toast.success("PDF با موفقیت دانلود شد");
    } catch (err) {
      console.error("Error exporting PDF:", err);
      toast.error("خطا در تولید PDF");
    } finally {
      elementsToFix.forEach(({ element, originalClasses, originalStyle }) => {
        element.className = originalClasses;
        element.style.cssText = originalStyle;
      });
      if (styleElement?.parentNode) styleElement.parentNode.removeChild(styleElement);
      if (actionButtons) (actionButtons as HTMLElement).style.display = "";
      setIsExportingPdf(false);
    }
  };

  const handleExportExcel = () => {
    if (!report) return;
    const tableSections = report.sections.filter(
      (s) => s.type === "table" && s.table?.columns?.length && s.table?.rows
    );
    const chartSections = report.sections.filter((s) => s.type === "chart" && s.chart?.series?.length);
    if (tableSections.length === 0 && chartSections.length === 0) {
      toast.error("این گزارش جدول یا نموداری برای خروجی ندارد.");
      return;
    }
    setIsExportingExcel(true);
    try {
      const wb = XLSX.utils.book_new();

      tableSections.forEach((section, i) => {
        const cols = section.table!.columns;
        const rows = section.table!.rows;
        const headerRow = cols.map((c) => c.label);
        const dataRows = rows.map((row) => cols.map((c) => formatCellForExcel(row[c.key])));
        const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
        const base = sanitizeSheetName(section.title);
        XLSX.utils.book_append_sheet(wb, ws, base || `جدول ${i + 1}`);
      });

      chartSections.forEach((section, i) => {
        const c = section.chart!;
        const labels = (c.labels && c.labels.length ? c.labels : c.categories) || [];
        const vals = c.series[0]?.data ?? [];
        const n = Math.min(labels.length, vals.length) || Math.max(labels.length, vals.length);
        const header = ["دسته", ...c.series.map((s) => s.name)];
        const rows: unknown[][] = [header];
        for (let j = 0; j < n; j++) {
          const row: unknown[] = [labels[j] ?? ""];
          c.series.forEach((s) => row.push(s.data[j] ?? ""));
          rows.push(row);
        }
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(section.title) || `نمودار ${i + 1}`);
      });

      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `گزارش-${sanitizeFilename(report.title)}-${dateStr}.xlsx`);
      toast.success("فایل Excel دانلود شد");
    } catch (e) {
      toast.error("خطا در ذخیره Excel.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950" dir="rtl">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <motion.button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 mb-6"
          whileHover={{ x: 4 }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          بازگشت
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl border border-purple-200/50 dark:border-purple-800/30 shadow-xl p-6 mb-8"
        >
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">
            گزارش هوشمند (AI)
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            درخواست گزارش خود را به زبان طبیعی بنویسید یا یکی از پیشنهادها را انتخاب کنید.
          </p>

          {!puterOk && (
            <div className="mb-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
              <p className="mb-3 text-sm font-medium">برای استفاده از گزارش هوشمند، شناسه اپ و توکن احراز هویت Puter را وارد کنید.</p>
              <div className="grid gap-3">
                <label className="block">
                  <span className="text-xs text-blue-700 dark:text-blue-300">شناسه اپ Puter (puter.app.id / appId)</span>
                  <input
                    type="text"
                    value={appId}
                    onChange={(e) => { setAppId(e.target.value); setError(null); }}
                    placeholder="مثال: my-app-id"
                    className="mt-1 w-full px-4 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500"
                    disabled={applying}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-blue-700 dark:text-blue-300">توکن احراز هویت Puter (puter.auth.token / authToken)</span>
                  <input
                    type="password"
                    value={authToken}
                    onChange={(e) => { setAuthToken(e.target.value); setError(null); }}
                    placeholder="توکن خود را وارد کنید"
                    className="mt-1 w-full px-4 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500"
                    disabled={applying}
                  />
                </label>
                <motion.button
                  onClick={handleApply}
                  disabled={applying || !appId.trim() || !authToken.trim()}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {applying ? "در حال اعمال…" : "اعمال"}
                </motion.button>
              </div>
            </div>
          )}

          {puterOk && (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                {QUICK_PROMPTS.map((p) => (
                  <motion.button
                    key={p.label}
                    onClick={() => handleSubmit(p.prompt)}
                    disabled={loading}
                    className="px-3 py-1.5 text-sm rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-800/50 disabled:opacity-50"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {p.label}
                  </motion.button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                <span className="text-sm text-gray-500 dark:text-gray-400 self-center">بازهٔ زمانی:</span>
                {DATE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setDatePreset(datePreset === p.id ? null : p.id)}
                    className={`px-3 py-1 rounded-lg text-sm ${datePreset === p.id ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="mb-3">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">مدل (اختیاری)</label>
                <select
                  value={model}
                  onChange={(e) => {
                    const v = e.target.value;
                    setModel(v);
                    try { localStorage.setItem(LS_PUTER_MODEL, v); } catch (_) {}
                  }}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                >
                  <option value="">پیش‌فرض</option>
                </select>
              </div>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="مثال: درآمد ماهانه ۶ ماه گذشته به تفکیک ماه"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                disabled={loading}
              />
              <motion.button
                onClick={() => handleSubmit()}
                disabled={loading || !prompt.trim()}
                className="mt-4 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? "در حال تولید..." : "تولید گزارش"}
              </motion.button>
            </>
          )}
        </motion.div>

        {history.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700"
          >
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">تاریخچه</h3>
            <ul className="space-y-1.5">
              {history.slice(0, 5).map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-gray-600 dark:text-gray-400 truncate flex-1" title={h.prompt}>{h.title}</span>
                  <span className="text-gray-400 dark:text-gray-500 shrink-0">{new Date(h.timestamp).toLocaleDateString("fa-IR")}</span>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleSubmit(h.prompt, true)}
                      disabled={loading}
                      className="px-2 py-1 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/40 text-xs"
                    >
                      دوباره
                    </button>
                    <button
                      onClick={() => setPrompt(h.prompt)}
                      className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 text-xs"
                    >
                      ویرایش
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full"
            />
            <p className="mt-4 text-gray-600 dark:text-gray-400 mt-2">لطفاً صبر کنید...</p>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800"
          >
            {error}
          </motion.div>
        )}

        {report && !loading && (
          <>
            <div className="no-print flex flex-wrap gap-2 mb-4">
              <motion.button
                onClick={handleExportPDF}
                disabled={isExportingPdf}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isExportingPdf ? "در حال آماده‌سازی…" : "خروجی PDF"}
              </motion.button>
              <motion.button
                onClick={handleExportExcel}
                disabled={isExportingExcel}
                className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isExportingExcel ? "در حال آماده‌سازی…" : "Excel (جداول و نمودارها)"}
              </motion.button>
            </div>

            {lastMessages?.length && (
              <div className="no-print mb-4 p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <label className="block text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">اصلاح گزارش</label>
                <div className="flex gap-2">
                  <input
                    value={refinementText}
                    onChange={(e) => setRefinementText(e.target.value)}
                    placeholder="مثال: فقط ۳ ماه اخیر، یا فقط فروش را نشان بده"
                    className="flex-1 px-4 py-2 rounded-xl border border-purple-200 dark:border-purple-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 text-sm"
                  />
                  <motion.button
                    onClick={handleRefine}
                    disabled={loading || !refinementText.trim()}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium text-sm"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    اعمال
                  </motion.button>
                </div>
              </div>
            )}

            <motion.article
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div ref={reportRef} className="space-y-8" data-pdf-root>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{report.title}</h2>
                  {report.summary && (
                    <p className="mt-2 text-gray-600 dark:text-gray-400">{report.summary}</p>
                  )}
                </div>
                {report.sections.map((sec, i) => (
                  <section key={i}>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">{sec.title}</h3>
                    {sec.type === "table" && <TableSection section={sec} />}
                    {sec.type === "chart" && <ChartSection section={sec} index={i} />}
                  </section>
                ))}
              </div>
            </motion.article>
          </>
        )}
      </div>
    </div>
  );
}
