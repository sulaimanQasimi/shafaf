import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import ReactApexChart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import { generateReport, type ReportJson, type ReportSection } from "../utils/puterReport";
import { formatPersianNumber } from "../utils/dashboard";

interface AiReportProps {
  onBack: () => void;
}

function formatCellValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") return formatPersianNumber(v);
  return String(v);
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

  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  const baseOptions: ApexOptions = {
    chart: { id: `report-chart-${index}`, type: c.type as "line" | "bar" | "area" | "pie" | "donut", toolbar: { show: true } },
    theme: { mode: isDark ? "dark" : "light" },
    labels: c.labels ?? c.categories ?? [],
  };

  let options: ApexOptions = { ...baseOptions };
  let series: ApexOptions["series"];

  if (c.type === "pie" || c.type === "donut") {
    const vals = c.series[0]?.data ?? [];
    series = vals;
    if (c.type === "donut") {
      options.plotOptions = { pie: { donut: { size: "60%" } } };
    }
  } else {
    series = c.series.map((s) => ({ name: s.name, data: s.data }));
    options.xaxis = { categories: c.categories ?? [] };
  }

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 p-4 shadow-lg">
      <ReactApexChart
        type={c.type as "line" | "bar" | "area" | "pie" | "donut"}
        options={options}
        series={series}
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
  const [puterLoaded, setPuterLoaded] = useState(false);
  const [appId, setAppId] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [applying, setApplying] = useState(false);

  const puter = typeof window !== "undefined" ? (window as Window & { puter?: { ai?: { chat: unknown } } }).puter : undefined;
  const puterOk = puterLoaded && !!puter?.ai?.chat;

  const loadPuterWithCreds = useCallback((id: string, token: string) => {
    if (typeof window === "undefined") return;
    const w = window as Window & { puter?: { ai?: { chat: unknown } } };
    if (w.puter?.ai?.chat) {
      setPuterLoaded(true);
      setApplying(false);
      return;
    }
    const existing = document.querySelector(`script[src^="${PUTER_SCRIPT_BASE}"]`);
    if (existing) existing.remove();
    (window as Window & { __puterAppId?: string; __puterAuthToken?: string }).__puterAppId = id;
    (window as Window & { __puterAppId?: string; __puterAuthToken?: string }).__puterAuthToken = token;
    const params = new URLSearchParams({ appId: id, authToken: token });
    const src = `${PUTER_SCRIPT_BASE}?${params.toString()}`;
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => {
      setApplying(false);
      const pw = window as Window & { puter?: { ai?: { chat: unknown } } };
      setPuterLoaded(!!pw.puter?.ai?.chat);
      if (!pw.puter?.ai?.chat) setError("Puter SDK بارگذاری شد ولی ai.chat در دسترس نیست.");
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

  const handleSubmit = async () => {
    const q = prompt.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const r = await generateReport(q);
      setReport(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
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
            درخواست گزارش خود را به زبان طبیعی بنویسید (مثلاً: درآمد ماهانه ۶ ماه گذشته، تعداد فروش به تفکیک محصول).
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
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="مثال: درآمد ماهانه ۶ ماه گذشته به تفکیک ماه"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                disabled={loading}
              />
              <motion.button
                onClick={handleSubmit}
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
          <motion.article
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
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
          </motion.article>
        )}
      </div>
    </div>
  );
}
