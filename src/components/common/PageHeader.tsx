import { motion } from "framer-motion";
import { ReactNode } from "react";

export interface ActionButton {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
    className?: string;
    variant?: "primary" | "secondary" | "danger" | "warning";
}

interface PageHeaderProps {
    title: string;
    onBack?: () => void;
    backLabel?: string;
    actions?: ActionButton[];
    children?: ReactNode;
}

const variantStyles = {
    primary: "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700",
    secondary: "bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700",
    danger: "bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600",
    warning: "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600",
};

export default function PageHeader({ 
    title, 
    onBack, 
    backLabel = "بازگشت به داشبورد",
    actions = [],
    children 
}: PageHeaderProps) {
    return (
        <>
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
                            {backLabel}
                        </span>
                    </motion.button>
                </motion.div>
            )}

            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 space-y-6"
            >
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                        {title}
                    </h1>
                    {(actions.length > 0 || children) && (
                        <div className="flex gap-3 flex-wrap">
                            {actions.map((action, index) => (
                                <motion.button
                                    key={index}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={action.onClick}
                                    className={`px-6 py-3 ${action.variant ? variantStyles[action.variant] : variantStyles.primary} text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 ${action.className || ""}`}
                                >
                                    {action.icon}
                                    {action.label}
                                </motion.button>
                            ))}
                            {children}
                        </div>
                    )}
                </div>
            </motion.div>
        </>
    );
}
