import { useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { invoke } from "@tauri-apps/api/core";

interface DatabaseConfigProps {
  onConfigComplete: () => void;
}

// Persian/Dari translations
const translations = {
  title: "پیکربندی پایگاه داده",
  subtitle: "نوع اتصال پایگاه داده را انتخاب کنید",
  modeLabel: "نوع اتصال",
  offline: "فقط آفلاین (محلی)",
  online: "فقط آنلاین (سرور)",
  both: "هر دو (آفلاین و آنلاین)",
  offlineDesc: "داده‌ها فقط به صورت محلی ذخیره می‌شوند",
  onlineDesc: "داده‌ها فقط در سرور ذخیره می‌شوند",
  bothDesc: "داده‌ها هم محلی و هم در سرور ذخیره می‌شوند و به صورت خودکار همگام‌سازی می‌شوند",
  serverUrl: "آدرس سرور",
  serverUrlPlaceholder: "ws://localhost:8000",
  namespace: "فضای نام",
  namespacePlaceholder: "shafaf",
  database: "پایگاه داده",
  databasePlaceholder: "main",
  username: "نام کاربری",
  usernamePlaceholder: "root",
  password: "رمز عبور",
  passwordPlaceholder: "رمز عبور را وارد کنید",
  configureButton: "پیکربندی",
  processing: "در حال پردازش...",
  errors: {
    serverUrlRequired: "لطفاً آدرس سرور را وارد کنید",
    namespaceRequired: "لطفاً فضای نام را وارد کنید",
    databaseRequired: "لطفاً نام پایگاه داده را وارد کنید",
    usernameRequired: "لطفاً نام کاربری را وارد کنید",
    passwordRequired: "لطفاً رمز عبور را وارد کنید",
    configError: "خطا در پیکربندی پایگاه داده",
  },
  success: {
    configured: "پایگاه داده با موفقیت پیکربندی شد",
  },
};

type ConnectionMode = "offline" | "online" | "both";

export default function DatabaseConfig({ onConfigComplete }: DatabaseConfigProps) {
  const [mode, setMode] = useState<ConnectionMode>("offline");
  const [serverUrl, setServerUrl] = useState("ws://localhost:8000");
  const [namespace, setNamespace] = useState("shafaf");
  const [database, setDatabase] = useState("main");
  const [username, setUsername] = useState("root");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfigure = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate online configuration if needed
    if (mode === "online" || mode === "both") {
      if (!serverUrl.trim()) {
        toast.error(translations.errors.serverUrlRequired);
        return;
      }
      if (!namespace.trim()) {
        toast.error(translations.errors.namespaceRequired);
        return;
      }
      if (!database.trim()) {
        toast.error(translations.errors.databaseRequired);
        return;
      }
      if (!username.trim()) {
        toast.error(translations.errors.usernameRequired);
        return;
      }
      if (!password.trim()) {
        toast.error(translations.errors.passwordRequired);
        return;
      }
    }

    setLoading(true);

    try {
      const config: any = {
        mode,
        offline_path: mode === "offline" || mode === "both" ? null : null,
        online_url: mode === "online" || mode === "both" ? serverUrl.trim() : null,
        namespace: mode === "online" || mode === "both" ? namespace.trim() : null,
        database: mode === "online" || mode === "both" ? database.trim() : null,
        username: mode === "online" || mode === "both" ? username.trim() : null,
        password: mode === "online" || mode === "both" ? password.trim() : null,
      };

      // Store configuration
      await invoke("db_configure", { config });

      // Initialize database connection
      await invoke("db_open_surreal", { config });

      toast.success(translations.success.configured);
      setTimeout(() => {
        onConfigComplete();
      }, 500);
    } catch (error: any) {
      console.error("Error configuring database:", error);
      toast.error(error.toString() || translations.errors.configError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -top-1/4 -right-1/4 w-96 h-96 bg-purple-300/20 dark:bg-purple-600/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, -90, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -bottom-1/4 -left-1/4 w-96 h-96 bg-blue-300/20 dark:bg-blue-600/10 rounded-full blur-3xl"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl relative z-10"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-purple-100/50 dark:border-purple-900/30"
        >
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-8"
          >
            <h2
              className="text-3xl font-bold text-gray-900 dark:text-white mb-2"
              dir="rtl"
            >
              {translations.title}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-base" dir="rtl">
              {translations.subtitle}
            </p>
          </motion.div>

          <form onSubmit={handleConfigure} className="space-y-6" dir="rtl">
            {/* Mode Selection */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                {translations.modeLabel}
              </label>
              <div className="space-y-3">
                {/* Offline Option */}
                <label className="flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  style={{ borderColor: mode === "offline" ? "rgb(147, 51, 234)" : "rgb(229, 231, 235)" }}>
                  <input
                    type="radio"
                    name="mode"
                    value="offline"
                    checked={mode === "offline"}
                    onChange={(e) => setMode(e.target.value as ConnectionMode)}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 dark:text-white">{translations.offline}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{translations.offlineDesc}</div>
                  </div>
                </label>

                {/* Online Option */}
                <label className="flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  style={{ borderColor: mode === "online" ? "rgb(147, 51, 234)" : "rgb(229, 231, 235)" }}>
                  <input
                    type="radio"
                    name="mode"
                    value="online"
                    checked={mode === "online"}
                    onChange={(e) => setMode(e.target.value as ConnectionMode)}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 dark:text-white">{translations.online}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{translations.onlineDesc}</div>
                  </div>
                </label>

                {/* Both Option */}
                <label className="flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  style={{ borderColor: mode === "both" ? "rgb(147, 51, 234)" : "rgb(229, 231, 235)" }}>
                  <input
                    type="radio"
                    name="mode"
                    value="both"
                    checked={mode === "both"}
                    onChange={(e) => setMode(e.target.value as ConnectionMode)}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 dark:text-white">{translations.both}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{translations.bothDesc}</div>
                  </div>
                </label>
              </div>
            </motion.div>

            {/* Online Configuration Fields */}
            {(mode === "online" || mode === "both") && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800"
              >
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">تنظیمات اتصال آنلاین</h3>

                {/* Server URL */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {translations.serverUrl}
                  </label>
                  <input
                    type="text"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    required={mode === "online" || mode === "both"}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900/30 transition-all duration-200"
                    placeholder={translations.serverUrlPlaceholder}
                    dir="ltr"
                  />
                </div>

                {/* Namespace */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {translations.namespace}
                  </label>
                  <input
                    type="text"
                    value={namespace}
                    onChange={(e) => setNamespace(e.target.value)}
                    required={mode === "online" || mode === "both"}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900/30 transition-all duration-200"
                    placeholder={translations.namespacePlaceholder}
                    dir="ltr"
                  />
                </div>

                {/* Database */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {translations.database}
                  </label>
                  <input
                    type="text"
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                    required={mode === "online" || mode === "both"}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900/30 transition-all duration-200"
                    placeholder={translations.databasePlaceholder}
                    dir="ltr"
                  />
                </div>

                {/* Username */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {translations.username}
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required={mode === "online" || mode === "both"}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900/30 transition-all duration-200"
                    placeholder={translations.usernamePlaceholder}
                    dir="ltr"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {translations.password}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={mode === "online" || mode === "both"}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900/30 transition-all duration-200"
                    placeholder={translations.passwordPlaceholder}
                    dir="ltr"
                  />
                </div>
              </motion.div>
            )}

            {/* Configure Button */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                  />
                  <span>{translations.processing}</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{translations.configureButton}</span>
                </>
              )}
            </motion.button>
          </form>
        </motion.div>
      </motion.div>
    </div>
  );
}
