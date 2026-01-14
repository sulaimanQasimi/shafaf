import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
    initSalariesTable,
    createSalary,
    getSalaries,
    getSalariesByEmployee,
    getSalary,
    updateSalary,
    deleteSalary,
    type Salary,
} from "../utils/salary";
import { getEmployees, type Employee } from "../utils/employee";
import { isDatabaseOpen, openDatabase } from "../utils/db";

// Dari month names
const dariMonths = [
    "حمل", "ثور", "جوزا", "سرطان", "اسد", "سنبله",
    "میزان", "عقرب", "قوس", "جدی", "دلو", "حوت"
];

// Dari translations
const translations = {
    title: "مدیریت معاشات",
    addNew: "ثبت معاش جدید",
    edit: "ویرایش",
    delete: "حذف",
    cancel: "لغو",
    save: "ذخیره",
    employee: "کارمند",
    year: "سال",
    month: "ماه",
    amount: "مقدار",
    notes: "یادداشت",
    actions: "عملیات",
    createdAt: "تاریخ ایجاد",
    updatedAt: "آخرین بروزرسانی",
    noSalaries: "هیچ معاشی ثبت نشده است",
    confirmDelete: "آیا از حذف این معاش اطمینان دارید؟",
    backToDashboard: "بازگشت به داشبورد",
    success: {
        created: "معاش با موفقیت ثبت شد",
        updated: "معاش با موفقیت بروزرسانی شد",
        deleted: "معاش با موفقیت حذف شد",
    },
    errors: {
        create: "خطا در ثبت معاش",
        update: "خطا در بروزرسانی معاش",
        delete: "خطا در حذف معاش",
        fetch: "خطا در دریافت لیست معاشات",
        employeeRequired: "انتخاب کارمند الزامی است",
        yearRequired: "سال الزامی است",
        monthRequired: "ماه الزامی است",
        amountRequired: "مقدار معاش الزامی است",
    },
    placeholders: {
        employee: "کارمند را انتخاب کنید",
        year: "سال را وارد کنید",
        amount: "مقدار معاش را وارد کنید",
        notes: "یادداشت را وارد کنید",
    },
};

interface SalaryManagementProps {
    onBack?: () => void;
}

