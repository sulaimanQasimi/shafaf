import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  openDatabase,
  isDatabaseOpen,
  backupDatabase,
} from "./utils/db";
import { save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import toast from "react-hot-toast";
import { getDashboardStats, formatPersianNumber, formatLargeNumber } from "./utils/dashboard";
import { playClickSound } from "./utils/sound";
import { getCompanySettings, initCompanySettingsTable, type CompanySettings as CompanySettingsType } from "./utils/company";
import { applyFont } from "./utils/fonts";
import { isLicenseValid } from "./utils/license";
import Login from "./components/Login";
import License from "./components/License";
import CurrencyManagement from "./components/Currency";
import SupplierManagement from "./components/Supplier";
import ProductManagement from "./components/Product";
import PurchaseManagement from "./components/Purchase";
import SalesManagement from "./components/Sales";
import UnitManagement from "./components/Unit";
import CustomerManagement from "./components/Customer";
import ExpenseManagement from "./components/Expense";
import EmployeeManagement from "./components/Employee";
import SalaryManagement from "./components/Salary";
import DeductionManagement from "./components/Deduction";
import UserManagement from "./components/UserManagement";
import ProfileEdit from "./components/ProfileEdit";
import CompanySettings from "./components/CompanySettings";
import SaleInvoice from "./components/SaleInvoice";
import AccountManagement from "./components/Account";
import PurchasePaymentManagement from "./components/PurchasePayment";
import SalesPaymentManagement from "./components/SalesPayment";
import Footer from "./components/Footer";
import "./App.css";
import { SaleWithItems, SalePayment } from "./utils/sales";
import { Customer } from "./utils/customer";
import { Product } from "./utils/product";
import { Unit } from "./utils/unit";

interface User {
  id: number;
  username: string;
  email: string;
}

type Page = "dashboard" | "currency" | "supplier" | "product" | "purchase" | "sales" | "unit" | "customer" | "expense" | "employee" | "salary" | "deduction" | "users" | "profile" | "invoice" | "company" | "account" | "purchasePayment" | "salesPayment";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [licenseValid, setLicenseValid] = useState<boolean | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [dashboardStats, setDashboardStats] = useState({
    productsCount: 0,
    suppliersCount: 0,
    purchasesCount: 0,
    monthlyIncome: 0,
    deductionsCount: 0,
    totalDeductions: 0,
  });
  const [loadingStats, setLoadingStats] = useState(false);
  const [companySettings, setCompanySettings] = useState<CompanySettingsType | null>(null);
  const [invoiceData, setInvoiceData] = useState<{
    saleData: SaleWithItems;
    customer: Customer;
    products: Product[];
    units: Unit[];
    payments: SalePayment[];
  } | null>(null);

  // Check license validity on mount
  useEffect(() => {
    const checkLicense = async () => {
      try {
        const valid = await isLicenseValid();
        setLicenseValid(valid);
      } catch (error) {
        console.error("Error checking license:", error);
        setLicenseValid(false);
      }
    };
    checkLicense();
  }, []);

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

  // Add global click sound handler
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Only play sound for interactive elements (buttons, links, etc.)
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.closest('button') ||
        target.closest('a') ||
        target.getAttribute('role') === 'button' ||
        target.onclick !== null
      ) {
        playClickSound();
      }
    };

    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, []);

  // Load company settings and apply font
  useEffect(() => {
    const loadCompanySettings = async () => {
      try {
        await initCompanySettingsTable();
        const settings = await getCompanySettings();
        setCompanySettings(settings);
        
        // Apply font from settings
        if (settings.font) {
          await applyFont(settings.font);
        } else {
          await applyFont(null); // Use system default
        }
      } catch (error) {
        console.error("Error loading company settings:", error);
      }
    };
    if (user) {
      loadCompanySettings();
    }
  }, [user]);

  // Load dashboard stats when on dashboard page
  useEffect(() => {
    const loadStats = async () => {
      if (currentPage === "dashboard" && user) {
        try {
          setLoadingStats(true);
          const stats = await getDashboardStats();
          setDashboardStats(stats);
        } catch (error) {
          console.error("Error loading dashboard stats:", error);
        } finally {
          setLoadingStats(false);
        }
      }
    };
    loadStats();
  }, [currentPage, user]);

  // Show license screen if license is not valid
  if (licenseValid === null) {
    // Still checking license, show loading or nothing
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!licenseValid) {
    return <License onLicenseValid={() => setLicenseValid(true)} />;
  }

  // Show login screen if not logged in
  if (!user) {
    return <Login onLoginSuccess={(user) => setUser(user)} />;
  }

  const handleLogout = () => {
    setUser(null);
    setCurrentPage("dashboard");
  };

  const handleBackupDatabase = async () => {
    try {
      // Get database path
      const dbPath = await backupDatabase();
      
      // Open save dialog
      const filePath = await save({
        defaultPath: `db-backup-${new Date().toISOString().split('T')[0]}.sqlite`,
        filters: [{
          name: 'SQLite Database',
          extensions: ['sqlite', 'db']
        }]
      });

      if (filePath) {
        // Read the database file
        const fileData = await readFile(dbPath);
        
        // Write to selected location
        await writeFile(filePath, fileData);
        
        toast.success("پشتیبان‌گیری با موفقیت انجام شد");
      }
    } catch (error: any) {
      console.error("Error backing up database:", error);
      if (error.message && !error.message.includes("cancelled")) {
        toast.error("خطا در پشتیبان‌گیری از پایگاه داده");
      }
    }
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
      <SalesManagement 
        onBack={() => setCurrentPage("dashboard")}
        onOpenInvoice={(data) => {
          setInvoiceData(data);
          setCurrentPage("invoice");
        }}
      />
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

  // Show expense page if selected
  if (currentPage === "expense") {
    return (
      <ExpenseManagement onBack={() => setCurrentPage("dashboard")} />
    );
  }

  // Show employee page if selected
  if (currentPage === "employee") {
    return (
      <EmployeeManagement 
        onBack={() => setCurrentPage("dashboard")}
        onNavigateToSalary={() => setCurrentPage("salary")}
      />
    );
  }

  // Show salary page if selected
  if (currentPage === "salary") {
    return (
      <SalaryManagement 
        onBack={() => setCurrentPage("dashboard")}
        onNavigateToDeduction={() => setCurrentPage("deduction")}
      />
    );
  }

  // Show deduction page if selected
  if (currentPage === "deduction") {
    return (
      <DeductionManagement onBack={() => setCurrentPage("dashboard")} />
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

  // Show invoice page if selected
  if (currentPage === "invoice" && invoiceData) {
    return (
      <SaleInvoice
        saleData={invoiceData.saleData}
        customer={invoiceData.customer}
        products={invoiceData.products}
        units={invoiceData.units}
        payments={invoiceData.payments}
        companySettings={companySettings}
        onClose={() => setCurrentPage("sales")}
      />
    );
  }

  // Show company settings page if selected
  if (currentPage === "company") {
    return (
      <CompanySettings onBack={() => setCurrentPage("dashboard")} />
    );
  }

  // Show account page if selected
  if (currentPage === "account") {
    return (
      <AccountManagement onBack={() => setCurrentPage("dashboard")} />
    );
  }

  // Show purchase payment page if selected
  if (currentPage === "purchasePayment") {
    return (
      <PurchasePaymentManagement onBack={() => setCurrentPage("dashboard")} />
    );
  }

  // Show sales payment page if selected
  if (currentPage === "salesPayment") {
    return (
      <SalesPaymentManagement onBack={() => setCurrentPage("dashboard")} />
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
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ duration: 0.3 }}
                className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg overflow-hidden bg-white"
              >
                <img 
                  src="/logo.jpeg" 
                  alt="شفاف Logo" 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  شفاف
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{companySettings?.name || "سیستم مدیریت مالی"}</p>
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
                onClick={handleBackupDatabase}
                className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:shadow-xl transition-all duration-200 group relative"
                title="پشتیبان‌گیری از پایگاه داده"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4 4m4-4V12" />
                </svg>
              </motion.button>
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
            به پنل مدیریت مالی شفاف خوش آمدید. از منوی زیر بخش مورد نظر را انتخاب کنید.
          </p>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-10"
        >
          {[
            { 
              label: "اجناس", 
              value: loadingStats ? "..." : formatPersianNumber(dashboardStats.productsCount), 
              icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4", 
              color: "from-purple-500 to-indigo-500" 
            },
            { 
              label: "تمویل کنندگان", 
              value: loadingStats ? "..." : formatPersianNumber(dashboardStats.suppliersCount), 
              icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z", 
              color: "from-green-500 to-emerald-500" 
            },
            { 
              label: "خریداری ها", 
              value: loadingStats ? "..." : formatPersianNumber(dashboardStats.purchasesCount), 
              icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z", 
              color: "from-blue-500 to-cyan-500" 
            },
            { 
              label: "درآمد ماهانه", 
              value: loadingStats ? "..." : formatLargeNumber(dashboardStats.monthlyIncome), 
              icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", 
              color: "from-amber-500 to-orange-500" 
            },
            { 
              label: "کسرها", 
              value: loadingStats ? "..." : formatPersianNumber(dashboardStats.deductionsCount), 
              icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", 
              color: "from-red-500 to-pink-500" 
            },
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                title: "مدیریت مصارف",
                description: "ثبت و مدیریت مصارف و هزینه‌های داروخانه",
                icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
                color: "from-red-500 to-pink-500",
                page: "expense" as Page,
              },
              {
                title: "مدیریت کارمندان",
                description: "افزودن، ویرایش و مدیریت اطلاعات کارمندان",
                icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
                color: "from-violet-500 to-purple-500",
                page: "employee" as Page,
              },
              {
                title: "مدیریت کاربران",
                description: "ایجاد، ویرایش و مدیریت کاربران سیستم",
                icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m9 5.197v-1a6 6 0 00-9-5.197",
                color: "from-cyan-500 to-blue-500",
                page: "users" as Page,
              },
              {
                title: "تنظیمات شرکت",
                description: "ویرایش اطلاعات و تنظیمات شرکت",
                icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
                color: "from-emerald-500 to-teal-500",
                page: "company" as Page,
              },
              {
                title: "مدیریت حساب‌ها",
                description: "مدیریت حساب‌ها، واریز و برداشت با نرخ ارز",
                icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
                color: "from-yellow-500 to-amber-500",
                page: "account" as Page,
              },
              {
                title: "بیلانس تمویل کننده ها",
                description: "بیلانس تمویل کننده ها با نرخ ارز",
                icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
                color: "from-teal-500 to-cyan-500",
                page: "purchasePayment" as Page,
              },
              {
                title: "بیلانس مشتریان",
                description: "بیلانس مشتری ها و بیلانس مشتریان",
                icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
                color: "from-blue-500 to-indigo-500",
                page: "salesPayment" as Page,
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
                className="group bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-xl shadow-lg hover:shadow-2xl p-4 border border-purple-100/50 dark:border-purple-900/30 transition-all duration-300 text-right"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 bg-gradient-to-br ${item.color} rounded-lg flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      {item.title}
                    </h4>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-all duration-300 group-hover:-translate-x-2"
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
        <Footer className="mt-16" />
      </main>
    </div>
  );
}

export default App;
