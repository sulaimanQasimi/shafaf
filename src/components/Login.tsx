import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { loginUser, registerUser, initUsersTable, type LoginResult } from "../utils/auth";
import { openDatabase, isDatabaseOpen } from "../utils/db";

interface LoginProps {
  onLoginSuccess: (user: { id: number; username: string; email: string }) => void;
}

// Dari translations
const translations = {
  login: {
    title: "خوش آمدید",
    subtitle: "به حساب کاربری خود وارد شوید",
    username: "نام کاربری",
    password: "رمز عبور",
    submit: "ورود",
    processing: "در حال پردازش...",
    switchText: "حساب کاربری ندارید؟ ثبت نام کنید",
  },
  signup: {
    title: "ایجاد حساب کاربری",
    subtitle: "برای شروع ثبت نام کنید",
    username: "نام کاربری",
    email: "ایمیل",
    password: "رمز عبور",
    confirmPassword: "تأیید رمز عبور",
    submit: "ثبت نام",
    processing: "در حال پردازش...",
    switchText: "قبلاً حساب کاربری دارید؟ وارد شوید",
  },
  errors: {
    passwordMismatch: "رمزهای عبور مطابقت ندارند",
    passwordTooShort: "رمز عبور باید حداقل ۶ کاراکتر باشد",
    invalidCredentials: "نام کاربری یا رمز عبور نامعتبر است",
    registrationFailed: "ثبت نام با خطا مواجه شد",
    loginFailed: "ورود با خطا مواجه شد",
    generalError: "خطایی رخ داد",
  },
  success: {
    loginSuccess: "با موفقیت وارد شدید",
    registrationSuccess: "حساب کاربری با موفقیت ایجاد شد",
  },
  placeholders: {
    username: "نام کاربری خود را وارد کنید",
    email: "ایمیل خود را وارد کنید",
    password: "رمز عبور خود را وارد کنید",
    confirmPassword: "رمز عبور را تأیید کنید",
  },
};

export default function Login({ onLoginSuccess }: LoginProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Ensure database is open
      const dbOpen = await isDatabaseOpen();
      if (!dbOpen) {
        await openDatabase("db");
      }

      // Initialize users table if needed
      try {
        await initUsersTable();
      } catch (err) {
        console.log("Table initialization:", err);
      }

      if (isLogin) {
        // Login
        const result: LoginResult = await loginUser(username, password);
        if (result.success && result.user) {
          toast.success(translations.success.loginSuccess);
          setTimeout(() => {
            onLoginSuccess(result.user!);
          }, 500);
        } else {
          toast.error(result.message || translations.errors.invalidCredentials);
        }
      } else {
        // Register
        if (password !== confirmPassword) {
          toast.error(translations.errors.passwordMismatch);
          setLoading(false);
          return;
        }

        if (password.length < 6) {
          toast.error(translations.errors.passwordTooShort);
          setLoading(false);
          return;
        }

        const result: LoginResult = await registerUser(username, email, password);
        if (result.success && result.user) {
          toast.success(translations.success.registrationSuccess);
          setTimeout(() => {
            onLoginSuccess(result.user!);
          }, 1000);
        } else {
          toast.error(result.message || translations.errors.registrationFailed);
        }
      }
    } catch (err: any) {
      toast.error(err.toString() || translations.errors.generalError);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMode = () => {
    setIsLogin(!isLogin);
    setPassword("");
    setConfirmPassword("");
  };

  const currentTranslations = isLogin ? translations.login : translations.signup;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20 dark:border-gray-700/50"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={isLogin ? "login" : "signup"}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="text-center mb-8"
            >
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-3"
                dir="rtl"
              >
                {currentTranslations.title}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-gray-600 dark:text-gray-400 text-lg"
                dir="rtl"
              >
                {currentTranslations.subtitle}
              </motion.p>
            </motion.div>
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-5" dir="rtl">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <label
                htmlFor="username"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
              >
                {currentTranslations.username}
              </label>
              <motion.input
                whileFocus={{ scale: 1.02 }}
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200"
                placeholder={translations.placeholders.username}
                dir="rtl"
              />
            </motion.div>

            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <label
                    htmlFor="email"
                    className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
                  >
                    {translations.signup.email}
                  </label>
                  <motion.input
                    whileFocus={{ scale: 1.02 }}
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200"
                    placeholder={translations.placeholders.email}
                    dir="rtl"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
              >
                {currentTranslations.password}
              </label>
              <motion.input
                whileFocus={{ scale: 1.02 }}
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200"
                placeholder={translations.placeholders.password}
                dir="rtl"
              />
            </motion.div>

            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
                  >
                    {translations.signup.confirmPassword}
                  </label>
                  <motion.input
                    whileFocus={{ scale: 1.02 }}
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200"
                    placeholder={translations.placeholders.confirmPassword}
                    dir="rtl"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                  />
                  <span>{currentTranslations.processing}</span>
                </>
              ) : (
                <span>{currentTranslations.submit}</span>
              )}
            </motion.button>
          </form>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 text-center"
          >
            <motion.button
              type="button"
              onClick={handleToggleMode}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium transition-colors duration-200"
              dir="rtl"
            >
              {currentTranslations.switchText}
            </motion.button>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