export default function SalaryManagement({ onBack }: SalaryManagementProps) {
    const [salaries, setSalaries] = useState<Salary[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSalary, setEditingSalary] = useState<Salary | null>(null);
    const [formData, setFormData] = useState({
        employee_id: "",
        year: new Date().getFullYear().toString(),
        month: "",
        amount: "",
        notes: "",
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
                await initSalariesTable();
            } catch (err) {
                console.log("Table initialization:", err);
            }

            const [salariesData, employeesData] = await Promise.all([
                getSalaries(),
                getEmployees(),
            ]);

            setSalaries(salariesData);
            setEmployees(employeesData);
        } catch (error: any) {
            toast.error(translations.errors.fetch);
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (salary?: Salary) => {
        if (salary) {
            setEditingSalary(salary);
            setFormData({
                employee_id: salary.employee_id.toString(),
                year: salary.year.toString(),
                month: salary.month,
                amount: salary.amount.toString(),
                notes: salary.notes || "",
            });
        } else {
            setEditingSalary(null);
            setFormData({
                employee_id: "",
                year: new Date().getFullYear().toString(),
                month: "",
                amount: "",
                notes: "",
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingSalary(null);
        setFormData({
            employee_id: "",
            year: new Date().getFullYear().toString(),
            month: "",
            amount: "",
            notes: "",
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.employee_id) {
            toast.error(translations.errors.employeeRequired);
            return;
        }

        if (!formData.year || parseInt(formData.year) <= 0) {
            toast.error(translations.errors.yearRequired);
            return;
        }

        if (!formData.month) {
            toast.error(translations.errors.monthRequired);
            return;
        }

        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            toast.error(translations.errors.amountRequired);
            return;
        }

        try {
            setLoading(true);
            if (editingSalary) {
                await updateSalary(
                    editingSalary.id,
                    parseInt(formData.employee_id),
                    parseInt(formData.year),
                    formData.month,
                    parseFloat(formData.amount),
                    formData.notes || null
                );
                toast.success(translations.success.updated);
            } else {
                await createSalary(
                    parseInt(formData.employee_id),
                    parseInt(formData.year),
                    formData.month,
                    parseFloat(formData.amount),
                    formData.notes || null
                );
                toast.success(translations.success.created);
            }
            handleCloseModal();
            await loadData();
        } catch (error: any) {
            toast.error(editingSalary ? translations.errors.update : translations.errors.create);
            console.error("Error saving salary:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            setLoading(true);
            await deleteSalary(id);
            toast.success(translations.success.deleted);
            setDeleteConfirm(null);
            await loadData();
        } catch (error: any) {
            toast.error(translations.errors.delete);
            console.error("Error deleting salary:", error);
        } finally {
            setLoading(false);
        }
    };

    const getEmployeeName = (employeeId: number) => {
        const employee = employees.find((e) => e.id === employeeId);
        return employee ? employee.full_name : `کارمند #${employeeId}`;
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

                {loading && salaries.length === 0 ? (
                    <div className="flex justify-center items-center h-64">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full"
                        />
                    </div>
                ) : salaries.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-16 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-3xl shadow-lg"
                    >
                        <svg className="w-24 h-24 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xl text-gray-600 dark:text-gray-400">{translations.noSalaries}</p>
                    </motion.div>
                ) : (
                    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-3xl shadow-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                                    <tr>
                                        <th className="px-6 py-4 text-right font-bold">کارمند</th>
                                        <th className="px-6 py-4 text-right font-bold">سال</th>
                                        <th className="px-6 py-4 text-right font-bold">ماه</th>
                                        <th className="px-6 py-4 text-right font-bold">مقدار</th>
                                        <th className="px-6 py-4 text-right font-bold">یادداشت</th>
                                        <th className="px-6 py-4 text-right font-bold">{translations.actions}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence>
                                        {salaries.map((salary) => (
                                            <motion.tr
                                                key={salary.id}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -20 }}
                                                className="border-b border-gray-200 dark:border-gray-700 hover:bg-purple-50 dark:hover:bg-gray-700/50 transition-colors"
                                            >
                                                <td className="px-6 py-4 text-gray-900 dark:text-white font-semibold">
                                                    {getEmployeeName(salary.employee_id)}
                                                </td>
                                                <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                                                    {salary.year}
                                                </td>
                                                <td className="px-6 py-4 text-gray-700 dark:text-gray-300 font-semibold">
                                                    {salary.month}
                                                </td>
                                                <td className="px-6 py-4 text-gray-900 dark:text-white font-bold">
                                                    {salary.amount.toLocaleString()} افغانی
                                                </td>
                                                <td className="px-6 py-4 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                                                    {salary.notes || "-"}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex gap-2">
                                                        <motion.button
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => handleOpenModal(salary)}
                                                            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 font-semibold text-sm"
                                                        >
                                                            {translations.edit}
                                                        </motion.button>
                                                        <motion.button
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => setDeleteConfirm(salary.id)}
                                                            className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 font-semibold text-sm"
                                                        >
                                                            {translations.delete}
                                                        </motion.button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>
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
                                    {editingSalary ? translations.edit : translations.addNew}
                                </h2>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                            {translations.employee} <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={formData.employee_id}
                                            onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                                            required
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200"
                                            dir="rtl"
                                        >
                                            <option value="">{translations.placeholders.employee}</option>
                                            {employees.map((employee) => (
                                                <option key={employee.id} value={employee.id}>
                                                    {employee.full_name} {employee.position ? `(${employee.position})` : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                {translations.year} <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.year}
                                                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                                                required
                                                min="1300"
                                                max="1500"
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200"
                                                placeholder={translations.placeholders.year}
                                                dir="ltr"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                {translations.month} <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={formData.month}
                                                onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                                                required
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200"
                                                dir="rtl"
                                            >
                                                <option value="">انتخاب ماه</option>
                                                {dariMonths.map((month) => (
                                                    <option key={month} value={month}>
                                                        {month}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                            {translations.amount} <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.amount}
                                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                            required
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200"
                                            placeholder={translations.placeholders.amount}
                                            dir="ltr"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                            {translations.notes}
                                        </label>
                                        <textarea
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            rows={3}
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-200"
                                            placeholder={translations.placeholders.notes}
                                            dir="rtl"
                                        />
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
                                <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-3">
                                    {translations.delete}
                                </h2>
                                <p className="text-center text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                                    {translations.confirmDelete}
                                </p>
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
