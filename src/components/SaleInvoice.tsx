import { useRef, useState, useEffect } from "react";
import { SaleWithItems, SalePayment } from "../utils/sales";
import { Customer } from "../utils/customer";
import { Product } from "../utils/product";
import { Unit } from "../utils/unit";
import { CompanySettings } from "../utils/company";
import { formatPersianDateLong } from "../utils/date";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import toast from "react-hot-toast";
import * as QRCode from "qrcode";

interface SaleInvoiceProps {
    saleData: SaleWithItems;
    customer: Customer;
    products: Product[];
    units: Unit[];
    payments?: SalePayment[];
    companySettings?: CompanySettings | null;
    onClose?: () => void;
}

export default function SaleInvoice({
    saleData,
    customer,
    products,
    units,
    payments: _payments,
    companySettings,
    onClose,
}: SaleInvoiceProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const qrCodeCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

    // Generate QR code on mount
    useEffect(() => {
        if (qrCodeCanvasRef.current) {
            const qrData = JSON.stringify({
                type: "sale_invoice",
                id: saleData.sale.id,
                date: saleData.sale.date,
                customer: customer.full_name,
                total: saleData.sale.total_amount,
                paid: saleData.sale.paid_amount,
            });

            QRCode.toCanvas(qrCodeCanvasRef.current, qrData, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#1e3a8a',
                    light: '#FFFFFF',
                },
            })
                .then(() => {
                    if (qrCodeCanvasRef.current) {
                        setQrCodeDataUrl(qrCodeCanvasRef.current.toDataURL());
                    }
                })
                .catch((error) => {
                    console.error("Error generating QR code:", error);
                });
        }
    }, [saleData, customer]);

    const formatDate = (dateString: string) => {
        return formatPersianDateLong(dateString);
    };

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat("en-US").format(num);
    };

    const getProductName = (productId: number) => {
        const product = products.find((p) => p.id === productId);
        return product?.name || "نامشخص";
    };

    const getUnitName = (unitId: number) => {
        const unit = units.find((u) => u.id === unitId);
        return unit?.name || "نامشخص";
    };

    const handleExportPDF = async () => {
        if (!printRef.current) {
            toast.error("خطا در تولید PDF");
            return;
        }

        try {
            setIsExporting(true);
            const actionButtons = document.querySelector('.no-print');
            if (actionButtons) (actionButtons as HTMLElement).style.display = 'none';

            const canvas = await html2canvas(printRef.current, {
                scale: 3,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
            });

            if (actionButtons) (actionButtons as HTMLElement).style.display = '';

            const imgWidth = 210;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            const pdf = new jsPDF('p', 'mm', 'a4');
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);

            const fileName = `فاکتور-فروش-${saleData.sale.id}.pdf`;
            pdf.save(fileName);

            toast.success("PDF با موفقیت دانلود شد");
        } catch (error) {
            console.error("Error exporting PDF:", error);
            toast.error("خطا در تولید PDF");
        } finally {
            setIsExporting(false);
        }
    };

    const remainingAmount = saleData.sale.total_amount - saleData.sale.paid_amount;

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                
                .invoice-root {
                    font-family: 'Inter', system-ui, -apple-system, sans-serif;
                    background-color: #f8fafc;
                }

                .invoice-card {
                    background: white;
                    width: 210mm;
                    min-height: 297mm;
                    margin: 20px auto;
                    padding: 20mm;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
                    position: relative;
                    direction: rtl;
                }

                .invoice-header-bg {
                    position: absolute;
                    top: 0;
                    right: 0;
                    left: 0;
                    height: 8px;
                    background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%);
                }

                .invoice-status-badge {
                    display: inline-block;
                    padding: 6px 16px;
                    border-radius: 9999px;
                    font-size: 14px;
                    font-weight: 700;
                    margin-bottom: 16px;
                }

                .status-paid { background: #dcfce7; color: #166534; }
                .status-partial { background: #fef9c3; color: #854d0e; }

                .company-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 40px;
                }

                .company-logo-container {
                    width: 100px;
                    height: 100px;
                    background: #f8fafc;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    border: 1px solid #e2e8f0;
                }

                .company-logo-img {
                    max-width: 80%;
                    max-height: 80%;
                    object-fit: contain;
                }

                .company-info-text h1 {
                    font-size: 28px;
                    font-weight: 800;
                    color: #1e293b;
                    margin: 0 0 8px 0;
                }

                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 40px;
                    margin-bottom: 40px;
                }

                .info-card {
                    padding: 24px;
                    border-radius: 16px;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                }

                .info-card-label {
                    font-size: 12px;
                    font-weight: 700;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 12px;
                    display: block;
                }

                .info-card-value {
                    font-size: 18px;
                    font-weight: 600;
                    color: #1e293b;
                }

                .info-card-sub {
                    font-size: 14px;
                    color: #64748b;
                    margin-top: 8px;
                    line-height: 1.5;
                }

                .invoice-meta {
                    text-align: left;
                }

                .meta-item {
                    margin-bottom: 8px;
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                }

                .meta-label {
                    color: #64748b;
                    font-weight: 500;
                }

                .meta-value {
                    color: #1e293b;
                    font-weight: 700;
                }

                .table-container {
                    margin-bottom: 40px;
                }

                .modern-table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                }

                .modern-table th {
                    background: #f1f5f9;
                    padding: 16px;
                    text-align: right;
                    font-size: 13px;
                    font-weight: 700;
                    color: #475569;
                    border-bottom: 2px solid #e2e8f0;
                }

                .modern-table th:first-child { border-top-right-radius: 8px; }
                .modern-table th:last-child { border-top-left-radius: 8px; }

                .modern-table td {
                    padding: 16px;
                    border-bottom: 1px solid #f1f5f9;
                    font-size: 14px;
                    color: #1e293b;
                }

                .modern-table .product-name {
                    font-weight: 600;
                    color: #0f172a;
                }

                .summary-section {
                    display: flex;
                    justify-content: flex-end;
                }

                .total-card {
                    background: #1e293b;
                    color: white;
                    padding: 30px;
                    border-radius: 16px;
                    width: 320px;
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
                }

                .total-row-item {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 12px;
                }

                .total-row-item.highlight {
                    border-top: 1px solid rgba(255,255,255,0.1);
                    padding-top: 12px;
                    margin-top: 12px;
                }

                .grand-total-label {
                    font-size: 16px;
                    font-weight: 500;
                    opacity: 0.8;
                }

                .grand-total-value {
                    font-size: 24px;
                    font-weight: 800;
                }

                .footer-section {
                    margin-top: 60px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                }

                .notes-box {
                    flex: 1;
                    max-width: 400px;
                }

                .notes-box h4 {
                    font-size: 14px;
                    font-weight: 700;
                    color: #1e293b;
                    margin-bottom: 8px;
                }

                .notes-content {
                    font-size: 13px;
                    color: #64748b;
                    line-height: 1.6;
                }

                .qr-section {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                }

                .qr-img {
                    width: 100px;
                    height: 100px;
                    padding: 8px;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                }

                .qr-text {
                    font-size: 10px;
                    font-weight: 700;
                    color: #94a3b8;
                    letter-spacing: 0.1em;
                }

                @media print {
                    .no-print { display: none !important; }
                    .invoice-card { box-shadow: none; margin: 0; }
                }
            `}</style>

            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto invoice-root">
                <div className="max-w-5xl w-full">
                    <div className="no-print flex justify-between items-center mb-6 px-4">
                        <h2 className="text-white text-xl font-bold">پیش‌نمایش فاکتور فروش</h2>
                        <div className="flex gap-3">
                            <button
                                onClick={handleExportPDF}
                                disabled={isExporting}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-900/20 transition-all font-bold flex items-center gap-2 disabled:opacity-50"
                            >
                                {isExporting ? "در حال آماده‌سازی..." : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        دانلود نسخه PDF
                                    </>
                                )}
                            </button>
                            {onClose && (
                                <button
                                    onClick={onClose}
                                    className="px-6 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl shadow-lg transition-all font-bold"
                                >
                                    بستن
                                </button>
                            )}
                        </div>
                    </div>

                    <div ref={printRef} className="invoice-card">
                        <div className="invoice-header-bg"></div>

                        <div className="company-header">
                            <div className="flex gap-6 items-center">
                                <div className="company-logo-container">
                                    {companySettings?.logo ? (
                                        <img src={companySettings.logo} alt="Logo" className="company-logo-img" />
                                    ) : (
                                        <div className="text-blue-600 font-bold text-2xl">S</div>
                                    )}
                                </div>
                                <div className="company-info-text">
                                    <div className={`invoice-status-badge ${remainingAmount > 0 ? 'status-partial' : 'status-paid'}`}>
                                        {remainingAmount > 0 ? 'فاکتور فروش (باقی‌مانده)' : 'فاکتور فروش (تسویه شده)'}
                                    </div>
                                    <h1>{companySettings?.name || "نام شرکت شما"}</h1>
                                    <div className="text-slate-500 text-sm font-medium">
                                        {companySettings?.phone && <span className="ml-4">📞 {companySettings.phone}</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="invoice-meta">
                                <div className="meta-item">
                                    <span className="meta-label">شماره فاکتور:</span>
                                    <span className="meta-value">#{saleData.sale.id}</span>
                                </div>
                                <div className="meta-item">
                                    <span className="meta-label">تاریخ صدور:</span>
                                    <span className="meta-value">{formatDate(saleData.sale.date)}</span>
                                </div>
                                <div className="meta-item">
                                    <span className="meta-label">مشتری:</span>
                                    <span className="meta-value text-blue-600">{customer.full_name}</span>
                                </div>
                            </div>
                        </div>

                        <div className="info-grid">
                            <div className="info-card">
                                <span className="info-card-label">اطلاعات مشتری</span>
                                <div className="info-card-value">{customer.full_name}</div>
                                <div className="info-card-sub">
                                    {customer.phone && <div>تلفن: {customer.phone}</div>}
                                    {customer.address && <div>آدرس: {customer.address}</div>}
                                </div>
                            </div>
                            <div className="info-card">
                                <span className="info-card-label">آدرس فرستنده</span>
                                <div className="info-card-value">{companySettings?.name || "شرکت مرکزی"}</div>
                                <div className="info-card-sub">
                                    {companySettings?.address || "آدرس شرکت در تنظیمات ثبت نشده است."}
                                </div>
                            </div>
                        </div>

                        <div className="table-container">
                            <table className="modern-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: "60px" }}>ردیف</th>
                                        <th>شرح کالا / خدمات</th>
                                        <th style={{ width: "100px" }}>واحد</th>
                                        <th style={{ width: "80px" }}>تعداد</th>
                                        <th style={{ width: "130px" }}>فی (واحد)</th>
                                        <th style={{ width: "140px" }}>مبلغ کل</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {saleData.items.map((item, index) => (
                                        <tr key={item.id}>
                                            <td className="text-center text-slate-400 font-medium">{index + 1}</td>
                                            <td className="product-name">{getProductName(item.product_id)}</td>
                                            <td className="text-center">{getUnitName(item.unit_id)}</td>
                                            <td className="text-center font-bold">{formatNumber(item.amount)}</td>
                                            <td className="text-left font-medium">{formatNumber(item.per_price)}</td>
                                            <td className="text-left font-bold text-blue-700">{formatNumber(item.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="summary-section">
                            <div className="total-card">
                                <div className="total-row-item">
                                    <span className="grand-total-label opacity-70">جمع کل فاکتور:</span>
                                    <span className="font-semibold">{formatNumber(saleData.sale.total_amount)}</span>
                                </div>
                                <div className="total-row-item">
                                    <span className="grand-total-label opacity-70">مبلغ پرداخت شده:</span>
                                    <span className="text-emerald-400 font-semibold">{formatNumber(saleData.sale.paid_amount)}</span>
                                </div>
                                {remainingAmount > 0 && (
                                    <div className="total-row-item">
                                        <span className="grand-total-label opacity-70">باقی‌مانده:</span>
                                        <span className="text-orange-400 font-semibold">{formatNumber(remainingAmount)}</span>
                                    </div>
                                )}
                                <div className="total-row-item highlight">
                                    <span className="grand-total-label">قابل پرداخت:</span>
                                    <span className="grand-total-value">{formatNumber(saleData.sale.total_amount)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="footer-section">
                            <div className="notes-box">
                                {saleData.sale.notes && (
                                    <>
                                        <h4>توضیحات و یادداشت‌ها:</h4>
                                        <div className="notes-content">{saleData.sale.notes}</div>
                                    </>
                                )}
                                <div className="mt-8 pt-8 border-t border-slate-100 flex gap-4">
                                    <div className="text-center flex-1">
                                        <div className="h-16 border-b border-slate-200 mb-2"></div>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase">Signature & Stamp</span>
                                    </div>
                                    <div className="text-center flex-1">
                                        <div className="h-16 border-b border-slate-200 mb-2"></div>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase">Customer Acceptance</span>
                                    </div>
                                </div>
                            </div>

                            <div className="qr-section">
                                <canvas ref={qrCodeCanvasRef} style={{ display: 'none' }} />
                                {qrCodeDataUrl && (
                                    <img src={qrCodeDataUrl} alt="QR" className="qr-img" />
                                )}
                                <span className="qr-text">OFFICIAL SALE</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

