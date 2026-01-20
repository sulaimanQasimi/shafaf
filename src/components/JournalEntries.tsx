import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
    initJournalEntriesTable,
    initJournalEntryLinesTable,
    createJournalEntry,
    getJournalEntries,
    getJournalEntry,
    validateJournalEntry,
    type JournalEntry,
    type JournalEntryLine,
    type JournalEntryLineInput,
} from "../utils/journal";
import { getAccounts, type Account } from "../utils/account";
import { getCurrencies, type Currency } from "../utils/currency";
import { isDatabaseOpen, openDatabase } from "../utils/db";
import Footer from "./Footer";
import PersianDatePicker from "./PersianDatePicker";
import { formatPersianDate, getCurrentPersianDate, persianToGeorgian } from "../utils/date";
import PageHeader from "./common/PageHeader";

const translations = {
    title: "دفتر روزنامه",
    addNew: "ایجاد سند جدید",
    edit: "ویرایش",
    delete: "حذف",
    cancel: "لغو",
    save: "ذخیره",
    entryNumber: "شماره سند",
    entryDate: "تاریخ سند",
    description: "شرح",
    account: "حساب",
    currency: "ارز",
    debit: "بدهکار",
    credit: "بستانکار",
    exchangeRate: "نرخ ارز",
    baseAmount: "مبلغ پایه",
    addLine: "افزودن خط",
    removeLine: "حذف",
    backToDashboard: "بازگشت به داشبورد",
    success: {
        created: "سند با موفقیت ایجاد شد",
    },
    errors: {
        create: "خطا در ایجاد سند",
        fetch: "خطا در دریافت لیست اسناد",
        notBalanced: "سند متعادل نیست. مجموع بدهکار باید برابر مجموع بستانکار باشد",
        accountRequired: "انتخاب حساب الزامی است",
        dateRequired: "تاریخ الزامی است",
    },
};

interface JournalEntriesProps {
    onBack?: () => void;
}

