import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  initPurchasesTable,
  createPurchase,
  getPurchases,
  getPurchase,
  updatePurchase,
  deletePurchase,
  type Purchase,
  type PurchaseItemInput,
  type PurchaseWithItems,
} from "../utils/purchase";
import { getSuppliers, type Supplier } from "../utils/supplier";
import { getProducts, type Product } from "../utils/product";
import { getUnits, type Unit } from "../utils/unit";
import { getCurrencies, type Currency } from "../utils/currency";
import {
  initPurchasePaymentsTable,
  createPurchasePayment,
  getPurchasePaymentsByPurchase,
  deletePurchasePayment,
  type PurchasePayment,
} from "../utils/purchase_payment";
import { isDatabaseOpen, openDatabase } from "../utils/db";
import { getCompanySettings, initCompanySettingsTable, type CompanySettings } from "../utils/company";
import Footer from "./Footer";
import PurchaseInvoice from "./PurchaseInvoice";
import PersianDatePicker from "./PersianDatePicker";
import { formatPersianDate, getCurrentPersianDate, persianToGeorgian } from "../utils/date";
import Table from "./common/Table";
import PageHeader from "./common/PageHeader";
import { Search } from "lucide-react";

// Dari translations
const translations = {
  title: "خریداری",
  addNew: "افزودن خریداری جدید",
  edit: "ویرایش",
  delete: "حذف",
  cancel: "لغو",
  save: "ذخیره",
  supplier: "تمویل کننده",
  date: "تاریخ",
  notes: "یادداشت",
  items: "آیتم‌ها",
  addItem: "افزودن آیتم",
  removeItem: "حذف",
  product: "محصول",
  unit: "واحد",
  perPrice: "قیمت واحد",
  amount: "مقدار",
  total: "جمع کل",
  totalAmount: "مبلغ کل",
  paidAmount: "پرداخت شده",
  remainingAmount: "باقیمانده",
  payments: "پرداخت‌ها",
  addPayment: "افزودن پرداخت",
  paymentAmount: "مبلغ پرداخت",
  paymentCurrency: "ارز",
  paymentRate: "نرخ",
  paymentTotal: "مجموع",
  paymentDate: "تاریخ پرداخت",
  paymentNotes: "یادداشت",
  noPayments: "هیچ پرداختی ثبت نشده است",
  noPurchases: "هیچ خریداری ثبت نشده است",
  confirmDelete: "آیا از حذف این خریداری اطمینان دارید؟",
  backToDashboard: "بازگشت به داشبورد",
  success: {
    created: "خریداری با موفقیت ایجاد شد",
    updated: "خریداری با موفقیت بروزرسانی شد",
    deleted: "خریداری با موفقیت حذف شد",
  },
  errors: {
    create: "خطا در ایجاد خریداری",
    update: "خطا در بروزرسانی خریداری",
    delete: "خطا در حذف خریداری",
    fetch: "خطا در دریافت خریداری‌ها",
    supplierRequired: "تمویل کننده الزامی است",
    dateRequired: "تاریخ الزامی است",
    itemsRequired: "حداقل یک آیتم الزامی است",
  },
  placeholders: {
    date: "تاریخ را انتخاب کنید",
    notes: "یادداشت‌ها را وارد کنید (اختیاری)",
    selectProduct: "محصول را انتخاب کنید",
    selectUnit: "واحد را انتخاب کنید",
    amount: "مقدار را وارد کنید",
    rate: "نرخ را وارد کنید",
  },
};

interface PurchaseManagementProps {
  onBack?: () => void;
}

