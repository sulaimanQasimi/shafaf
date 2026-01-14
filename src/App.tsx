import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  openDatabase,
  isDatabaseOpen,
} from "./utils/db";
import Login from "./components/Login";
import CurrencyManagement from "./components/Currency";
import SupplierManagement from "./components/Supplier";
import ProductManagement from "./components/Product";
import PurchaseManagement from "./components/Purchase";
import SalesManagement from "./components/Sales";
import UnitManagement from "./components/Unit";
import CustomerManagement from "./components/Customer";
import UserManagement from "./components/UserManagement";
import ProfileEdit from "./components/ProfileEdit";
import "./App.css";

interface User {
  id: number;
  username: string;
  email: string;
}

type Page = "dashboard" | "currency" | "supplier" | "product" | "purchase" | "sales" | "unit" | "customer" | "users" | "profile";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");

  // Initialize database on mount
  useEffect(() => {
    const initDb = async () => {
      try {
        const dbOpen = await isDatabaseOpen();
        if (!dbOpen) {
          // Open existing database (path from .env file or default)
          try {
            await openDatabase("db");
          } catch (err: any) {
            console.error("Database init error:", err);
          }
        }
      } catch (err: any) {
        console.log("Database init:", err);
      }
    };
    initDb();
  }, []);

  // Show login screen if not logged in
  if (!user) {
    return <Login onLoginSuccess={(user) => setUser(user)} />;
  }

  const handleLogout = () => {
    setUser(null);
    setCurrentPage("dashboard");
  };

  // Show currency page if selected
  if (currentPage === "currency") {
    return (
      <CurrencyManagement onBack={() => setCurrentPage("dashboard")} />
    );
  }

  // Show supplier page if selected
  if (currentPage === "supplier") {
    return (
      <SupplierManagement onBack={() => setCurrentPage("dashboard")} />
    );
  }

  // Show unit page if selected
  if (currentPage === "unit") {
    return (
      <UnitManagement onBack={() => setCurrentPage("dashboard")} />
    );
  }

  if (currentPage === "purchase") {
    return (
      <PurchaseManagement onBack={() => setCurrentPage("dashboard")} />
    );
  }

  // Show sales page if selected
  if (currentPage === "sales") {
    return (
      <SalesManagement onBack={() => setCurrentPage("dashboard")} />
    );
  }

  // Show product page if selected
  if (currentPage === "product") {
    return (
      <ProductManagement onBack={() => setCurrentPage("dashboard")} />
    );
  }

  // Show customer page if selected
  if (currentPage === "customer") {
    return (
      <CustomerManagement onBack={() => setCurrentPage("dashboard")} />
    );
  }

  // Show users management page if selected
  if (currentPage === "users") {
    return (
      <UserManagement
        onBack={() => setCurrentPage("dashboard")}
        currentUser={user}
      />
    );
  }

  // Show profile edit page if selected
  if (currentPage === "profile") {
    return (
      <ProfileEdit
        userId={user.id}
        onBack={() => setCurrentPage("dashboard")}
        onProfileUpdate={(updatedUser) => {
          setUser({
            id: updatedUser.id,
            username: updatedUser.username,
            email: updatedUser.email,
          });
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900" dir="rtl">
      {/* Header */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-b border-purple-100 dark:border-purple-900/30 sticky top-0 z-50"
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            {/* Logo & Brand */}
            <div className="flex items-center gap-4">
              <motion.div
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
                className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg"
              >
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  سیستم مدیریت داروخانه
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">شفاف</p>
              </div>
            </div>

            {/* User Profile */}
            <div className="flex items-center gap-4">
              <div className="text-left">
                <p className="font-semibold text-gray-900 dark:text-white">{user.username}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCurrentPage("profile")}
                className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:shadow-xl transition-all duration-200 group relative"
                title="ویرایش پروفایل"
              >
                <span className="text-white font-bold text-lg group-hover:scale-110 transition-transform">
                  {user.username.charAt(0).toUpperCase()}
                </span>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-gray-800">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                خروج
              </motion.button>
            </div>
          </div>
        </div>
      </motion.header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-10"
        >
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            خوش آمدید، {user.username}! 👋
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            به پنل مدیریت داروخانه خوش آمدید. از منوی زیر بخش مورد نظر را انتخاب کنید.
          </p>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10"
        >
          {[
            { label: "اجناس", value: "۱۲۵", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4", color: "from-purple-500 to-indigo-500" },
            { label: "تمویل کنندگان", value: "۴۸", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z", color: "from-green-500 to-emerald-500" },
            { label: "خریداری ها", value: "۳۲۱", icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z", color: "from-blue-500 to-cyan-500" },
            { label: "درآمد ماهانه", value: "۲.۵M", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", color: "from-amber-500 to-orange-500" },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-2xl p-6 border border-purple-100/50 dark:border-purple-900/30 transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                </div>
                <div className={`w-14 h-14 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center shadow-lg`}>
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                  </svg>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Navigation Cards */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
            <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            بخش های سیستم
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "مدیریت اجناس",
                description: "افزودن، ویرایش و مدیریت اجناس و محصولات داروخانه",
                icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
                color: "from-indigo-500 to-violet-500",
                page: "product" as Page,
              },
              {
                title: "مدیریت خریداری",
                description: "ثبت و پیگیری خریداری ها از تمویل کننده ها",
                icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z",
                color: "from-purple-500 to-blue-500",
                page: "purchase" as Page,
              },
              {
                title: "مدیریت فروشات",
                description: "ثبت و مدیریت فروشات، صدور فاکتور و کنترل موجودی",
                icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z",
                color: "from-emerald-500 to-teal-500",
                page: "sales" as Page,
              },
              {
                title: "تمویل کننده ها",
                description: "مدیریت اطلاعات تمویل کننده ها و توزیع کننده ها",
                icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
                color: "from-green-500 to-teal-500",
                page: "supplier" as Page,
              },
              {
                title: "مدیریت ارزها",
                description: "تعریف و مدیریت انواع ارزهای مورد استفاده",
                icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
                color: "from-amber-500 to-orange-500",
                page: "currency" as Page,
              },
              {
                title: "مدیریت واحدها",
                description: "تعریف واحدهای اندازه گیری مختلف",
                icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z",
                color: "from-pink-500 to-rose-500",
                page: "unit" as Page,
              },
              {
                title: "مدیریت مشتری ها",
                description: "افزودن، ویرایش و مدیریت اطلاعات مشتریان",
                icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
                color: "from-indigo-500 to-blue-500",
                page: "customer" as Page,
              },
              {
                title: "مدیریت کاربران",
                description: "ایجاد، ویرایش و مدیریت کاربران سیستم",
                icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m9 5.197v-1a6 6 0 00-9-5.197",
                color: "from-cyan-500 to-blue-500",
                page: "users" as Page,
              },
            ].map((item, index) => (
              <motion.button
                key={item.title}
                onClick={() => setCurrentPage(item.page)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                whileHover={{
                  y: -8,
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.98 }}
                className="group bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-2xl p-6 border border-purple-100/50 dark:border-purple-900/30 transition-all duration-300 text-right"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                  <svg
                    className="w-6 h-6 text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-all duration-300 group-hover:-translate-x-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700 text-center"
        >
          <p className="text-gray-500 dark:text-gray-400">
            سیستم مدیریت داروخانه شفاف © ۲۰۲۶
          </p>
        </motion.footer>
      </main>
    </div>
  );
}

export default App;
