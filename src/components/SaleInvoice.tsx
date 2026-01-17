import { useRef, useEffect } from "react";
import { SaleWithItems, SalePayment } from "../utils/sales";
import { Customer } from "../utils/customer";
import { Product } from "../utils/product";
import { Unit } from "../utils/unit";
import { formatPersianDateLong } from "../utils/date";

interface SaleInvoiceProps {
    saleData: SaleWithItems;
    customer: Customer;
    products: Product[];
    units: Unit[];
    payments?: SalePayment[];
    onClose?: () => void;
}

export default function SaleInvoice({
    saleData,
    customer,
    products,
    units,
    payments = [],
    onClose,
}: SaleInvoiceProps) {
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

    const getPrintStyles = () => {
        return `
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            @page {
                size: A4;
                margin: 10mm;
            }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                direction: rtl;
                padding: 5mm;
                background: white;
                color: #1a1a1a;
                font-size: 10pt;
            }
            .invoice-container {
                max-width: 100%;
                margin: 0 auto;
                background: white;
                padding: 5mm;
            }
            .invoice-header {
                border-bottom: 2px solid #2563eb;
                padding-bottom: 5mm;
                margin-bottom: 8mm;
            }
            .invoice-title {
                font-size: 18pt;
                font-weight: bold;
                color: #2563eb;
                margin-bottom: 3mm;
            }
            .invoice-number {
                font-size: 11pt;
                color: #64748b;
            }
            .info-section {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8mm;
                margin-bottom: 8mm;
            }
            .info-box {
                background: #f8fafc;
                padding: 5mm;
                border-radius: 4px;
                border-right: 3px solid #2563eb;
            }
            .info-title {
                font-size: 9pt;
                color: #64748b;
                margin-bottom: 2mm;
                font-weight: 600;
            }
            .info-value {
                font-size: 10pt;
                color: #1a1a1a;
                font-weight: 500;
            }
            .items-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 8mm;
                font-size: 9pt;
            }
            .items-table thead {
                background: #2563eb;
                color: white;
            }
            .items-table th {
                padding: 4mm 3mm;
                text-align: right;
                font-weight: 600;
                font-size: 9pt;
            }
            .items-table td {
                padding: 3mm;
                border-bottom: 1px solid #e2e8f0;
                font-size: 9pt;
            }
            .items-table tbody tr:hover {
                background: #f8fafc;
            }
            .total-section {
                margin-top: 5mm;
                padding-top: 5mm;
                border-top: 2px solid #e2e8f0;
            }
            .total-row {
                display: flex;
                justify-content: space-between;
                padding: 2mm 0;
                font-size: 10pt;
            }
            .total-label {
                color: #64748b;
                font-weight: 600;
            }
            .total-value {
                color: #1a1a1a;
                font-weight: 700;
                font-size: 11pt;
            }
            .grand-total {
                background: #2563eb;
                color: white;
                padding: 5mm;
                border-radius: 4px;
                margin-top: 5mm;
            }
            .grand-total .total-label,
            .grand-total .total-value {
                color: white;
                font-size: 12pt;
            }
            .payment-section {
                margin-top: 5mm;
                padding: 5mm;
                background: #f0fdf4;
                border-radius: 4px;
            }
            .payment-title {
                font-size: 10pt;
                font-weight: 600;
                margin-bottom: 3mm;
                color: #166534;
            }
            .payment-item {
                display: flex;
                justify-content: space-between;
                padding: 2mm 0;
                border-bottom: 1px solid #bbf7d0;
                font-size: 9pt;
            }
            .notes-section {
                margin-top: 5mm;
                padding: 5mm;
                background: #f8fafc;
                border-radius: 4px;
                border-right: 3px solid #2563eb;
            }
            .notes-title {
                font-size: 10pt;
                font-weight: 600;
                color: #2563eb;
                margin-bottom: 3mm;
            }
            .notes-text {
                color: #64748b;
                line-height: 1.4;
                font-size: 9pt;
            }
            @media print {
                body {
                    padding: 0;
                    margin: 0;
                }
                .invoice-container {
                    box-shadow: none;
                    padding: 5mm;
                    margin: 0;
                }
                .no-print {
                    display: none !important;
                }
                /* Ensure everything fits on one page */
                .invoice-header {
                    page-break-after: avoid;
                }
                .items-table {
                    page-break-inside: avoid;
                }
                .total-section {
                    page-break-inside: avoid;
                }
            }
        `;
    };

    const handlePrint = () => {
        if (printRef.current) {
            const printContent = printRef.current.innerHTML;
            const styles = getPrintStyles();
            
            // Create a new window for printing
            const printWindow = window.open("", "_blank", "width=800,height=600");
            
            if (!printWindow) {
                // If popup is blocked, try printing current page
                console.warn("Popup blocked, printing current page");
                window.print();
                return;
            }
            
            // Write the content to the new window
            printWindow.document.open();
            printWindow.document.write(`
                <!DOCTYPE html>
                <html dir="rtl" lang="fa">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>فاکتور فروش #${saleData.sale.id}</title>
                    <style>
                        ${styles}
                    </style>
                </head>
                <body>
                    ${printContent}
                    <script>
                        // Trigger print dialog when page loads
                        (function() {
                            function triggerPrint() {
                                window.focus();
                                window.print();
                            }
                            
                            // Try multiple methods to ensure print dialog opens
                            if (document.readyState === 'complete') {
                                setTimeout(triggerPrint, 100);
                            } else {
                                window.addEventListener('load', function() {
                                    setTimeout(triggerPrint, 100);
                                });
                            }
                            
                            // Fallback after a delay
                            setTimeout(triggerPrint, 500);
                        })();
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
            
            // Additional fallback: trigger print after document is closed
            setTimeout(() => {
                if (printWindow && !printWindow.closed) {
                    try {
                        printWindow.focus();
                        printWindow.print();
                    } catch (e) {
                        console.error("Print error:", e);
                    }
                }
            }, 800);
        }
    };


    const remainingAmount = saleData.sale.total_amount - saleData.sale.paid_amount;

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
                    border-bottom: 3px solid #2563eb;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .invoice-title {
                    font-size: 32px;
                    font-weight: bold;
                    color: #2563eb;
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
                    background: #f8fafc;
                    padding: 20px;
                    border-radius: 8px;
                    border-right: 4px solid #2563eb;
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
                    background: #2563eb;
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
                    background: #f8fafc;
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
                    background: #2563eb;
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
                    background: #f8fafc;
                    border-radius: 8px;
                    border-right: 4px solid #2563eb;
                }
                .notes-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #2563eb;
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
                                <h1 className="invoice-title">فاکتور فروش</h1>
                                <p className="invoice-number">
                                    شماره فاکتور: #{saleData.sale.id}
                                </p>
                            </div>
                            <div className="text-left">
                                <div className="text-sm text-gray-500 mb-1">تاریخ:</div>
                                <div className="text-lg font-semibold">
                                    {formatDate(saleData.sale.date)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Info Section */}
                    <div className="info-section">
                        <div className="info-box">
                            <div className="info-title">اطلاعات مشتری</div>
                            <div className="info-value">{customer.full_name}</div>
                            <div className="text-sm text-gray-600 mt-2">
                                <div>تلفن: {customer.phone}</div>
                                <div className="mt-1">آدرس: {customer.address}</div>
                                {customer.email && (
                                    <div className="mt-1">ایمیل: {customer.email}</div>
                                )}
                            </div>
                        </div>
                        <div className="info-box">
                            <div className="info-title">اطلاعات فروش</div>
                            <div className="text-sm text-gray-600 space-y-1">
                                <div>شماره فاکتور: <span className="font-semibold">#{saleData.sale.id}</span></div>
                                <div>تاریخ: <span className="font-semibold">{formatDate(saleData.sale.date)}</span></div>
                                <div>وضعیت: <span className={`font-semibold ${remainingAmount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                    {remainingAmount > 0 ? 'باقی مانده' : 'پرداخت شده'}
                                </span></div>
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
                            {saleData.items.map((item, index) => (
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
                        <div className="total-row">
                            <span className="total-label">جمع کل:</span>
                            <span className="total-value">{formatNumber(saleData.sale.total_amount)}</span>
                        </div>
                        <div className="total-row">
                            <span className="total-label">پرداخت شده:</span>
                            <span className="total-value text-green-600">
                                {formatNumber(saleData.sale.paid_amount)}
                            </span>
                        </div>
                        {remainingAmount > 0 && (
                            <div className="total-row">
                                <span className="total-label">باقی مانده:</span>
                                <span className="total-value text-orange-600">
                                    {formatNumber(remainingAmount)}
                                </span>
                            </div>
                        )}
                        <div className="grand-total">
                            <div className="total-row">
                                <span className="total-label">مبلغ کل:</span>
                                <span className="total-value">{formatNumber(saleData.sale.total_amount)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Payments History */}
                    {payments.length > 0 && (
                        <div className="mt-8">
                            <h3 className="text-lg font-semibold mb-4 text-gray-800">تاریخچه پرداخت‌ها</h3>
                            <div className="space-y-2">
                                {payments.map((payment) => (
                                    <div
                                        key={payment.id}
                                        className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                                    >
                                        <div>
                                            <span className="text-sm text-gray-600">
                                                {formatDate(payment.date)}
                                            </span>
                                        </div>
                                        <div className="font-semibold text-green-600">
                                            {formatNumber(payment.amount)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    {saleData.sale.notes && (
                        <div className="notes-section">
                            <div className="notes-title">یادداشت‌ها:</div>
                            <div className="notes-text">{saleData.sale.notes}</div>
                        </div>
                    )}
                    </div>

                    {/* Action Buttons */}
                    <div className="no-print flex justify-end gap-4 p-6 border-t bg-gray-50">
                    <button
                        onClick={handlePrint}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
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