export default function PurchaseManagement({ onBack }: PurchaseManagementProps) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [purchasePayments, setPurchasePayments] = useState<Record<number, PurchasePayment[]>>({});
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<PurchaseWithItems | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [formData, setFormData] = useState({
    supplier_id: 0,
    date: persianToGeorgian(getCurrentPersianDate()) || new Date().toISOString().split('T')[0],
    notes: "",
    items: [] as PurchaseItemInput[],
  });
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [paymentFormData, setPaymentFormData] = useState({
    amount: "",
    currency: "",
    rate: "1",
    total: "",
    date: persianToGeorgian(getCurrentPersianDate()) || new Date().toISOString().split('T')[0],
    notes: "",
  });

  // Pagination & Search
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    loadData();
    loadCompanySettings();
  }, [page, perPage, search, sortBy, sortOrder]);

  const loadCompanySettings = async () => {
    try {
      await initCompanySettingsTable();
      const settings = await getCompanySettings();
      setCompanySettings(settings);
    } catch (error) {
      console.error("Error loading company settings:", error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const dbOpen = await isDatabaseOpen();
      if (!dbOpen) {
        await openDatabase("db");
      }

      try {
        await initPurchasesTable();
        await initPurchasePaymentsTable();
      } catch (err) {
        console.log("Table initialization:", err);
      }

      const [purchasesResponse, suppliersResponse, productsResponse, unitsData, currenciesData] = await Promise.all([
        getPurchases(page, perPage, search, sortBy, sortOrder),
        getSuppliers(1, 1000), // Get all suppliers (large page size)
        getProducts(1, 1000), // Get all products (large page size)
        getUnits(),
        getCurrencies(),
      ]);

      setPurchases(purchasesResponse.items);
      setTotalItems(purchasesResponse.total);
      setSuppliers(suppliersResponse.items);
      setProducts(productsResponse.items);
      setUnits(unitsData);
      setCurrencies(currenciesData);

      // Load payments for all purchases
      const paymentsMap: Record<number, PurchasePayment[]> = {};
      await Promise.all(
        purchasesResponse.items.map(async (purchase) => {
          try {
            const payments = await getPurchasePaymentsByPurchase(purchase.id);
            paymentsMap[purchase.id] = payments;
          } catch (error) {
            paymentsMap[purchase.id] = [];
          }
        })
      );
      setPurchasePayments(paymentsMap);
    } catch (error: any) {
      toast.error(translations.errors.fetch);
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadPurchaseDetails = async (id: number) => {
    try {
      const purchaseData = await getPurchase(id);
      setEditingPurchase(purchaseData.purchase);
      setFormData({
        supplier_id: purchaseData.purchase.supplier_id,
        date: purchaseData.purchase.date,
        notes: purchaseData.purchase.notes || "",
        items: purchaseData.items.map(item => ({
          product_id: item.product_id,
          unit_id: item.unit_id,
          per_price: item.per_price,
          amount: item.amount,
        })),
      });
    } catch (error: any) {
      toast.error("خطا در دریافت جزئیات خریداری");
      console.error("Error loading purchase details:", error);
    }
  };

  const handleOpenModal = async (purchase?: Purchase) => {
    if (purchase) {
      await loadPurchaseDetails(purchase.id);
    } else {
      setEditingPurchase(null);
      setFormData({
        supplier_id: 0,
        date: new Date().toISOString().split('T')[0],
        notes: "",
        items: [],
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPurchase(null);
    setFormData({
      supplier_id: 0,
      date: new Date().toISOString().split('T')[0],
      notes: "",
      items: [],
    });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { product_id: 0, unit_id: 0, per_price: 0, amount: 0 },
      ],
    });
  };

  const handleViewPurchase = async (purchase: Purchase) => {
    try {
      const purchaseData = await getPurchase(purchase.id);
      setViewingPurchase(purchaseData);
      setIsViewModalOpen(true);
      // Load payments for this purchase
      try {
        const payments = await getPurchasePaymentsByPurchase(purchase.id);
        setPurchasePayments(prev => ({
          ...prev,
          [purchase.id]: payments,
        }));
      } catch (error) {
        console.error("Error loading payments:", error);
      }
    } catch (error: any) {
      toast.error("خطا در دریافت جزئیات خریداری");
      console.error("Error loading purchase details:", error);
    }
  };

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const updateItem = (index: number, field: keyof PurchaseItemInput, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const calculateItemTotal = (item: PurchaseItemInput) => {
    return item.per_price * item.amount;
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.supplier_id) {
      toast.error(translations.errors.supplierRequired);
      return;
    }

    if (!formData.date) {
      toast.error(translations.errors.dateRequired);
      return;
    }

    if (formData.items.length === 0) {
      toast.error(translations.errors.itemsRequired);
      return;
    }

    // Validate all items
    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i];
      if (!item.product_id || !item.unit_id || item.per_price <= 0 || item.amount <= 0) {
        toast.error(`آیتم ${i + 1} ناقص است`);
        return;
      }
    }

    try {
      setLoading(true);
      if (editingPurchase) {
        await updatePurchase(
          editingPurchase.id,
          formData.supplier_id,
          formData.date,
          formData.notes || null,
          formData.items
        );
        toast.success(translations.success.updated);
      } else {
        await createPurchase(
          formData.supplier_id,
          formData.date,
          formData.notes || null,
          formData.items
        );
        toast.success(translations.success.created);
      }
      handleCloseModal();
      await loadData();
    } catch (error: any) {
      toast.error(editingPurchase ? translations.errors.update : translations.errors.create);
      console.error("Error saving purchase:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      setLoading(true);
      await deletePurchase(id);
      toast.success(translations.success.deleted);
      setDeleteConfirm(null);
      await loadData();
    } catch (error: any) {
      toast.error(translations.errors.delete);
      console.error("Error deleting purchase:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSupplierName = (supplierId: number) => {
    return suppliers.find(s => s.id === supplierId)?.full_name || `ID: ${supplierId}`;
  };

  const calculatePaidAmount = (purchaseId: number): number => {
    const payments = purchasePayments[purchaseId] || [];
    return payments.reduce((sum, payment) => sum + payment.total, 0);
  };

  const calculateRemainingAmount = (purchase: Purchase): number => {
    const paid = calculatePaidAmount(purchase.id);
    return purchase.total_amount - paid;
  };

  const handleOpenPaymentModal = (purchase: Purchase) => {
    setViewingPurchase({ purchase, items: [] });
    setPaymentFormData({
      amount: "",
      currency: currencies[0]?.name || "",
      rate: "1",
      total: "",
      date: persianToGeorgian(getCurrentPersianDate()) || new Date().toISOString().split('T')[0],
      notes: "",
    });
    setIsPaymentModalOpen(true);
  };

  const handleClosePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setPaymentFormData({
      amount: "",
      currency: "",
      rate: "1",
      total: "",
      date: persianToGeorgian(getCurrentPersianDate()) || new Date().toISOString().split('T')[0],
      notes: "",
    });
  };

  const calculatePaymentTotal = () => {
    const amount = parseFloat(paymentFormData.amount) || 0;
    const rate = parseFloat(paymentFormData.rate) || 1;
    return amount * rate;
  };

  useEffect(() => {
    const total = calculatePaymentTotal();
    setPaymentFormData(prev => ({ ...prev, total: total.toFixed(2) }));
  }, [paymentFormData.amount, paymentFormData.rate]);

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingPurchase) return;

    if (!paymentFormData.amount || parseFloat(paymentFormData.amount) <= 0) {
      toast.error("مبلغ پرداخت باید بیشتر از صفر باشد");
      return;
    }

    if (!paymentFormData.currency) {
      toast.error("انتخاب ارز الزامی است");
      return;
    }

    try {
      setLoading(true);
      const amount = parseFloat(paymentFormData.amount);
      const rate = parseFloat(paymentFormData.rate) || 1;
      await createPurchasePayment(
        viewingPurchase.purchase.id,
        amount,
        paymentFormData.currency,
        rate,
        paymentFormData.date,
        paymentFormData.notes || null
      );
      toast.success("پرداخت با موفقیت ثبت شد");
      handleClosePaymentModal();
      await loadData();
      // Reload payments for this purchase
      const payments = await getPurchasePaymentsByPurchase(viewingPurchase.purchase.id);
      setPurchasePayments(prev => ({
        ...prev,
        [viewingPurchase.purchase.id]: payments,
      }));
    } catch (error: any) {
      toast.error("خطا در ثبت پرداخت");
      console.error("Error adding payment:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePayment = async (paymentId: number, purchaseId: number) => {
    try {
      setLoading(true);
      await deletePurchasePayment(paymentId);
      toast.success("پرداخت با موفقیت حذف شد");
      await loadData();
      // Reload payments for this purchase
      const payments = await getPurchasePaymentsByPurchase(purchaseId);
      setPurchasePayments(prev => ({
        ...prev,
        [purchaseId]: payments,
      }));
    } catch (error: any) {
      toast.error("خطا در حذف پرداخت");
      console.error("Error deleting payment:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title={translations.title}
          onBack={onBack}
          backLabel={translations.backToDashboard}
          actions={[
            {
              label: translations.addNew,
              onClick: () => handleOpenModal(),
              variant: "primary" as const
            }
          ]}
        />

        {/* Search Bar */}
        <div className="relative max-w-md w-full mb-6">
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="block w-full pr-10 pl-3 py-3 border border-gray-200 dark:border-gray-700 rounded-xl leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 sm:text-sm transition-all shadow-sm hover:shadow-md"
            placeholder="جستجو بر اساس تاریخ، یادداشت یا تمویل کننده..."
          />
        </div>

        {(() => {
          const columns = [
            {
              key: "supplier_id", label: translations.supplier, sortable: false,
              render: (p: Purchase) => (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                    {getSupplierName(p.supplier_id).charAt(0)}
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white">{getSupplierName(p.supplier_id)}</span>
                </div>
              )
            },
            {
              key: "date", label: translations.date, sortable: true,
              render: (p: Purchase) => (
                <span className="text-gray-700 dark:text-gray-300 font-medium">
                  {formatPersianDate(p.date)}
                </span>
              )
            },
            {
              key: "total_amount", label: translations.totalAmount, sortable: true,
              render: (p: Purchase) => (
                <span className="text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  {p.total_amount.toLocaleString('fa-IR')} افغانی
                </span>
              )
            },
            {
              key: "paid_amount", label: translations.paidAmount, sortable: false,
              render: (p: Purchase) => {
                const paid = calculatePaidAmount(p.id);
                return (
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                    {paid.toLocaleString('fa-IR')} افغانی
                  </span>
                );
              }
            },
            {
              key: "remaining_amount", label: translations.remainingAmount, sortable: false,
              render: (p: Purchase) => {
                const remaining = calculateRemainingAmount(p);
                return (
                  <span className={`text-lg font-bold ${remaining > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {remaining.toLocaleString('fa-IR')} افغانی
                  </span>
                );
              }
            },
            {
              key: "notes", label: translations.notes, sortable: false,
              render: (p: Purchase) => p.notes ? (
                <span className="text-gray-600 dark:text-gray-400 text-sm truncate max-w-xs block" title={p.notes}>
                  {p.notes}
                </span>
              ) : <span className="text-gray-400">-</span>
            },
            {
              key: "created_at", label: "تاریخ ایجاد", sortable: true,
              render: (p: Purchase) => (
                <span className="text-gray-600 dark:text-gray-400 text-sm">
                  {new Date(p.created_at).toLocaleDateString('fa-IR')}
                </span>
              )
            }
          ];

          return (
            <Table
              data={purchases}
              columns={columns}
              total={totalItems}
              page={page}
              perPage={perPage}
              onPageChange={setPage}
              onPerPageChange={setPerPage}
              onSort={(key, dir) => {
                setSortBy(key);
                setSortOrder(dir);
              }}
              sortBy={sortBy}
              sortOrder={sortOrder}
              loading={loading}
              actions={(purchase) => (
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleViewPurchase(purchase)}
                    className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                    title="مشاهده"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleOpenPaymentModal(purchase)}
                    className="p-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                    title="افزودن پرداخت"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleOpenModal(purchase)}
                    className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    title={translations.edit}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setDeleteConfirm(purchase.id)}
                    className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    title={translations.delete}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </motion.button>
                </div>
              )}
            />
          );
        })()}

        {/* Modal for Add/Edit */}
        <AnimatePresence>
          {isModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
              onClick={handleCloseModal}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto my-8"
              >
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                  {editingPurchase ? translations.edit : translations.addNew}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        {translations.supplier} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.supplier_id}
                        onChange={(e) => setFormData({ ...formData, supplier_id: parseInt(e.target.value) })}
                        required
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200"
                        dir="rtl"
                      >
                        <option value={0}>انتخاب تمویل کننده</option>
                        {suppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        {translations.date} <span className="text-red-500">*</span>
                      </label>
                      <PersianDatePicker
                        value={formData.date}
                        onChange={(date) => setFormData({ ...formData, date })}
                        placeholder={translations.placeholders.date}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      {translations.notes}
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200 resize-none"
                      placeholder={translations.placeholders.notes}
                      dir="rtl"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {translations.items} <span className="text-red-500">*</span>
                      </label>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={addItem}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                      >
                        {translations.addItem}
                      </motion.button>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {formData.items.map((item, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-gray-200 dark:border-gray-600"
                        >
                          <div className="grid grid-cols-12 gap-3 items-end">
                            <div className="col-span-4">
                              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                {translations.product}
                              </label>
                              <select
                                value={item.product_id}
                                onChange={(e) => updateItem(index, 'product_id', parseInt(e.target.value))}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-purple-500"
                                dir="rtl"
                              >
                                <option value={0}>انتخاب محصول</option>
                                {products.map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                {translations.unit}
                              </label>
                              <select
                                value={item.unit_id}
                                onChange={(e) => updateItem(index, 'unit_id', parseInt(e.target.value))}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-purple-500"
                                dir="rtl"
                              >
                                <option value={0}>انتخاب واحد</option>
                                {units.map((unit) => (
                                  <option key={unit.id} value={unit.id}>
                                    {unit.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                {translations.perPrice}
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={item.per_price || ''}
                                onChange={(e) => updateItem(index, 'per_price', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-purple-500"
                                dir="ltr"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                {translations.amount}
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={item.amount || ''}
                                onChange={(e) => updateItem(index, 'amount', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-purple-500"
                                dir="ltr"
                              />
                            </div>
                            <div className="col-span-1">
                              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                {translations.total}
                              </div>
                              <div className="px-3 py-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-sm font-bold text-purple-700 dark:text-purple-300">
                                {calculateItemTotal(item).toLocaleString('fa-IR')}
                              </div>
                            </div>
                            <div className="col-span-1">
                              <motion.button
                                type="button"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => removeItem(index)}
                                className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
                              >
                                {translations.removeItem}
                              </motion.button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {formData.items.length > 0 && (
                      <div className="mt-4 p-4 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-xl">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-gray-900 dark:text-white">
                            {translations.totalAmount}:
                          </span>
                          <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {calculateTotal().toLocaleString('fa-IR')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleCloseModal}
                      className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-bold rounded-xl transition-colors"
                    >
                      {translations.cancel}
                    </motion.button>
                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileHover={{ scale: loading ? 1 : 1.05 }}
                      whileTap={{ scale: loading ? 1 : 0.95 }}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                          />
                          {translations.save}
                        </span>
                      ) : (
                        translations.save
                      )}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* View Purchase Items Modal */}
        <AnimatePresence>
          {isViewModalOpen && viewingPurchase && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4"
              onClick={() => setIsViewModalOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 w-full max-w-5xl max-h-[90vh] overflow-y-auto border border-purple-100 dark:border-purple-900/30"
              >
                {/* Header */}
                <div className="flex justify-between items-center mb-8 pb-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                        جزئیات خریداری
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        مشاهده اطلاعات کامل خریداری
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowInvoice(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl shadow-md transition-all duration-200"
                      title="چاپ فاکتور"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      چاپ فاکتور
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setIsViewModalOpen(false)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </motion.button>
                  </div>
                </div>

                {/* Purchase Info */}
                <div className="grid grid-cols-2 gap-6 mb-8">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="p-5 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl border border-purple-200/50 dark:border-purple-700/30">
                    <div className="flex items-center gap-3 mb-2">
                      <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                        {translations.supplier}
                      </label>
                    </div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white mr-8">
                      {getSupplierName(viewingPurchase.purchase.supplier_id)}
                    </p>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border border-green-200/50 dark:border-green-700/30">
                    <div className="flex items-center gap-3 mb-2">
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                        {translations.date}
                      </label>
                    </div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white mr-8">
                      {formatPersianDate(viewingPurchase.purchase.date)}
                    </p>
                  </motion.div>
                </div>

                {viewingPurchase.purchase.notes && (
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    className="mb-8 p-5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl border border-amber-200/50 dark:border-amber-700/30">
                    <div className="flex items-center gap-3 mb-3">
                      <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                        {translations.notes}
                      </label>
                    </div>
                    <p className="text-gray-800 dark:text-gray-200 leading-relaxed mr-8">
                      {viewingPurchase.purchase.notes}
                    </p>
                  </motion.div>
                )}

                {/* Items Table */}
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-5">
                    <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {translations.items}
                    </h3>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-purple-600 to-blue-600">
                          <th className="px-6 py-4 text-right text-sm font-bold text-white">
                            {translations.product}
                          </th>
                          <th className="px-6 py-4 text-right text-sm font-bold text-white">
                            {translations.unit}
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-bold text-white">
                            {translations.perPrice}
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-bold text-white">
                            {translations.amount}
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-bold text-white">
                            {translations.total}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingPurchase.items.map((item, index) => {
                          const product = products.find(p => p.id === item.product_id);
                          const unit = units.find(u => u.id === item.unit_id);
                          return (
                            <motion.tr
                              key={item.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="border-b border-gray-200 dark:border-gray-700 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors"
                            >
                              <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                                {product?.name || `ID: ${item.product_id}`}
                              </td>
                              <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                                {unit ? unit.name : `ID: ${item.unit_id}`}
                              </td>
                              <td className="px-6 py-4 text-gray-900 dark:text-white text-left font-semibold">
                                {item.per_price.toLocaleString('fa-IR')}
                              </td>
                              <td className="px-6 py-4 text-gray-900 dark:text-white text-left font-semibold">
                                {item.amount.toLocaleString('fa-IR')}
                              </td>
                              <td className="px-6 py-4 text-left">
                                <span className="inline-block px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold rounded-lg">
                                  {item.total.toLocaleString('fa-IR')}
                                </span>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/40 dark:to-blue-900/40">
                          <td colSpan={4} className="px-6 py-5 text-right font-bold text-gray-900 dark:text-white text-lg">
                            <div className="flex items-center justify-end gap-2">
                              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {translations.totalAmount}:
                            </div>
                          </td>
                          <td className="px-6 py-5 text-left">
                            <span className="inline-block px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-xl rounded-xl shadow-lg">
                              {viewingPurchase.purchase.total_amount.toLocaleString('fa-IR')} افغانی
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Payment Summary */}
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-5">
                    <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {translations.payments}
                    </h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="p-5 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl border border-purple-200/50 dark:border-purple-700/30">
                      <div className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                        {translations.totalAmount}
                      </div>
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {viewingPurchase.purchase.total_amount.toLocaleString('fa-IR')} افغانی
                      </div>
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border border-green-200/50 dark:border-green-700/30">
                      <div className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                        {translations.paidAmount}
                      </div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {calculatePaidAmount(viewingPurchase.purchase.id).toLocaleString('fa-IR')} افغانی
                      </div>
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="p-5 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-2xl border border-red-200/50 dark:border-red-700/30">
                      <div className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                        {translations.remainingAmount}
                      </div>
                      <div className={`text-2xl font-bold ${calculateRemainingAmount(viewingPurchase.purchase) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {calculateRemainingAmount(viewingPurchase.purchase).toLocaleString('fa-IR')} افغانی
                      </div>
                    </motion.div>
                  </div>

                  {/* Payment History */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-5 border border-gray-200 dark:border-gray-600">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-gray-900 dark:text-white">تاریخچه پرداخت‌ها</h4>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleOpenPaymentModal(viewingPurchase.purchase)}
                        className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all"
                      >
                        {translations.addPayment}
                      </motion.button>
                    </div>
                    {purchasePayments[viewingPurchase.purchase.id]?.length > 0 ? (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {purchasePayments[viewingPurchase.purchase.id].map((payment) => (
                          <motion.div
                            key={payment.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-center"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {payment.amount.toLocaleString('fa-IR')} {payment.currency}
                                </span>
                                <span className="text-xs text-gray-500">× {payment.rate}</span>
                                <span className="text-sm font-bold text-green-600 dark:text-green-400">
                                  = {payment.total.toLocaleString('fa-IR')} افغانی
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {formatPersianDate(payment.date)}
                                {payment.notes && ` • ${payment.notes}`}
                              </div>
                            </div>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleDeletePayment(payment.id, viewingPurchase.purchase.id)}
                              className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </motion.button>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        {translations.noPayments}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsViewModalOpen(false)}
                    className="px-8 py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200">
                    بستن
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Payment Modal */}
        <AnimatePresence>
          {isPaymentModalOpen && viewingPurchase && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={handleClosePaymentModal}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              >
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                  {translations.addPayment} - {getSupplierName(viewingPurchase.purchase.supplier_id)}
                </h2>
                <form onSubmit={handleAddPayment} className="space-y-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl mb-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">مبلغ کل خریداری</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {viewingPurchase.purchase.total_amount.toLocaleString('fa-IR')} افغانی
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      پرداخت شده: {calculatePaidAmount(viewingPurchase.purchase.id).toLocaleString('fa-IR')} افغانی
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      باقیمانده: {calculateRemainingAmount(viewingPurchase.purchase).toLocaleString('fa-IR')} افغانی
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        {translations.paymentAmount}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={paymentFormData.amount}
                        onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                        required
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200"
                        placeholder={translations.placeholders.amount}
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        {translations.paymentCurrency}
                      </label>
                      <select
                        value={paymentFormData.currency}
                        onChange={(e) => setPaymentFormData({ ...paymentFormData, currency: e.target.value })}
                        required
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200"
                        dir="rtl"
                      >
                        <option value="">انتخاب ارز</option>
                        {currencies.map((currency) => (
                          <option key={currency.id} value={currency.name}>
                            {currency.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        {translations.paymentRate}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={paymentFormData.rate}
                        onChange={(e) => setPaymentFormData({ ...paymentFormData, rate: e.target.value })}
                        required
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200"
                        placeholder={translations.placeholders.rate}
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        {translations.paymentTotal}
                      </label>
                      <input
                        type="text"
                        value={paymentFormData.total}
                        readOnly
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      {translations.paymentDate}
                    </label>
                    <PersianDatePicker
                      value={paymentFormData.date}
                      onChange={(date) => setPaymentFormData({ ...paymentFormData, date })}
                      placeholder={translations.placeholders.date}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      {translations.paymentNotes}
                    </label>
                    <textarea
                      value={paymentFormData.notes}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200 resize-none"
                      placeholder={translations.placeholders.notes}
                      dir="rtl"
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleClosePaymentModal}
                      className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-bold rounded-xl transition-colors"
                    >
                      {translations.cancel}
                    </motion.button>
                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileHover={{ scale: loading ? 1 : 1.05 }}
                      whileTap={{ scale: loading ? 1 : 0.95 }}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                          />
                          {translations.save}
                        </span>
                      ) : (
                        translations.addPayment
                      )}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4"
              onClick={() => setDeleteConfirm(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 w-full max-w-md border border-red-100 dark:border-red-900/30"
              >
                {/* Warning Icon */}
                <div className="flex justify-center mb-6">
                  <motion.div
                    animate={{
                      scale: [1, 1.1, 1],
                      rotate: [0, -5, 5, -5, 0]
                    }}
                    transition={{
                      duration: 0.5,
                      repeat: Infinity,
                      repeatDelay: 2
                    }}
                    className="w-20 h-20 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg"
                  >
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </motion.div>
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-3">
                  {translations.delete}
                </h2>

                {/* Message */}
                <p className="text-center text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                  {translations.confirmDelete}
                </p>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-bold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    {translations.cancel}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDelete(deleteConfirm)}
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-bold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                        />
                        در حال حذف...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        {translations.delete}
                      </span>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Invoice Modal */}
        {showInvoice && viewingPurchase && (
          <PurchaseInvoice
            purchaseData={viewingPurchase}
            supplier={suppliers.find(s => s.id === viewingPurchase.purchase.supplier_id)!}
            products={products}
            units={units}
            companySettings={companySettings}
            onClose={() => setShowInvoice(false)}
          />
        )}
        <Footer />
      </div>
    </div>
  );
}
