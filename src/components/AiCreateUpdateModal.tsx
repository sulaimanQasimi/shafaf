import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { loadPuter, isPuterAvailable, LS_PUTER_APP_ID, LS_PUTER_TOKEN, LS_PUTER_MODEL } from "../utils/puter";
import { generateCreateUpdateIntent, executeIntent } from "../utils/puterCreateUpdate";
import { getCurrencies } from "../utils/currency";
import { getSuppliers } from "../utils/supplier";

interface AiCreateUpdateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const QUICK_PROMPTS: string[] = [
  "ارز جدید اضافه کن",
  "یک مشتری ثبت کن",
  "واحد کیلوگرم اضافه کن",
  "نوع مصارف جدید",
  "create currency USD with rate 1",
  "یک تمویل‌کننده اضافه کن",
];

export default function AiCreateUpdateModal({ open, onClose, onSuccess }: AiCreateUpdateModalProps) {
  const [appId, setAppId] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [model, setModel] = useState("");
  const [puterLoaded, setPuterLoaded] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const savedId = localStorage.getItem(LS_PUTER_APP_ID);
      const savedToken = localStorage.getItem(LS_PUTER_TOKEN);
      const savedModel = localStorage.getItem(LS_PUTER_MODEL);
      if (savedId) setAppId(savedId);
      if (savedToken) setAuthToken(savedToken);
      if (savedModel) setModel(savedModel);
      if (isPuterAvailable()) setPuterLoaded(true);
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!open) return;
    if (isPuterAvailable()) {
      setPuterLoaded(true);
      return;
    }
    const id = appId.trim();
    const token = authToken.trim();
    if (id && token) {
      loadPuter(id, token).then((ok) => setPuterLoaded(ok));
    }
  }, [open, appId, authToken]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleApply = async () => {
    const id = appId.trim();
    const token = authToken.trim();
    if (!id || !token) {
      setError("هر دو فیلد «شناسه اپ Puter» و «توکن احراز هویت Puter» را وارد کنید.");
      return;
    }
    setError(null);
    setApplying(true);
    setPuterLoaded(false);
    const ok = await loadPuter(id, token);
    setApplying(false);
    if (ok) {
      setPuterLoaded(true);
      try {
        localStorage.setItem(LS_PUTER_APP_ID, id);
        localStorage.setItem(LS_PUTER_TOKEN, token);
      } catch (_) {}
    } else {
      setError("بارگذاری Puter ناموفق بود یا ai.chat در دسترس نیست. اتصال شبکه و مقدارهای وارد شده را بررسی کنید.");
    }
  };

  const handleSend = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || loading) return;
    setMessages((m) => [...m, { role: "user", content: prompt }]);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      let lookups: { currencies?: { id: number; name: string }[]; suppliers?: { id: number; full_name: string }[] } | undefined;
      try {
        const [currencies, suppliersResp] = await Promise.all([getCurrencies(), getSuppliers(1, 500, "")]);
        lookups = {
          currencies: currencies.map((c) => ({ id: c.id, name: c.name })),
          suppliers: suppliersResp.items.map((s) => ({ id: s.id, full_name: s.full_name })),
        };
      } catch (_) {
        lookups = undefined;
      }
      const intent = await generateCreateUpdateIntent(prompt, { model: model || undefined, lookups });
      const result = await executeIntent(intent);
      setMessages((m) => [...m, { role: "assistant", content: result.message }]);
      if (result.success && onSuccess) onSuccess();
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: "خطا: " + (e as Error).message }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-purple-200/50 dark:border-purple-800/30 bg-white dark:bg-gray-800 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h2 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            ایجاد و بروزرسانی با هوش مصنوعی
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="بستن"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!puterLoaded && (
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
              <p className="mb-3 text-sm font-medium">برای استفاده، شناسه اپ و توکن احراز هویت Puter را وارد کنید (مثل گزارش هوشمند).</p>
              <div className="grid gap-3">
                <label className="block">
                  <span className="text-xs text-blue-700 dark:text-blue-300">شناسه اپ Puter</span>
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
                  <span className="text-xs text-blue-700 dark:text-blue-300">توکن احراز هویت Puter</span>
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

          {puterLoaded && (
            <>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((p) => (
                  <motion.button
                    key={p}
                    onClick={() => handleSend(p)}
                    disabled={loading}
                    className="px-3 py-1.5 text-sm rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-800/50 disabled:opacity-50"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {p}
                  </motion.button>
                ))}
              </div>

              <div className="space-y-3 min-h-[120px]">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm ${
                        msg.role === "user"
                          ? "bg-purple-100 dark:bg-purple-900/40 text-gray-900 dark:text-gray-100"
                          : "bg-blue-100 dark:bg-blue-900/40 text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-end">
                    <div className="px-4 py-2 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-gray-500 dark:text-gray-400 text-sm">
                      در حال پردازش…
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(input); } }}
                  placeholder="مثال: ارز USD با نرخ ۱ ایجاد کن، یا یک مشتری با نام احمد و تلفن ۰۷۰۰..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={loading}
                />
                <motion.button
                  onClick={() => handleSend(input)}
                  disabled={loading || !input.trim()}
                  className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-xl disabled:opacity-50"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  ارسال
                </motion.button>
              </div>
            </>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800 text-sm">
              {error}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
