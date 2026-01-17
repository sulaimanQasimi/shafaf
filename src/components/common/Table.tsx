import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface Column<T> {
    key: keyof T | string;
    label: string;
    sortable?: boolean;
    render?: (item: T) => React.ReactNode;
    className?: string; // For custom width or alignment
}

interface TableProps<T> {
    data: T[];
    columns: Column<T>[];
    total: number;
    page: number;
    perPage: number;
    onPageChange: (page: number) => void;
    onPerPageChange: (perPage: number) => void;
    onSort?: (key: string, direction: "asc" | "desc") => void;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    loading?: boolean;
    actions?: (item: T) => React.ReactNode;
}

export default function Table<T extends { id: number | string }>({
    data,
    columns,
    total,
    page,
    perPage,
    onPageChange,
    onPerPageChange,
    onSort,
    sortBy,
    sortOrder,
    loading,
    actions,
}: TableProps<T>) {
    const totalPages = Math.ceil(total / perPage);

    const handleSort = (key: string) => {
        if (!onSort) return;
        if (sortBy === key) {
            onSort(key, sortOrder === "asc" ? "desc" : "asc");
        } else {
            onSort(key, "asc");
        }
    };

    return (
        <div className="w-full space-y-4">
            <div className="overflow-x-auto rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50/50 dark:bg-gray-900/30 border-b border-gray-100 dark:border-gray-700/50">
                            {columns.map((col, idx) => (
                                <th
                                    key={idx}
                                    className={`px-6 py-4 text-right text-sm font-semibold text-gray-600 dark:text-gray-300 ${col.sortable ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors" : ""
                                        } ${col.className || ""}`}
                                    onClick={() => col.sortable && handleSort(col.key as string)}
                                >
                                    <div className="flex items-center gap-2">
                                        {col.label}
                                        {col.sortable && sortBy === col.key && (
                                            <span className="text-purple-600 dark:text-purple-400">
                                                {sortOrder === "asc" ? (
                                                    <ChevronUp className="w-4 h-4" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4" />
                                                )}
                                            </span>
                                        )}
                                        {col.sortable && sortBy !== col.key && (
                                            <span className="text-gray-400 opacity-0 group-hover:opacity-50">
                                                <ChevronDown className="w-4 h-4" />
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                            {actions && <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600 dark:text-gray-300">عملیات</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/30">
                        {loading ? (
                            <tr>
                                <td colSpan={columns.length + (actions ? 1 : 0)} className="py-20 text-center">
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                        className="w-8 h-8 mx-auto border-2 border-purple-600 border-t-transparent rounded-full"
                                    />
                                </td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length + (actions ? 1 : 0)} className="py-20 text-center text-gray-500 dark:text-gray-400">
                                    هیچ داده‌ای یافت نشد
                                </td>
                            </tr>
                        ) : (
                            <AnimatePresence>
                                {data.map((item, index) => (
                                    <motion.tr
                                        key={item.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="group hover:bg-purple-50/50 dark:hover:bg-gray-700/30 transition-colors"
                                    >
                                        {columns.map((col, idx) => (
                                            <td key={idx} className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                                                {col.render ? col.render(item) : (item[col.key as keyof T] as React.ReactNode)}
                                            </td>
                                        ))}
                                        {actions && (
                                            <td className="px-6 py-4">
                                                {actions(item)}
                                            </td>
                                        )}
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {total > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span>نمایش</span>
                        <select
                            value={perPage}
                            onChange={(e) => onPerPageChange(Number(e.target.value))}
                            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                        <span>مورد از {total}</span>
                    </div>

                    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => onPageChange(1)}
                            disabled={page === 1}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-600 dark:text-gray-300"
                        >
                            <ChevronsRight className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => onPageChange(page - 1)}
                            disabled={page === 1}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-600 dark:text-gray-300"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-1 px-2">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let p = page;
                                if (page < 3) p = i + 1;
                                else if (page > totalPages - 2) p = totalPages - 4 + i;
                                else p = page - 2 + i;

                                if (p < 1) p = 1;
                                if (p > totalPages) return null;

                                return (
                                    <button
                                        key={p}
                                        onClick={() => onPageChange(p)}
                                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${page === p
                                                ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
                                                : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                                            }`}
                                    >
                                        {p}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => onPageChange(page + 1)}
                            disabled={page === totalPages}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-600 dark:text-gray-300"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => onPageChange(totalPages)}
                            disabled={page === totalPages}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-600 dark:text-gray-300"
                        >
                            <ChevronsLeft className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
