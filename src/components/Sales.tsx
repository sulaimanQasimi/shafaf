import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
    initSalesTable,
    createSale,
    getSales,
    getSale,
    updateSale,
    deleteSale,
    createSalePayment,
    getSalePayments,
    type Sale,
    type SaleItemInput,
    type SaleWithItems,
    type SalePayment,
} from "../utils/sales";
import { getCustomers, type Customer } from "../utils/customer";
import { getProducts, type Product } from "../utils/product";
import { getUnits, type Unit } from "../utils/unit";
import { isDatabaseOpen, openDatabase } from "../utils/db";

// Dari translations
const translations = {
    title: "مدیریت فروشات",
    addNew: "ثبت فروش جدید",
    edit: "ویرایش",
    delete: "حذف",
    cancel: "لغو",
    save: "ذخیره",
    customer: "مشتری",
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
    remainingAmount: "باقی مانده",
    noSales: "هیچ فروشی ثبت نشده است",
    confirmDelete: "آیا از حذف این فروش اطمینان دارید؟",
    backToDashboard: "بازگشت به داشبورد",
    printInvoice: "چاپ فاکتور",
    success: {
        created: "فروش با موفقیت ثبت شد",
        updated: "فروش با موفقیت بروزرسانی شد",
        deleted: "فروش با موفقیت حذف شد",
    },
    errors: {
        create: "خطا در ثبت فروش",
        update: "خطا در بروزرسانی فروش",
        delete: "خطا در حذف فروش",
        fetch: "خطا در دریافت لیست فروشات",
        customerRequired: "انتخاب مشتری الزامی است",
        dateRequired: "تاریخ الزامی است",
        itemsRequired: "حداقل یک آیتم الزامی است",
    },
    placeholders: {
        date: "تاریخ را انتخاب کنید",
        notes: "یادداشت‌ها (اختیاری)",
        selectProduct: "محصول را انتخاب کنید",
        selectUnit: "واحد را انتخاب کنید",
    },
    selectUnit: "واحد را انتخاب کنید",
},
    payments: {
        title: "پرداخت‌ها",
        add: "افزودن پرداخت",
        amount: "مبلغ",
        date: "تاریخ",
        history: "تاریخچه پرداخت‌ها",
        noPayments: "هیچ پرداختی ثبت نشده است",
    }
};

interface SalesManagementProps {
    onBack?: () => void;
}

