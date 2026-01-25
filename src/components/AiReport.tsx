import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import ReactApexChart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
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

export default function AiReport({ onBack }: AiReportProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportJson | null>(null);
  const [puterLoaded, setPuterLoaded] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // Load Puter script on mount so it is ready when user clicks. signIn() must run in the same user gesture as the click;
  // if we loaded the script on click and called signIn in onload, the gesture would be lost and the popup would be blocked.
  useEffect(() => {
    if (typeof window === "undefined") return;

    // In Tauri, window.open often returns null (popup blocked). Puter's signIn() then does popup.closed
    // and throws. Polyfill: when open returns null for Puter URLs, create a WebviewWindow with that URL
    // so the Puter login can open. Requires webview:allow-create-webview-window. Fallback: dummy so SDK doesn't crash.
    const isTauri = !!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    const win = window as Window & { __puterOpenPatched?: boolean };
    if (!win.__puterOpenPatched) {
      win.__puterOpenPatched = true;
      const orig = window.open;
      window.open = function (
        url?: string | URL,
        _target?: string,
        _features?: string
      ): Window | null {
        const w = orig.call(window, url as string, _target, _features);
        if (w != null) return w;
        const u = (url != null ? String(url) : "").trim();
        if (!u || !/puter\.com|api\.puter\.com/i.test(u)) return null;
        if (isTauri) {
          try {
            const label = "puter-auth-" + Date.now();
            const authUrl = "https://puter.com/?embedded_in_popup=true&request_auth=true";
            const wv = new WebviewWindow(label, { url: authUrl, width: 500, height: 600 });
            let closed = false;
            // Do not use wv.once("tauri://close-requested") — it triggers plugin:event|listen and CORS in dev.
            return {
              get closed() { return closed; },
              close() { try { wv.close(); } catch { /* ignore */ } closed = true; },
            } as unknown as Window;
          } catch {
            /* fall through to dummy */
          }
        }
        return { get closed() { return true; }, close() {} } as unknown as Window;
      };
    }

    const w = window as Window & { puter?: { auth?: { isSignedIn?: () => boolean }; ai?: { chat: unknown } } };
    if (w.puter) {
      setPuterLoaded(true);
      setSignedIn(!!w.puter?.auth?.isSignedIn?.());
      return;
    }
    const src = "https://js.puter.com/v2/";
    if (document.querySelector(`script[src="${src}"]`)) return;
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => {
      const pw = window as Window & { puter?: { auth?: { isSignedIn?: () => boolean } } };
      setPuterLoaded(true);
      setSignedIn(!!pw.puter?.auth?.isSignedIn?.());
    };
    s.onerror = () => setError("بارگذاری Puter ناموفق بود. اتصال شبکه را بررسی کنید.");
    document.body.appendChild(s);
  }, []);

  const puter = typeof window !== "undefined" ? (window as Window & { puter?: { ai?: { chat: unknown }; auth?: { isSignedIn?: () => boolean; signIn?: (o?: unknown) => Promise<unknown> } } }).puter : undefined;
  const puterOk = puterLoaded && !!puter?.ai?.chat;

  // Poll isSignedIn while sign-in block is shown (catches auth done in iframe or popup).
  useEffect(() => {
    if (!puterOk || signedIn) return;
    const id = setInterval(() => {
      if ((window as Window & { puter?: { auth?: { isSignedIn?: () => boolean } } }).puter?.auth?.isSignedIn?.()) {
        setSignedIn(true);
      }
    }, 2500);
    return () => clearInterval(id);
  }, [puterOk, signedIn]);

  // Listen for postMessage from puter.com (embedded auth may signal success).
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== "https://puter.com") return;
      if ((window as Window & { puter?: { auth?: { isSignedIn?: () => boolean } } }).puter?.auth?.isSignedIn?.()) {
        setSignedIn(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const refreshSignedIn = () => {
    setSignedIn(!!(window as Window & { puter?: { auth?: { isSignedIn?: () => boolean } } }).puter?.auth?.isSignedIn?.());
  };

  // Call signIn() synchronously in the click handler (no await before it) so the popup is allowed. Puter requires a user gesture.
  const handleSignIn = () => {
    const p = (window as Window & { puter?: { auth?: { signIn: (o?: unknown) => Promise<unknown> } } }).puter;
    if (!p?.auth?.signIn) {
      setError("ورود با Puter در این نسخه پشتیبانی نمی‌شود.");
      return;
    }
    setError(null);
    setSigningIn(true);
    p.auth.signIn({ attempt_temp_user_creation: true })
      .then(() => setSignedIn(true))
      .catch(() => {
        setError("ورود لغو شد یا خطا در احراز هویت.");
        setSignedIn(false);
      })
      .finally(() => setSigningIn(false));
  };

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
      const msg = (e as Error).message;
      setError(msg);
      if (/وارد شوید|401|unauthorized|auth|sign.?in/i.test(msg) || !puter?.auth?.isSignedIn?.()) {
        setSignedIn(false);
      }
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

          {!puterLoaded && (
            <div className="mb-4 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm flex items-center gap-2">
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="inline-block w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full" />
              در حال بارگذاری Puter…
            </div>
          )}

          {puterLoaded && !puterOk && (
            <div className="mb-4 p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-sm">
              Puter SDK بارگذاری نشده. اتصال شبکه را بررسی کنید.
            </div>
          )}

          {puterOk && !signedIn && (
            <div className="mb-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
              <p className="mb-3 text-sm font-medium">برای ارسال درخواست و تولید گزارش، باید در puter.com وارد شوید.</p>
              <div className="mb-3 rounded-lg overflow-hidden border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900" style={{ minHeight: 360 }}>
                <iframe
                  src="https://puter.com/?embedded_in_popup=true&request_auth=true"
                  title="ورود Puter"
                  className="w-full border-0"
                  style={{ height: 360 }}
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              </div>
              <p className="mb-2 text-xs text-blue-700 dark:text-blue-300">
                پس از ورود در کادر بالا، روی «بروزرسانی وضعیت ورود» بزنید. یا از روش پنجره: «ورود با Puter» → Continue → ورود در puter.com.
              </p>
              <p className="mb-3 text-xs text-blue-600 dark:text-blue-400">
                خطای ۴۰۱ از api.puter.com قبل از ورود طبیعی است.
              </p>
              <div className="flex flex-wrap gap-2">
                <motion.button
                  onClick={refreshSignedIn}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-xl"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  بروزرسانی وضعیت ورود
                </motion.button>
                <motion.button
                  onClick={handleSignIn}
                  disabled={signingIn}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {signingIn ? "در حال ورود…" : "ورود با Puter (پنجره)"}
                </motion.button>
              </div>
            </div>
          )}

          {puterOk && signedIn && (
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
