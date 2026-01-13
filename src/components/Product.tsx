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
import { getSuppliers, type Supplier } from "../utils/supplier";
import { isDatabaseOpen, openDatabase } from "../utils/db";

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

  useEffect(() => {
    loadData();
  }, []);

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

      const [productsData, currenciesData, suppliersData] = await Promise.all([
        getProducts(),
        getCurrencies().catch(() => []),
        getSuppliers().catch(() => []),
      ]);
      
      setProducts(productsData);
      setCurrencies(currenciesData);
      setSuppliers(suppliersData);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        {/* Beautiful Back Button */}
        {onBack && (
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-6"
          >
            <motion.button
              whileHover={{ scale: 1.05, x: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={onBack}
              className="group flex items-center gap-3 px-6 py-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl hover:bg-white dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-2xl shadow-lg hover:shadow-xl border-2 border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 transition-all duration-300"
            >
              <motion.svg
                className="w-5 h-5 text-purple-600 dark:text-purple-400"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
                stroke="currentColor"
                animate={{ x: [0, -3, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <path d="M15 19l-7-7 7-7" />
              </motion.svg>
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent group-hover:from-purple-700 group-hover:to-blue-700 transition-all duration-300">
                {translations.backToDashboard}
              </span>
            </motion.button>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              {translations.title}
            </h1>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleOpenModal()}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {translations.addNew}
            </motion.button>
          </div>
        </motion.div>

        {loading && products.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full"
            />
          </div>
        ) : products.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-xl"
          >
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              {translations.noProducts}
            </p>
          </motion.div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence>
              {products.map((product) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-lg p-6 border border-white/20 dark:border-gray-700/50"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                        {product.name}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-gray-600 dark:text-gray-400">
                        {product.description && (
                          <div className="col-span-2">
                            <p className="text-sm">{product.description}</p>
                          </div>
                        )}
                        {product.price !== null && product.price !== undefined && (
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{product.price.toLocaleString('fa-IR')} {getCurrencyName(product.currency_id) || ""}</span>
                          </div>
                        )}
                        {product.stock_quantity !== null && product.stock_quantity !== undefined && (
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            <span>{product.stock_quantity.toLocaleString('fa-IR')} {product.unit || ""}</span>
                          </div>
                        )}
                        {getSupplierName(product.supplier_id) && (
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span>{getSupplierName(product.supplier_id)}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-500 mt-4">
                        <span>{translations.createdAt}: {new Date(product.created_at).toLocaleDateString('fa-IR')}</span>
                        <span>{translations.updatedAt}: {new Date(product.updated_at).toLocaleDateString('fa-IR')}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleOpenModal(product)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        {translations.edit}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setDeleteConfirm(product.id)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                      >
                        {translations.delete}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

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
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setDeleteConfirm(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 w-full max-w-md"
              >
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  {translations.delete}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {translations.confirmDelete}
                </p>
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-bold rounded-xl transition-colors"
                  >
                    {translations.cancel}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDelete(deleteConfirm)}
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                  >
                    {translations.delete}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