export default function JournalEntries({ onBack }: JournalEntriesProps) {
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [currencies, setCurrencies] = useState<Currency[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewingEntry, setViewingEntry] = useState<[JournalEntry, JournalEntryLine[]] | null>(null);
    const [page, setPage] = useState(1);
    const [perPage] = useState(10);
    const [totalItems, setTotalItems] = useState(0);
    const [formData, setFormData] = useState({
        entry_date: persianToGeorgian(getCurrentPersianDate()) || new Date().toISOString().split('T')[0],
        description: "",
        lines: [] as JournalEntryLineInput[],
    });

    useEffect(() => {
        loadData();
    }, [page, perPage]);

    const loadData = async () => {
        try {
            setLoading(true);
            const dbOpen = await isDatabaseOpen();
            if (!dbOpen) {
                await openDatabase("db");
            }

            try {
                await initJournalEntriesTable();
                await initJournalEntryLinesTable();
            } catch (err) {
                console.log("Table initialization:", err);
            }

            const [entriesData, accountsData, currenciesData] = await Promise.all([
                getJournalEntries(page, perPage),
                getAccounts(),
                getCurrencies(),
            ]);

            setEntries(entriesData.items);
            setTotalItems(entriesData.total);
            setAccounts(accountsData);
            setCurrencies(currenciesData);
        } catch (error: any) {
            toast.error(translations.errors.fetch);
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewEntry = async (id: number) => {
        try {
            const entryData = await getJournalEntry(id);
            setViewingEntry(entryData);
            setIsViewModalOpen(true);
        } catch (error: any) {
            toast.error("خطا در دریافت جزئیات سند");
            console.error("Error loading entry:", error);
        }
    };

    const addLine = () => {
        setFormData({
            ...formData,
            lines: [
                ...formData.lines,
                {
                    account_id: 0,
                    currency_id: currencies[0]?.id || 0,
                    debit_amount: 0,
                    credit_amount: 0,
                    exchange_rate: 1,
                    description: null,
                },
            ],
        });
    };

    const removeLine = (index: number) => {
        setFormData({
            ...formData,
            lines: formData.lines.filter((_, i) => i !== index),
        });
    };

    const updateLine = (index: number, field: keyof JournalEntryLineInput, value: any) => {
        const newLines = [...formData.lines];
        newLines[index] = { ...newLines[index], [field]: value };
        setFormData({ ...formData, lines: newLines });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.entry_date) {
            toast.error(translations.errors.dateRequired);
            return;
        }

        if (formData.lines.length === 0) {
            toast.error("حداقل یک خط الزامی است");
            return;
        }

        // Validate all lines
        for (let i = 0; i < formData.lines.length; i++) {
            const line = formData.lines[i];
            if (!line.account_id || !line.currency_id) {
                toast.error(`خط ${i + 1} ناقص است`);
                return;
            }
            if (line.debit_amount === 0 && line.credit_amount === 0) {
                toast.error(`خط ${i + 1}: باید بدهکار یا بستانکار داشته باشد`);
                return;
            }
            if (line.debit_amount > 0 && line.credit_amount > 0) {
                toast.error(`خط ${i + 1}: نمی‌تواند هم بدهکار و هم بستانکار باشد`);
                return;
            }
        }

        if (!validateJournalEntry(formData.lines)) {
            toast.error(translations.errors.notBalanced);
            return;
        }

        try {
            setLoading(true);
            await createJournalEntry(
                formData.entry_date,
                formData.description || null,
                "manual",
                null,
                formData.lines
            );
            toast.success(translations.success.created);
            setIsModalOpen(false);
            setFormData({
                entry_date: persianToGeorgian(getCurrentPersianDate()) || new Date().toISOString().split('T')[0],
                description: "",
                lines: [],
            });
            await loadData();
        } catch (error: any) {
            toast.error(translations.errors.create);
            console.error("Error creating entry:", error);
        } finally {
            setLoading(false);
        }
    };

    const calculateTotalDebits = () => {
        return formData.lines.reduce((sum, line) => sum + line.debit_amount, 0);
    };

    const calculateTotalCredits = () => {
        return formData.lines.reduce((sum, line) => sum + line.credit_amount, 0);
    };

    const getAccountName = (accountId: number) => {
        return accounts.find(a => a.id === accountId)?.name || `ID: ${accountId}`;
    };

    const getCurrencyName = (currencyId: number) => {
        return currencies.find(c => c.id === currencyId)?.name || `ID: ${currencyId}`;
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
                            onClick: () => setIsModalOpen(true),
                            variant: "primary" as const
                        }
                    ]}
                />

                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-lg p-6">
                    {loading && entries.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            هیچ سندی ثبت نشده است
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {entries.map((entry) => (
                                <motion.div
                                    key={entry.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:border-purple-500 dark:hover:border-purple-700 transition-all"
                                    onClick={() => handleViewEntry(entry.id)}
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-gray-900 dark:text-white">
                                                {entry.entry_number}
                                            </div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                                {formatPersianDate(entry.entry_date)}
                                            </div>
                                            {entry.description && (
                                                <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                                                    {entry.description}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                            {entry.reference_type && (
                                                <span className="px-2 py-1 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                                    {entry.reference_type}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {totalItems > perPage && (
                        <div className="flex justify-between items-center mt-6">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                صفحه {page} از {Math.ceil(totalItems / perPage)}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg disabled:opacity-50"
                                >
                                    قبلی
                                </button>
                                <button
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={page >= Math.ceil(totalItems / perPage)}
                                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg disabled:opacity-50"
                                >
                                    بعدی
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Create Entry Modal */}
                <AnimatePresence>
                    {isModalOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
                            onClick={() => setIsModalOpen(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 w-full max-w-5xl max-h-[90vh] overflow-y-auto my-8"
                            >
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                                    {translations.addNew}
                                </h2>
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                {translations.entryDate} <span className="text-red-500">*</span>
                                            </label>
                                            <PersianDatePicker
                                                value={formData.entry_date}
                                                onChange={(date) => setFormData({ ...formData, entry_date: date })}
                                                placeholder="تاریخ را انتخاب کنید"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                {translations.description}
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.description}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200"
                                                placeholder="شرح سند"
                                                dir="rtl"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-4">
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                خطوط سند <span className="text-red-500">*</span>
                                            </label>
                                            <motion.button
                                                type="button"
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={addLine}
                                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                                            >
                                                {translations.addLine}
                                            </motion.button>
                                        </div>

                                        <div className="space-y-3 max-h-96 overflow-y-auto">
                                            {formData.lines.map((line, index) => (
                                                <motion.div
                                                    key={index}
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-gray-200 dark:border-gray-600"
                                                >
                                                    <div className="grid grid-cols-12 gap-3 items-end">
                                                        <div className="col-span-3">
                                                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                                                {translations.account}
                                                            </label>
                                                            <select
                                                                value={line.account_id}
                                                                onChange={(e) => updateLine(index, 'account_id', parseInt(e.target.value))}
                                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-purple-500"
                                                                dir="rtl"
                                                            >
                                                                <option value={0}>انتخاب حساب</option>
                                                                {accounts.map((account) => (
                                                                    <option key={account.id} value={account.id}>
                                                                        {account.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="col-span-2">
                                                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                                                {translations.currency}
                                                            </label>
                                                            <select
                                                                value={line.currency_id}
                                                                onChange={(e) => updateLine(index, 'currency_id', parseInt(e.target.value))}
                                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-purple-500"
                                                                dir="rtl"
                                                            >
                                                                {currencies.map((currency) => (
                                                                    <option key={currency.id} value={currency.id}>
                                                                        {currency.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="col-span-2">
                                                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                                                {translations.debit}
                                                            </label>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={line.debit_amount || ''}
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value) || 0;
                                                                    updateLine(index, 'debit_amount', val);
                                                                    if (val > 0) {
                                                                        updateLine(index, 'credit_amount', 0);
                                                                    }
                                                                }}
                                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-purple-500"
                                                                dir="ltr"
                                                            />
                                                        </div>
                                                        <div className="col-span-2">
                                                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                                                {translations.credit}
                                                            </label>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={line.credit_amount || ''}
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value) || 0;
                                                                    updateLine(index, 'credit_amount', val);
                                                                    if (val > 0) {
                                                                        updateLine(index, 'debit_amount', 0);
                                                                    }
                                                                }}
                                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-purple-500"
                                                                dir="ltr"
                                                            />
                                                        </div>
                                                        <div className="col-span-2">
                                                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                                                {translations.exchangeRate}
                                                            </label>
                                                            <input
                                                                type="number"
                                                                step="0.0001"
                                                                value={line.exchange_rate}
                                                                onChange={(e) => updateLine(index, 'exchange_rate', parseFloat(e.target.value) || 1)}
                                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-purple-500"
                                                                dir="ltr"
                                                            />
                                                        </div>
                                                        <div className="col-span-1">
                                                            <motion.button
                                                                type="button"
                                                                whileHover={{ scale: 1.1 }}
                                                                whileTap={{ scale: 0.9 }}
                                                                onClick={() => removeLine(index)}
                                                                className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
                                                            >
                                                                {translations.removeLine}
                                                            </motion.button>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>

                                        {formData.lines.length > 0 && (
                                            <div className="mt-4 p-4 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-xl">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-gray-900 dark:text-white">
                                                        مجموع بدهکار:
                                                    </span>
                                                    <span className={`font-bold text-lg ${
                                                        Math.abs(calculateTotalDebits() - calculateTotalCredits()) < 0.01
                                                            ? "text-green-600 dark:text-green-400"
                                                            : "text-red-600 dark:text-red-400"
                                                    }`}>
                                                        {calculateTotalDebits().toLocaleString('en-US')}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center mt-2">
                                                    <span className="font-bold text-gray-900 dark:text-white">
                                                        مجموع بستانکار:
                                                    </span>
                                                    <span className={`font-bold text-lg ${
                                                        Math.abs(calculateTotalDebits() - calculateTotalCredits()) < 0.01
                                                            ? "text-green-600 dark:text-green-400"
                                                            : "text-red-600 dark:text-red-400"
                                                    }`}>
                                                        {calculateTotalCredits().toLocaleString('en-US')}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center mt-2">
                                                    <span className="font-bold text-gray-900 dark:text-white">
                                                        تفاوت:
                                                    </span>
                                                    <span className={`font-bold text-lg ${
                                                        Math.abs(calculateTotalDebits() - calculateTotalCredits()) < 0.01
                                                            ? "text-green-600 dark:text-green-400"
                                                            : "text-red-600 dark:text-red-400"
                                                    }`}>
                                                        {Math.abs(calculateTotalDebits() - calculateTotalCredits()).toLocaleString('en-US')}
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
                                            onClick={() => setIsModalOpen(false)}
                                            className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-bold rounded-xl transition-colors"
                                        >
                                            {translations.cancel}
                                        </motion.button>
                                        <motion.button
                                            type="submit"
                                            disabled={loading || !validateJournalEntry(formData.lines)}
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

                {/* View Entry Modal */}
                <AnimatePresence>
                    {isViewModalOpen && viewingEntry && (
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
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {viewingEntry[0].entry_number}
                                    </h2>
                                    <button
                                        onClick={() => setIsViewModalOpen(false)}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="mb-6 space-y-2">
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                        تاریخ: {formatPersianDate(viewingEntry[0].entry_date)}
                                    </div>
                                    {viewingEntry[0].description && (
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                            شرح: {viewingEntry[0].description}
                                        </div>
                                    )}
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-right">
                                        <thead className="bg-gray-100 dark:bg-gray-700">
                                            <tr>
                                                <th className="px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-300">حساب</th>
                                                <th className="px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-300">ارز</th>
                                                <th className="px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-300">بدهکار</th>
                                                <th className="px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-300">بستانکار</th>
                                                <th className="px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-300">نرخ</th>
                                                <th className="px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-300">مبلغ پایه</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                                            {viewingEntry[1].map((line) => (
                                                <tr key={line.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                                                        {getAccountName(line.account_id)}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                                                        {getCurrencyName(line.currency_id)}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300" dir="ltr">
                                                        {line.debit_amount > 0 ? line.debit_amount.toLocaleString('en-US') : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300" dir="ltr">
                                                        {line.credit_amount > 0 ? line.credit_amount.toLocaleString('en-US') : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300" dir="ltr">
                                                        {line.exchange_rate.toLocaleString('en-US')}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300" dir="ltr">
                                                        {line.base_amount.toLocaleString('en-US')}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-gray-100 dark:bg-gray-700">
                                            <tr>
                                                <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">
                                                    مجموع:
                                                </td>
                                                <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white" dir="ltr">
                                                    {viewingEntry[1].reduce((sum, line) => sum + line.debit_amount, 0).toLocaleString('en-US')}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white" dir="ltr">
                                                    {viewingEntry[1].reduce((sum, line) => sum + line.credit_amount, 0).toLocaleString('en-US')}
                                                </td>
                                                <td colSpan={2}></td>
                                            </tr>
                                        </tfoot>
                                    </table>
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
