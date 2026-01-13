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
  type PurchaseItem,
  type PurchaseItemInput,
  type PurchaseWithItems,
} from "../utils/purchase";
import { getSuppliers, type Supplier } from "../utils/supplier";
import { getProducts, type Product } from "../utils/product";
import { getUnits, type Unit } from "../utils/unit";
import { isDatabaseOpen, openDatabase } from "../utils/db";

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
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<PurchaseWithItems | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [formData, setFormData] = useState({
    supplier_id: 0,
    date: new Date().toISOString().split('T')[0],
    notes: "",
    items: [] as PurchaseItemInput[],
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
        await initPurchasesTable();
      } catch (err) {
        console.log("Table initialization:", err);
      }

      const [purchasesData, suppliersData, productsData, unitsData] = await Promise.all([
        getPurchases(),
        getSuppliers(),
        getProducts(),
        getUnits(),
      ]);

      setPurchases(purchasesData);
      setSuppliers(suppliersData);
      setProducts(productsData);
      setUnits(unitsData);
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

        {loading && purchases.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full"
            />
          </div>
        ) : purchases.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-xl"
          >
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              {translations.noPurchases}
            </p>
          </motion.div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence>
              {purchases.map((purchase) => (
                <motion.div
                  key={purchase.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-lg p-6 border border-white/20 dark:border-gray-700/50"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-3">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          {getSupplierName(purchase.supplier_id)}
                        </h3>
                        <span className="px-3 py-1 bg-gradient-to-r from-green-400 to-emerald-500 text-white text-sm font-bold rounded-full">
                          {new Date(purchase.date).toLocaleDateString('fa-IR')}
                        </span>
                      </div>
                      <div className="text-lg font-semibold text-purple-600 dark:text-purple-400 mb-2">
                        {translations.totalAmount}: {purchase.total_amount.toLocaleString('fa-IR')}
                      </div>
                      {purchase.notes && (
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                          {purchase.notes}
                        </p>
                      )}
                      <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-500">
                        <span>{new Date(purchase.created_at).toLocaleDateString('fa-IR')}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleOpenModal(purchase)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        {translations.edit}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setDeleteConfirm(purchase.id)}
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
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        required
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200"
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
                                    {unit.name} {unit.symbol ? `(${unit.symbol})` : ''}
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
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setIsViewModalOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    جزئیات خریداری
                  </h2>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsViewModalOpen(false)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </motion.button>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        {translations.supplier}
                      </label>
                      <p className="text-gray-900 dark:text-white">
                        {getSupplierName(viewingPurchase.purchase.supplier_id)}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        {translations.date}
                      </label>
                      <p className="text-gray-900 dark:text-white">
                        {new Date(viewingPurchase.purchase.date).toLocaleDateString('fa-IR')}
                      </p>
                    </div>
                  </div>
                  {viewingPurchase.purchase.notes && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        {translations.notes}
                      </label>
                      <p className="text-gray-900 dark:text-white">
                        {viewingPurchase.purchase.notes}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                    {translations.items}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-100 dark:bg-gray-700">
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                            {translations.product}
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                            {translations.unit}
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                            {translations.perPrice}
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                            {translations.amount}
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                            {translations.total}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingPurchase.items.map((item) => {
                          const product = products.find(p => p.id === item.product_id);
                          const unit = units.find(u => u.id === item.unit_id);
                          return (
                            <tr key={item.id} className="border-b border-gray-200 dark:border-gray-700">
                              <td className="px-4 py-3 text-gray-900 dark:text-white">
                                {product?.name || `ID: ${item.product_id}`}
                              </td>
                              <td className="px-4 py-3 text-gray-900 dark:text-white">
                                {unit ? `${unit.name} ${unit.symbol ? `(${unit.symbol})` : ''}` : `ID: ${item.unit_id}`}
                              </td>
                              <td className="px-4 py-3 text-gray-900 dark:text-white text-left">
                                {item.per_price.toLocaleString('fa-IR')}
                              </td>
                              <td className="px-4 py-3 text-gray-900 dark:text-white text-left">
                                {item.amount.toLocaleString('fa-IR')}
                              </td>
                              <td className="px-4 py-3 text-gray-900 dark:text-white text-left font-semibold">
                                {item.total.toLocaleString('fa-IR')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30">
                          <td colSpan={4} className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                            {translations.totalAmount}:
                          </td>
                          <td className="px-4 py-3 text-left font-bold text-purple-600 dark:text-purple-400 text-lg">
                            {viewingPurchase.purchase.total_amount.toLocaleString('fa-IR')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsViewModalOpen(false)}
                    className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-bold rounded-xl transition-colors"
                  >
                    {translations.cancel}
                  </motion.button>
                </div>
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
