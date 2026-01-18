import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  initProductsTable,
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
  type Product,
} from "../utils/product";
import { getCurrencies, type Currency } from "../utils/currency";
import { getSuppliers, type Supplier } from "../utils/supplier"; // getSuppliers is now paginated
import { isDatabaseOpen, openDatabase } from "../utils/db";
import Footer from "./Footer";
import Table from "./common/Table";
import PageHeader from "./common/PageHeader";
import { Search } from "lucide-react";

// Dari translations
const translations = {
  title: "جنس",
  addNew: "افزودن جنس جدید",
  edit: "ویرایش",
  delete: "حذف",
  cancel: "لغو",
  save: "ذخیره",
  name: "نام جنس",
  description: "توضیحات",
  price: "قیمت",
  currency: "ارز",
  supplier: "تمویل کننده",
  stockQuantity: "مقدار موجودی",
  unit: "واحد",
  selectCurrency: "انتخاب ارز",
  selectSupplier: "انتخاب تمویل کننده",
  noCurrency: "بدون ارز",
  noSupplier: "بدون تمویل کننده",
  actions: "عملیات",
  createdAt: "تاریخ ایجاد",
  updatedAt: "آخرین بروزرسانی",
  noProducts: "هیچ جنسی ثبت نشده است",
  confirmDelete: "آیا از حذف این جنس اطمینان دارید؟",
  backToDashboard: "بازگشت به داشبورد",
  success: {
    created: "جنس با موفقیت ایجاد شد",
    updated: "جنس با موفقیت بروزرسانی شد",
    deleted: "جنس با موفقیت حذف شد",
    tableInit: "جدول اجناس با موفقیت ایجاد شد",
  },
  errors: {
    create: "خطا در ایجاد جنس",
    update: "خطا در بروزرسانی جنس",
    delete: "خطا در حذف جنس",
    fetch: "خطا در دریافت اجناس",
    nameRequired: "نام جنس الزامی است",
  },
  placeholders: {
    name: "نام جنس را وارد کنید",
    description: "توضیحات را وارد کنید (اختیاری)",
    price: "قیمت را وارد کنید (اختیاری)",
    stockQuantity: "مقدار موجودی را وارد کنید (اختیاری)",
    unit: "واحد را وارد کنید (مثال: کیلوگرم، عدد) (اختیاری)",
  },
};

interface ProductManagementProps {
  onBack?: () => void;
}