export default function SalesManagement({ onBack }: SalesManagementProps) {
    const [sales, setSales] = useState<Sale[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewingSale, setViewingSale] = useState<SaleWithItems | null>(null);
    const [editingSale, setEditingSale] = useState<Sale | null>(null);
    const [formData, setFormData] = useState({
        customer_id: 0,
        date: new Date().toISOString().split('T')[0],
        notes: "",
        paid_amount: 0,
        items: [] as SaleItemInput[],
    });
    const [payments, setPayments] = useState<SalePayment[]>([]);
    const [newPayment, setNewPayment] = useState({
        amount: '',
        date: new Date().toISOString().split('T')[0],
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
                await initSalesTable();
            } catch (err) {
                console.log("Table initialization:", err);
            }

            const [salesData, customersData, productsData, unitsData] = await Promise.all([
                getSales(),
                getCustomers(),
                getProducts(),
                getUnits(),
            ]);

            setSales(salesData);
            setCustomers(customersData);
            setProducts(productsData);
            setUnits(unitsData);
        } catch (error: any) {
            toast.error(translations.errors.fetch);
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadSaleDetails = async (id: number) => {
        try {
            const saleData = await getSale(id);
            setEditingSale(saleData.sale);
            setFormData({
                customer_id: saleData.sale.customer_id,
                date: saleData.sale.date,
                notes: saleData.sale.notes || "",
                paid_amount: saleData.sale.paid_amount,
                items: saleData.items.map(item => ({
                    product_id: item.product_id,
                    unit_id: item.unit_id,
                    per_price: item.per_price,
                    amount: item.amount,
                })),
            });
        } catch (error: any) {
            toast.error("خطا در دریافت جزئیات فروش");
            console.error("Error loading sale details:", error);
        }
    };

    const loadPayments = async (saleId: number) => {
        try {
            const paymentsData = await getSalePayments(saleId);
            setPayments(paymentsData);
        } catch (error) {
            console.error("Error loading payments:", error);
            toast.error("خطا در دریافت لیست پرداخت‌ها");
        }
    };

    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!viewingSale) return;

        if (!newPayment.amount || parseFloat(newPayment.amount) <= 0) {
            toast.error("مبلغ پرداخت باید بیشتر از صفر باشد");
            return;
        }

        try {
            setLoading(true);
            await createSalePayment(viewingSale.sale.id, parseFloat(newPayment.amount), newPayment.date);
            toast.success("پرداخت با موفقیت ثبت شد");
            setNewPayment({
                amount: '',
                date: new Date().toISOString().split('T')[0],
            });
            await loadPayments(viewingSale.sale.id);
            // Reload sale to update paid amount in main list/view logic if needed
            // But main list (sales state) needs refresh too
            await loadData();
            // Update viewingSale state as well
            const updatedSale = await getSale(viewingSale.sale.id);
            setViewingSale(updatedSale);
        } catch (error) {
            console.error("Error adding payment:", error);
            toast.error("خطا در ثبت پرداخت");
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePayment = async (paymentId: number) => {
        if (!viewingSale) return;
        try {
            // Confirm? Maybe too annoying with another modal within modal. Just do it or browser confirm.
            if (!window.confirm("آیا از حذف این پرداخت اطمینان دارید؟")) return;

            setLoading(true);
            await deleteSalePayment(paymentId);
            toast.success("پرداخت حذف شد");
            await loadPayments(viewingSale.sale.id);
            await loadData();
            const updatedSale = await getSale(viewingSale.sale.id);
            setViewingSale(updatedSale);
        } catch (error) {
            console.error("Error deleting payment:", error);
            toast.error("خطا در حذف پرداخت");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = async (sale?: Sale) => {
        if (sale) {
            await loadSaleDetails(sale.id);
        } else {
            setEditingSale(null);
            setFormData({
                customer_id: 0,
                date: new Date().toISOString().split('T')[0],
                notes: "",
                paid_amount: 0,
                items: [],
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingSale(null);
        setFormData({
            customer_id: 0,
            date: new Date().toISOString().split('T')[0],
            notes: "",
            paid_amount: 0,
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

    const handleViewSale = async (sale: Sale) => {
        try {
            const saleData = await getSale(sale.id);
            setViewingSale(saleData);
            await loadPayments(sale.id);
            setIsViewModalOpen(true);
        } catch (error: any) {
            toast.error("خطا در دریافت جزئیات فروش");
            console.error("Error loading sale details:", error);
        }
    };

    const removeItem = (index: number) => {
        setFormData({
            ...formData,
            items: formData.items.filter((_, i) => i !== index),
        });
    };

    const updateItem = (index: number, field: keyof SaleItemInput, value: any) => {
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };

        // Auto fill price if product is selected (optional feature)
        if (field === 'product_id') {
            const product = products.find(p => p.id === value);
            if (product && product.price) {
                newItems[index].per_price = product.price;
            }
            if (product && product.unit) {
                // Try to find unit by name, or leave as is
                const unit = units.find(u => u.name === product.unit);
                if (unit) {
                    newItems[index].unit_id = unit.id;
                }
            }
        }

        setFormData({ ...formData, items: newItems });
    };

    const calculateItemTotal = (item: SaleItemInput) => {
        return item.per_price * item.amount;
    };

    const calculateTotal = () => {
        return formData.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
    };

    const calculateRemaining = () => {
        return calculateTotal() - formData.paid_amount;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.customer_id) {
            toast.error(translations.errors.customerRequired);
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
            if (editingSale) {
                await updateSale(
                    editingSale.id,
                    formData.customer_id,
                    formData.date,
                    formData.notes || null,
                    formData.paid_amount,
                    formData.items
                );
                toast.success(translations.success.updated);
            } else {
                await createSale(
                    formData.customer_id,
                    formData.date,
                    formData.notes || null,
                    formData.paid_amount,
                    formData.items
                );
                toast.success(translations.success.created);
            }
            handleCloseModal();
            await loadData();
        } catch (error: any) {
            toast.error(editingSale ? translations.errors.update : translations.errors.create);
            console.error("Error saving sale:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            setLoading(true);
            await deleteSale(id);
            toast.success(translations.success.deleted);
            setDeleteConfirm(null);
            await loadData();
        } catch (error: any) {
            toast.error(translations.errors.delete);
            console.error("Error deleting sale:", error);
        } finally {
            setLoading(false);
        }
    };

    const getCustomerName = (customerId: number) => {
        return customers.find(c => c.id === customerId)?.full_name || `ID: ${customerId}`;
    };

    const getProductName = (productId: number) => {
        return products.find(p => p.id === productId)?.name || `ID: ${productId}`;
    };

    const getUnitName = (unitId: number) => {
        return units.find(u => u.id === unitId)?.name || `ID: ${unitId}`;
    };

    const printInvoice = (saleData: SaleWithItems) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const customer = customers.find(c => c.id === saleData.sale.customer_id);

        const html = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <title>فاکتور فروش #${saleData.sale.id}</title>
        <style>
          body { font-family: 'Tahoma', sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: center; }
          th { background-color: #f8f9fa; }
          .totals { margin-top: 20px; width: 300px; float: left; }
          .total-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }
          .total-row.final { font-weight: bold; font-size: 1.2em; border-top: 2px solid #000; border-bottom: none; margin-top: 10px; padding-top: 10px; }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>فروشگاه داروخانه شفاف</h1>
          <p>شماره فاکتور: #${saleData.sale.id}</p>
        </div>
        
        <div class="meta">
          <div>
            <strong>مشتری:</strong> ${customer?.full_name || '-'}<br>
            <strong>آدرس:</strong> ${customer?.address || '-'}<br>
            <strong>تلفن:</strong> ${customer?.phone || '-'}
          </div>
          <div>
            <strong>تاریخ:</strong> ${new Date(saleData.sale.date).toLocaleDateString('fa-IR')}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>محصول</th>
              <th>واحد</th>
              <th>قیمت واحد</th>
              <th>تعداد</th>
              <th>مجموع</th>
            </tr>
          </thead>
          <tbody>
            ${saleData.items.map((item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${getProductName(item.product_id)}</td>
                <td>${getUnitName(item.unit_id)}</td>
                <td>${item.per_price.toLocaleString('fa-IR')}</td>
                <td>${item.amount}</td>
                <td>${(item.per_price * item.amount).toLocaleString('fa-IR')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span>مبلغ کل:</span>
            <span>${saleData.sale.total_amount.toLocaleString('fa-IR')}</span>
          </div>
          <div class="total-row">
            <span>پرداخت شده:</span>
            <span>${saleData.sale.paid_amount.toLocaleString('fa-IR')}</span>
          </div>
          <div class="total-row final">
            <span>باقی مانده:</span>
            <span>${(saleData.sale.total_amount - saleData.sale.paid_amount).toLocaleString('fa-IR')}</span>
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6" dir="rtl">
            <div className="max-w-7xl mx-auto">
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

                {loading && sales.length === 0 ? (
                    <div className="flex justify-center items-center h-64">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full"
                        />
                    </div>
                ) : sales.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-20 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-purple-100 dark:border-purple-900/30"
                    >
                        <div className="flex flex-col items-center gap-4">
                            <motion.div
                                animate={{
                                    y: [0, -10, 0],
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                                className="w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-full flex items-center justify-center"
                            >
                                <svg className="w-12 h-12 text-purple-500 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                </svg>
                            </motion.div>
                            <p className="text-gray-600 dark:text-gray-400 text-xl font-semibold">
                                {translations.noSales}
                            </p>
                            <p className="text-gray-500 dark:text-gray-500 text-sm">
                                برای شروع، یک فروش جدید ثبت کنید
                            </p>
                        </div>
                    </motion.div>
                ) : (
                    <div className="grid gap-5">
                        <AnimatePresence>
                            {sales.map((sale, index) => (
                                <motion.div
                                    key={sale.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: index * 0.05 }}
                                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                                    className="group bg-gradient-to-br from-white to-purple-50/30 dark:from-gray-800 dark:to-gray-800/50 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-2xl p-6 border border-purple-100/50 dark:border-purple-900/30 transition-all duration-300"
                                >
                                    <div className="flex justify-between items-start gap-6">
                                        <div className="flex-1 space-y-4">
                                            {/* Header Section */}
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                                                            {getCustomerName(sale.customer_id)}
                                                        </h3>
                                                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                                            <span># {sale.id}</span>
                                                            <span>•</span>
                                                            <span>{new Date(sale.created_at).toLocaleDateString('fa-IR')}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <motion.span
                                                    whileHover={{ scale: 1.05 }}
                                                    className="px-4 py-2 bg-gradient-to-r from-green-400 to-emerald-500 text-white text-sm font-bold rounded-xl shadow-md"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                        {new Date(sale.date).toLocaleDateString('fa-IR')}
                                                    </div>
                                                </motion.span>
                                            </div>

                                            {/* Payment Status */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
                                                    <div className="text-xs text-purple-600 dark:text-purple-400 font-bold mb-1">{translations.totalAmount}</div>
                                                    <div className="text-lg font-bold text-purple-700 dark:text-purple-300">
                                                        {sale.total_amount.toLocaleString('fa-IR')}
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800">
                                                    <div className="text-xs text-green-600 dark:text-green-400 font-bold mb-1">{translations.paidAmount}</div>
                                                    <div className="text-lg font-bold text-green-700 dark:text-green-300">
                                                        {sale.paid_amount.toLocaleString('fa-IR')}
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800">
                                                    <div className="text-xs text-red-600 dark:text-red-400 font-bold mb-1">{translations.remainingAmount}</div>
                                                    <div className="text-lg font-bold text-red-700 dark:text-red-300">
                                                        {(sale.total_amount - sale.paid_amount).toLocaleString('fa-IR')}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Notes Section */}
                                            {sale.notes && (
                                                <div className="flex gap-2 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
                                                    <svg className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                                    </svg>
                                                    <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                                                        {sale.notes}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex flex-col gap-2">
                                            <motion.button
                                                whileHover={{ scale: 1.05, x: -2 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => handleViewSale(sale)}
                                                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 font-semibold"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                                مشاهده
                                            </motion.button>
                                            <motion.button
                                                whileHover={{ scale: 1.05, x: -2 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => handleOpenModal(sale)}
                                                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 font-semibold"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                                {translations.edit}
                                            </motion.button>
                                            <motion.button
                                                whileHover={{ scale: 1.05, x: -2 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => setDeleteConfirm(sale.id)}
                                                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 font-semibold"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
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
                                    {editingSale ? translations.edit : translations.addNew}
                                </h2>
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                {translations.customer} <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={formData.customer_id}
                                                onChange={(e) => setFormData({ ...formData, customer_id: parseInt(e.target.value) })}
                                                required
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200"
                                                dir="rtl"
                                            >
                                                <option value={0}>انتخاب مشتری</option>
                                                {customers.map((customer) => (
                                                    <option key={customer.id} value={customer.id}>
                                                        {customer.full_name}
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

                                        <div className="space-y-3 max-h-80 overflow-y-auto">
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
                                                                        {product.name} ({product.stock_quantity?.toLocaleString()})
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

                                        <div className="mt-4 p-4 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-xl space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-lg font-bold text-gray-900 dark:text-white">
                                                    {translations.totalAmount}:
                                                </span>
                                                <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                                    {calculateTotal().toLocaleString('fa-IR')}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                                        {translations.paidAmount}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={formData.paid_amount}
                                                        onChange={(e) => setFormData({ ...formData, paid_amount: parseFloat(e.target.value) || 0 })}
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-lg font-bold focus:outline-none focus:border-purple-500"
                                                        dir="ltr"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                                        {translations.remainingAmount}
                                                    </label>
                                                    <div className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white text-lg font-bold">
                                                        {calculateRemaining().toLocaleString('fa-IR')}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
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

                {/* View Sale Items Modal */}
                <AnimatePresence>
                    {isViewModalOpen && viewingSale && (
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
                                                جزئیات فروش
                                            </h2>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                مشاهده اطلاعات کامل فروش
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => printInvoice(viewingSale)}
                                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl shadow-md transition-all duration-200"
                                            title="چاپ فاکتور"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                            </svg>
                                            {translations.printInvoice}
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

                                {/* Sale Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                                    <motion.div
                                        whileHover={{ scale: 1.02 }}
                                        className="p-5 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl border border-purple-200/50 dark:border-purple-700/30">
                                        <div className="flex items-center gap-3 mb-2">
                                            <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                                {translations.customer}
                                            </label>
                                        </div>
                                        <p className="text-lg font-semibold text-gray-900 dark:text-white mr-8">
                                            {getCustomerName(viewingSale.sale.customer_id)}
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
                                            {new Date(viewingSale.sale.date).toLocaleDateString('fa-IR')}
                                        </p>
                                    </motion.div>
                                    <motion.div
                                        whileHover={{ scale: 1.02 }}
                                        className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl border border-amber-200/50 dark:border-amber-700/30">
                                        <div className="flex items-center gap-3 mb-2">
                                            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                                {translations.totalAmount}
                                            </label>
                                        </div>
                                        <p className="text-lg font-semibold text-gray-900 dark:text-white mr-8">
                                            {viewingSale.sale.total_amount.toLocaleString('fa-IR')}
                                        </p>
                                    </motion.div>
                                    <motion.div
                                        whileHover={{ scale: 1.02 }}
                                        className="p-5 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-2xl border border-red-200/50 dark:border-red-700/30">
                                        <div className="flex items-center gap-3 mb-2">
                                            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                                {translations.remainingAmount}
                                            </label>
                                        </div>
                                        <p className="text-lg font-semibold text-gray-900 dark:text-white mr-8">
                                            {(viewingSale.sale.total_amount - viewingSale.sale.paid_amount).toLocaleString('fa-IR')}
                                        </p>
                                    </motion.div>
                                </div>

                                {/* Items Table */}
                                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-gray-200 dark:border-gray-600 overflow-hidden">
                                    <table className="w-full text-right">
                                        <thead className="bg-gray-100 dark:bg-gray-700">
                                            <tr>
                                                <th className="px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-300">{translations.product}</th>
                                                <th className="px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-300">{translations.unit}</th>
                                                <th className="px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-300">{translations.perPrice}</th>
                                                <th className="px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-300">{translations.amount}</th>
                                                <th className="px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-300">{translations.total}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                                            {viewingSale.items.map((item) => (
                                                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{getProductName(item.product_id)}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{getUnitName(item.unit_id)}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300" dir="ltr">{item.per_price.toLocaleString('fa-IR')}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300" dir="ltr">{item.amount.toLocaleString('fa-IR')}</td>
                                                    <td className="px-6 py-4 text-sm font-bold text-purple-600 dark:text-purple-400" dir="ltr">{item.total.toLocaleString('fa-IR')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </table>
                            </div>

                            {/* Payments Section */}
                            <div className="mt-8">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        {translations.payments.history}
                                    </h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Payments List */}
                                    <div className="md:col-span-2 space-y-3 max-h-60 overflow-y-auto">
                                        {payments.length === 0 ? (
                                            <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
                                                <p className="text-gray-500 dark:text-gray-400">{translations.payments.noPayments}</p>
                                            </div>
                                        ) : (
                                            payments.map((payment) => (
                                                <div key={payment.id} className="flex justify-between items-center p-4 bg-white dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600 shadow-sm">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 font-bold text-sm">
                                                            $
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-gray-900 dark:text-white">
                                                                {payment.amount.toLocaleString('fa-IR')}
                                                            </div>
                                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                                {new Date(payment.date).toLocaleDateString('fa-IR')}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeletePayment(payment.id)}
                                                        className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                        title={translations.delete}
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Add Payment Form */}
                                    <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-200 dark:border-gray-600 h-fit">
                                        <h4 className="font-bold text-gray-900 dark:text-white mb-4 text-sm">{translations.payments.add}</h4>
                                        <form onSubmit={handleAddPayment} className="space-y-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                                    {translations.payments.date}
                                                </label>
                                                <input
                                                    type="date"
                                                    value={newPayment.date}
                                                    onChange={(e) => setNewPayment({ ...newPayment, date: e.target.value })}
                                                    required
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-purple-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                                    {translations.payments.amount}
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={newPayment.amount}
                                                    onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                                                    required
                                                    placeholder="0.00"
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-purple-500"
                                                    dir="ltr"
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="w-full py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-lg text-sm shadow-md transition-all duration-200 flex justify-center items-center gap-2"
                                            >
                                                {loading ? (
                                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <>
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                        </svg>
                                                        {translations.payments.add}
                                                    </>
                                                )}
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>

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
            </div>
        </div>
    );
}
