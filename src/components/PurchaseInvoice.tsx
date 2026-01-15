import { useRef } from "react";
import { PurchaseWithItems } from "../utils/purchase";
import { Supplier } from "../utils/supplier";
import { Product } from "../utils/product";
import { Unit } from "../utils/unit";
import { formatPersianDateLong } from "../utils/date";

interface PurchaseInvoiceProps {
    purchaseData: PurchaseWithItems;
    supplier: Supplier;
    products: Product[];
    units: Unit[];
    onClose?: () => void;
}

export default function PurchaseInvoice({
    purchaseData,
    supplier,
    products,
    units,
    onClose,
}: PurchaseInvoiceProps) {
    const printRef = useRef<HTMLDivElement>(null);

    const formatDate = (dateString: string) => {
        return formatPersianDateLong(dateString);
    };

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat("fa-AF").format(num);
    };

    const getProductName = (productId: number) => {
        const product = products.find((p) => p.id === productId);
        return product?.name || "نامشخص";
    };

    const getUnitName = (unitId: number) => {
        const unit = units.find((u) => u.id === unitId);
        return unit?.name || "نامشخص";
    };

    const handlePrint = () => {
        if (printRef.current) {
            const printWindow = window.open("", "_blank");
            if (printWindow) {
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html dir="rtl" lang="fa">
                    <head>
                        <meta charset="UTF-8">
                        <title>فاکتور خرید #${purchaseData.purchase.id}</title>
                        <style>
                            ${getPrintStyles()}
                        </style>
                    </head>
                    <body>
                        ${printRef.current.innerHTML}
                    </body>
                    </html>
                `);
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 250);
            }
        }
    };

    const getPrintStyles = () => {
        return `
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                direction: rtl;
                padding: 20px;
                background: white;
                color: #1a1a1a;
            }
            .invoice-container {
                max-width: 800px;
                margin: 0 auto;
                background: white;
                padding: 40px;
                box-shadow: 0 0 20px rgba(0,0,0,0.1);
            }
            .invoice-header {
                border-bottom: 3px solid #059669;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            .invoice-title {
                font-size: 32px;
                font-weight: bold;
                color: #059669;
                margin-bottom: 10px;
            }
            .invoice-number {
                font-size: 18px;
                color: #64748b;
            }
            .info-section {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 30px;
                margin-bottom: 30px;
            }
            .info-box {
                background: #f0fdf4;
                padding: 20px;
                border-radius: 8px;
                border-right: 4px solid #059669;
            }
            .info-title {
                font-size: 14px;
                color: #64748b;
                margin-bottom: 8px;
                font-weight: 600;
            }
            .info-value {
                font-size: 16px;
                color: #1a1a1a;
                font-weight: 500;
            }
            .items-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
            }
            .items-table thead {
                background: #059669;
                color: white;
            }
            .items-table th {
                padding: 15px;
                text-align: right;
                font-weight: 600;
                font-size: 14px;
            }
            .items-table td {
                padding: 15px;
                border-bottom: 1px solid #e2e8f0;
            }
            .items-table tbody tr:hover {
                background: #f0fdf4;
            }
            .total-section {
                margin-top: 20px;
                padding-top: 20px;
                border-top: 2px solid #e2e8f0;
            }
            .total-row {
                display: flex;
                justify-content: space-between;
                padding: 12px 0;
                font-size: 16px;
            }
            .total-label {
                color: #64748b;
                font-weight: 600;
            }
            .total-value {
                color: #1a1a1a;
                font-weight: 700;
                font-size: 18px;
            }
            .grand-total {
                background: #059669;
                color: white;
                padding: 20px;
                border-radius: 8px;
                margin-top: 20px;
            }
            .grand-total .total-label,
            .grand-total .total-value {
                color: white;
                font-size: 20px;
            }
            .notes-section {
                margin-top: 30px;
                padding: 20px;
                background: #f0fdf4;
                border-radius: 8px;
                border-right: 4px solid #059669;
            }
            .notes-title {
                font-size: 16px;
                font-weight: 600;
                color: #059669;
                margin-bottom: 10px;
            }
            .notes-text {
                color: #64748b;
                line-height: 1.6;
            }
            @media print {
                body {
                    padding: 0;
                }
                .invoice-container {
                    box-shadow: none;
                    padding: 20px;
                }
                .no-print {
                    display: none;
                }
            }
        `;
    };

    return (
        <>
            <style>{`
                .invoice-container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: white;
                    padding: 40px;
                    direction: rtl;
                }
                .invoice-header {
                    border-bottom: 3px solid #059669;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .invoice-title {
                    font-size: 32px;
                    font-weight: bold;
                    color: #059669;
                    margin-bottom: 10px;
                }
                .invoice-number {
                    font-size: 18px;
                    color: #64748b;
                }
                .info-section {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 30px;
                    margin-bottom: 30px;
                }
                .info-box {
                    background: #f0fdf4;
                    padding: 20px;
                    border-radius: 8px;
                    border-right: 4px solid #059669;
                }
                .info-title {
                    font-size: 14px;
                    color: #64748b;
                    margin-bottom: 8px;
                    font-weight: 600;
                }
                .info-value {
                    font-size: 16px;
                    color: #1a1a1a;
                    font-weight: 500;
                }
                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 30px;
                }
                .items-table thead {
                    background: #059669;
                    color: white;
                }
                .items-table th {
                    padding: 15px;
                    text-align: right;
                    font-weight: 600;
                    font-size: 14px;
                }
                .items-table td {
                    padding: 15px;
                    border-bottom: 1px solid #e2e8f0;
                }
                .items-table tbody tr:hover {
                    background: #f0fdf4;
                }
                .total-section {
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 2px solid #e2e8f0;
                }
                .total-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 12px 0;
                    font-size: 16px;
                }
                .total-label {
                    color: #64748b;
                    font-weight: 600;
                }
                .total-value {
                    color: #1a1a1a;
                    font-weight: 700;
                    font-size: 18px;
                }
                .grand-total {
                    background: #059669;
                    color: white;
                    padding: 20px;
                    border-radius: 8px;
                    margin-top: 20px;
                }
                .grand-total .total-label,
                .grand-total .total-value {
                    color: white;
                    font-size: 20px;
                }
                .notes-section {
                    margin-top: 30px;
                    padding: 20px;
                    background: #f0fdf4;
                    border-radius: 8px;
                    border-right: 4px solid #059669;
                }
                .notes-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #059669;
                    margin-bottom: 10px;
                }
                .notes-text {
                    color: #64748b;
                    line-height: 1.6;
                }
            `}</style>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                    <div ref={printRef} className="invoice-container">
                    {/* Header */}
                    <div className="invoice-header">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h1 className="invoice-title">فاکتور خرید</h1>
                                <p className="invoice-number">
                                    شماره فاکتور: #{purchaseData.purchase.id}
                                </p>
                            </div>
                            <div className="text-left">
                                <div className="text-sm text-gray-500 mb-1">تاریخ:</div>
                                <div className="text-lg font-semibold">
                                    {formatDate(purchaseData.purchase.date)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Info Section */}
                    <div className="info-section">
                        <div className="info-box">
                            <div className="info-title">اطلاعات تمویل کننده</div>
                            <div className="info-value">{supplier.full_name}</div>
                            <div className="text-sm text-gray-600 mt-2">
                                <div>تلفن: {supplier.phone}</div>
                                <div className="mt-1">آدرس: {supplier.address}</div>
                                {supplier.email && (
                                    <div className="mt-1">ایمیل: {supplier.email}</div>
                                )}
                            </div>
                        </div>
                        <div className="info-box">
                            <div className="info-title">اطلاعات خرید</div>
                            <div className="text-sm text-gray-600 space-y-1">
                                <div>شماره فاکتور: <span className="font-semibold">#{purchaseData.purchase.id}</span></div>
                                <div>تاریخ: <span className="font-semibold">{formatDate(purchaseData.purchase.date)}</span></div>
                                <div>وضعیت: <span className="font-semibold text-green-600">تکمیل شده</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <table className="items-table">
                        <thead>
                            <tr>
                                <th style={{ width: "5%" }}>#</th>
                                <th style={{ width: "30%" }}>محصول</th>
                                <th style={{ width: "15%" }}>واحد</th>
                                <th style={{ width: "12%" }}>مقدار</th>
                                <th style={{ width: "15%" }}>قیمت واحد</th>
                                <th style={{ width: "15%" }}>جمع</th>
                            </tr>
                        </thead>
                        <tbody>
                            {purchaseData.items.map((item, index) => (
                                <tr key={item.id}>
                                    <td className="text-center">{index + 1}</td>
                                    <td className="font-medium">{getProductName(item.product_id)}</td>
                                    <td className="text-center">{getUnitName(item.unit_id)}</td>
                                    <td className="text-center">{formatNumber(item.amount)}</td>
                                    <td className="text-left">{formatNumber(item.per_price)}</td>
                                    <td className="text-left font-semibold">{formatNumber(item.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Totals */}
                    <div className="total-section">
                        <div className="grand-total">
                            <div className="total-row">
                                <span className="total-label">مبلغ کل:</span>
                                <span className="total-value">{formatNumber(purchaseData.purchase.total_amount)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    {purchaseData.purchase.notes && (
                        <div className="notes-section">
                            <div className="notes-title">یادداشت‌ها:</div>
                            <div className="notes-text">{purchaseData.purchase.notes}</div>
                        </div>
                    )}
                    </div>

                    {/* Action Buttons */}
                    <div className="no-print flex justify-end gap-4 p-6 border-t bg-gray-50">
                        <button
                            onClick={handlePrint}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                        >
                            چاپ فاکتور
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-semibold"
                            >
                                بستن
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