export default function ProductManagement({ onBack }: ProductManagementProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    currency_id: "",
    supplier_id: "",
    stock_quantity: "",
    unit: "",
  });
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Pagination & Search
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    loadData();
  }, [page, perPage, search, sortBy, sortOrder]);

  const loadData = async () => {
    try {
      setLoading(true);
      const dbOpen = await isDatabaseOpen();
      if (!dbOpen) {
        await openDatabase("db");
      }

      try {
        await initProductsTable();
      } catch (err) {
        console.log("Table initialization:", err);
      }

      // Fetch products paginated, currencies (all), suppliers (all for dropdown - large perPage)
      const [productsResponse, currenciesData, suppliersResponse] = await Promise.all([
        getProducts(page, perPage, search, sortBy, sortOrder),
        getCurrencies().catch(() => []),
        getSuppliers(1, 1000).catch(() => ({ items: [] } as any)),
      ]);

      setProducts(productsResponse.items);
      setTotalItems(productsResponse.total);
      setCurrencies(currenciesData);
      setSuppliers(suppliersResponse.items || []);
    } catch (error: any) {
      toast.error(translations.errors.fetch);
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        description: product.description || "",
        price: product.price?.toString() || "",
        currency_id: product.currency_id?.toString() || "",
        supplier_id: product.supplier_id?.toString() || "",
        stock_quantity: product.stock_quantity?.toString() || "",
        unit: product.unit || "",
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        description: "",
        price: "",
        currency_id: "",
        supplier_id: "",
        stock_quantity: "",
        unit: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormData({
      name: "",
      description: "",
      price: "",
      currency_id: "",
      supplier_id: "",
      stock_quantity: "",
      unit: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error(translations.errors.nameRequired);
      return;
    }

    try {
      setLoading(true);
      const productData = {
        name: formData.name,
        description: formData.description || null,
        price: formData.price ? parseFloat(formData.price) : null,
        currency_id: formData.currency_id ? parseInt(formData.currency_id) : null,
        supplier_id: formData.supplier_id ? parseInt(formData.supplier_id) : null,
        stock_quantity: formData.stock_quantity ? parseFloat(formData.stock_quantity) : null,
        unit: formData.unit || null,
      };

      if (editingProduct) {
        await updateProduct(
          editingProduct.id,
          productData.name,
          productData.description,
          productData.price,
          productData.currency_id,
          productData.supplier_id,
          productData.stock_quantity,
          productData.unit
        );
        toast.success(translations.success.updated);
      } else {
        await createProduct(
          productData.name,
          productData.description,
          productData.price,
          productData.currency_id,
          productData.supplier_id,
          productData.stock_quantity,
          productData.unit
        );
        toast.success(translations.success.created);
      }
      handleCloseModal();
      await loadData();
    } catch (error: any) {
      toast.error(editingProduct ? translations.errors.update : translations.errors.create);
      console.error("Error saving product:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      setLoading(true);
      await deleteProduct(id);
      toast.success(translations.success.deleted);
      setDeleteConfirm(null);
      await loadData();
    } catch (error: any) {
      toast.error(translations.errors.delete);
      console.error("Error deleting product:", error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrencyName = (currencyId: number | null | undefined) => {
    if (!currencyId) return null;
    const currency = currencies.find((c) => c.id === currencyId);
    return currency?.name || null;
  };

  const getSupplierName = (supplierId: number | null | undefined) => {
    if (!supplierId) return null;
    const supplier = suppliers.find((s) => s.id === supplierId);
    return supplier?.full_name || null;
  };

  const columns = [
    {
      key: "name", label: translations.name, sortable: true,
      render: (p: Product) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm">
            {p.name.charAt(0)}
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{p.name}</div>
            {p.description && <div className="text-xs text-gray-500 truncate max-w-[150px]">{p.description}</div>}
          </div>
        </div>
      )
    },
    {
      key: "price", label: translations.price, sortable: true,
      render: (p: Product) => p.price ? (
        <span className="font-medium text-gray-900 dark:text-white">
          {p.price.toLocaleString('fa-IR')} <span className="text-xs text-gray-500">{getCurrencyName(p.currency_id)}</span>
        </span>
      ) : <span className="text-gray-400">-</span>
    },
    {
      key: "stock_quantity", label: translations.stockQuantity, sortable: true,
      render: (p: Product) => p.stock_quantity ? (
        <span className="font-medium text-gray-900 dark:text-white">
          {p.stock_quantity.toLocaleString('fa-IR')} <span className="text-xs text-gray-500">{p.unit}</span>
        </span>
      ) : <span className="text-gray-400">-</span>
    },
    {
      key: "supplier_id", label: translations.supplier, sortable: false,
      render: (p: Product) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">{getSupplierName(p.supplier_id) || "-"}</span>
      )
    },
    {
      key: "created_at", label: translations.createdAt, sortable: true,
      render: (p: Product) => (
        <span className="text-gray-600 dark:text-gray-400 text-sm">
          {new Date(p.created_at).toLocaleDateString('fa-IR')}
        </span>
      )
    }
  ];

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
          <div className="relative max-w-md w-full">
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
              placeholder="جستجو بر اساس نام..."
            />
          </div>

        <Table
          data={products}
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
          actions={(product) => (
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleOpenModal(product)}
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
                onClick={() => setDeleteConfirm(product.id)}
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

        {/* Modal for Add/Edit */}
        <AnimatePresence>
          {isModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={handleCloseModal}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              >
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                  {editingProduct ? translations.edit : translations.addNew}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      {translations.name} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200"
                      placeholder={translations.placeholders.name}
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      {translations.description}
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200 resize-none"
                      placeholder={translations.placeholders.description}
                      dir="rtl"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        {translations.price}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200"
                        placeholder={translations.placeholders.price}
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        {translations.currency}
                      </label>
                      <select
                        value={formData.currency_id}
                        onChange={(e) => setFormData({ ...formData, currency_id: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200"
                        dir="rtl"
                      >
                        <option value="">{translations.noCurrency}</option>
                        {currencies.map((currency) => (
                          <option key={currency.id} value={currency.id}>
                            {currency.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        {translations.stockQuantity}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.stock_quantity}
                        onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200"
                        placeholder={translations.placeholders.stockQuantity}
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        {translations.unit}
                      </label>
                      <input
                        type="text"
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200"
                        placeholder={translations.placeholders.unit}
                        dir="rtl"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      {translations.supplier}
                    </label>
                    <select
                      value={formData.supplier_id}
                      onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200"
                      dir="rtl"
                    >
                      <option value="">{translations.noSupplier}</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.full_name}
                        </option>
                      ))}
                    </select>
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
        <Footer />
      </div>
    </div>
  );
}
