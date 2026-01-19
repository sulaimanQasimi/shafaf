import { useRef, useState, useEffect } from "react";
import { PurchaseWithItems, PurchaseItem } from "../utils/purchase";
import { Supplier } from "../utils/supplier";
import { Product } from "../utils/product";
import { Unit } from "../utils/unit";
import { CompanySettings } from "../utils/company";
import { formatPersianDateLong } from "../utils/date";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import toast from "react-hot-toast";
import * as QRCode from "qrcode";

interface PurchaseInvoiceProps {
    purchaseData: PurchaseWithItems;
    supplier: Supplier;
    products: Product[];
    units: Unit[];
    companySettings?: CompanySettings | null;
    onClose?: () => void;
}

export default function PurchaseInvoice({
    purchaseData,
    supplier,
    products,
    units,
    companySettings,
    onClose,
}: PurchaseInvoiceProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const qrCodeCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

    // Generate QR code on mount
    useEffect(() => {
        if (qrCodeCanvasRef.current) {
            const qrData = JSON.stringify({
                type: "purchase_invoice",
                id: purchaseData.purchase.id,
                date: purchaseData.purchase.date,
                supplier: supplier.full_name,
                total: purchaseData.purchase.total_amount,
            });
            
            QRCode.toCanvas(qrCodeCanvasRef.current, qrData, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#059669',
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
    }, [purchaseData, supplier]);

    const formatDate = (dateString: string) => {
        return formatPersianDateLong(dateString);
    };

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat("en-US").format(num);
    };

    const getProductName = (productId: number) => {
        const product = products.find((p: Product) => p.id === productId);
        return product?.name || "نامشخص";
    };

    const getUnitName = (unitId: number) => {
        const unit = units.find((u: Unit) => u.id === unitId);
        return unit?.name || "نامشخص";
    };

    // Helper function to convert oklch/rgb/computed colors to hex
    const convertColorToHex = (color: string): string => {
        if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
            return '#ffffff';
        }
        
        // If already hex, return as is
        if (color.startsWith('#')) {
            return color;
        }
        
        // If rgb/rgba, convert to hex
        const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
        if (rgbMatch) {
            const r = parseInt(rgbMatch[1]);
            const g = parseInt(rgbMatch[2]);
            const b = parseInt(rgbMatch[3]);
            return `#${[r, g, b].map(x => {
                const hex = x.toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            }).join('')}`;
        }
        
        // Fallback
        return '#000000';
    };

    // Recursively process all elements and convert their styles
    const processElementStyles = (element: HTMLElement) => {
        const computedStyle = window.getComputedStyle(element);
        
        // Convert color properties
        const colorProps = ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 
                          'borderRightColor', 'borderBottomColor', 'borderLeftColor'];
        
        colorProps.forEach(prop => {
            const value = computedStyle.getPropertyValue(prop);
            if (value && (value.includes('oklch') || value.includes('rgb') || value.includes('rgba'))) {
                try {
                    // Create a temporary element to get computed color
                    const temp = document.createElement('div');
                    temp.style.color = value;
                    temp.style.position = 'absolute';
                    temp.style.visibility = 'hidden';
                    document.body.appendChild(temp);
                    const computed = window.getComputedStyle(temp).color;
                    document.body.removeChild(temp);
                    
                    if (computed && !computed.includes('oklch')) {
                        element.style.setProperty(prop, computed, 'important');
                    } else {
                        element.style.setProperty(prop, convertColorToHex(computed || value), 'important');
                    }
                } catch (e) {
                    // If conversion fails, use a safe default
                    if (prop === 'backgroundColor') {
                        element.style.setProperty(prop, '#ffffff', 'important');
                    } else {
                        element.style.setProperty(prop, '#000000', 'important');
                    }
                }
            }
        });
        
        // Process children
        Array.from(element.children).forEach(child => {
            processElementStyles(child as HTMLElement);
        });
    };

    const handleExportPDF = async () => {
        if (!printRef.current) {
            toast.error("خطا در تولید PDF");
            return;
        }

        try {
            setIsExporting(true);
            
            // Hide the action buttons before capturing
            const actionButtons = document.querySelector('.no-print');
            if (actionButtons) {
                (actionButtons as HTMLElement).style.display = 'none';
            }

            // Create a clone of the element to avoid modifying the original
            const clone = printRef.current.cloneNode(true) as HTMLElement;
            
            // Add comprehensive inline styles to override all Tailwind classes with standard colors
            const styleOverrides = document.createElement('style');
            styleOverrides.textContent = `
                * {
                    color: inherit !important;
                }
                .invoice-container {
                    background: #ffffff !important;
                    color: #1a1a1a !important;
                }
                .invoice-title {
                    color: #059669 !important;
                }
                .invoice-number {
                    color: #64748b !important;
                }
                .info-box {
                    background: #f0fdf4 !important;
                }
                .info-title {
                    color: #64748b !important;
                }
                .info-value {
                    color: #1a1a1a !important;
                }
                .items-table thead {
                    background: #059669 !important;
                    color: #ffffff !important;
                }
                .items-table th {
                    background: #059669 !important;
                    color: #ffffff !important;
                }
                .items-table td {
                    color: #1a1a1a !important;
                    background: transparent !important;
                }
                .total-label {
                    color: #64748b !important;
                }
                .total-value {
                    color: #1a1a1a !important;
                }
                .grand-total {
                    background: #059669 !important;
                    color: #ffffff !important;
                }
                .grand-total .total-label,
                .grand-total .total-value {
                    color: #ffffff !important;
                }
                .notes-title {
                    color: #059669 !important;
                }
                .notes-text {
                    color: #64748b !important;
                }
                .text-gray-500,
                .text-gray-500 * {
                    color: #64748b !important;
                }
                .text-gray-600,
                .text-gray-600 * {
                    color: #475569 !important;
                }
                .text-gray-900,
                .text-gray-900 * {
                    color: #0f172a !important;
                }
                .text-green-600,
                .text-green-600 * {
                    color: #059669 !important;
                }
                .text-white,
                .text-white * {
                    color: #ffffff !important;
                }
                .bg-white {
                    background: #ffffff !important;
                }
                .bg-gray-50 {
                    background: #f9fafb !important;
                }
                .bg-gray-300 {
                    background: #d1d5db !important;
                }
                .bg-green-600 {
                    background: #059669 !important;
                }
                .bg-green-700 {
                    background: #047857 !important;
                }
                .bg-gray-400 {
                    background: #9ca3af !important;
                }
                .bg-black {
                    background: #000000 !important;
                }
                .bg-opacity-50 {
                    background-color: rgba(0, 0, 0, 0.5) !important;
                }
            `;
            clone.appendChild(styleOverrides);
            
            // Process all elements to convert computed styles
            processElementStyles(clone);
            
            // Temporarily append clone to body for rendering
            clone.style.position = 'absolute';
            clone.style.left = '-9999px';
            clone.style.top = '0';
            clone.style.width = printRef.current.offsetWidth + 'px';
            document.body.appendChild(clone);

            // Wait a bit for styles to apply
            await new Promise(resolve => setTimeout(resolve, 100));

            // Capture the invoice as canvas
            const canvas = await html2canvas(clone, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                removeContainer: true,
                ignoreElements: (element) => {
                    // Ignore any elements that might cause issues
                    return element.classList.contains('no-print');
                },
                onclone: (clonedDoc) => {
                    // Process all elements in the cloned document to remove oklch colors
                    const allElements = clonedDoc.querySelectorAll('*');
                    allElements.forEach((el) => {
                        const htmlEl = el as HTMLElement;
                        const computedStyle = clonedDoc.defaultView?.getComputedStyle(htmlEl);
                        if (computedStyle) {
                            // Convert all color-related properties
                            const colorProps = ['color', 'backgroundColor', 'borderColor', 
                                              'borderTopColor', 'borderRightColor', 
                                              'borderBottomColor', 'borderLeftColor'];
                            
                            colorProps.forEach(prop => {
                                const value = computedStyle.getPropertyValue(prop);
                                if (value && (value.includes('oklch') || value.includes('oklab'))) {
                                    // Remove oklch colors by setting to a safe default
                                    if (prop === 'backgroundColor' || prop.includes('background')) {
                                        htmlEl.style.setProperty(prop, '#ffffff', 'important');
                                    } else if (prop === 'color') {
                                        htmlEl.style.setProperty(prop, '#000000', 'important');
                                    } else {
                                        htmlEl.style.setProperty(prop, 'transparent', 'important');
                                    }
                                } else if (value && (value.includes('rgb') || value.includes('rgba'))) {
                                    // Keep rgb/rgba as they're supported
                                    htmlEl.style.setProperty(prop, value, 'important');
                                }
                            });
                        }
                    });
                },
            });

            // Remove clone from DOM
            document.body.removeChild(clone);

            // Show action buttons again
            if (actionButtons) {
                (actionButtons as HTMLElement).style.display = '';
            }

            // Calculate PDF dimensions
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;

            // Create PDF
            const pdf = new jsPDF('p', 'mm', 'a4');
            let position = 0;

            // Add first page
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            // Add additional pages if content is longer than one page
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            // Save the PDF
            const fileName = `فاکتور-خرید-${purchaseData.purchase.id}-${formatDate(purchaseData.purchase.date).replace(/\//g, '-')}.pdf`;
            pdf.save(fileName);
            
            toast.success("PDF با موفقیت دانلود شد");
        } catch (error) {
            console.error("Error exporting PDF:", error);
            toast.error("خطا در تولید PDF");
        } finally {
            setIsExporting(false);
        }
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
                        <div className="flex justify-between items-start gap-6 mb-6">
                            {/* Company Info */}
                            <div className="flex items-start gap-4 flex-1">
                                {companySettings?.logo && (
                                    <img 
                                        src={companySettings.logo} 
                                        alt={companySettings.name || "Company Logo"}
                                        className="company-logo"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                        }}
                                    />
                                )}
                                <div className="company-info">
                                    <h2 className="company-name">
                                        {companySettings?.name || "نام شرکت"}
                                    </h2>
                                    <div className="company-details">
                                        {companySettings?.phone && (
                                            <div>📞 تلفن: {companySettings.phone}</div>
                                        )}
                                        {companySettings?.address && (
                                            <div>📍 آدرس: {companySettings.address}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Invoice Info & QR Code */}
                            <div className="flex flex-col items-end gap-4">
                                <div className="text-left">
                                    <h1 className="invoice-title">فاکتور خرید</h1>
                                    <p className="invoice-number">
                                        شماره فاکتور: #{purchaseData.purchase.id}
                                    </p>
                                    <div className="text-sm text-gray-500 mt-2 mb-1">تاریخ:</div>
                                    <div className="text-lg font-semibold text-gray-900">
                                        {formatDate(purchaseData.purchase.date)}
                                    </div>
                                </div>
                                
                                {/* QR Code */}
                                <div className="qr-code-container">
                                    <canvas 
                                        ref={qrCodeCanvasRef} 
                                        style={{ display: 'none' }}
                                    />
                                    {qrCodeDataUrl && (
                                        <img 
                                            src={qrCodeDataUrl} 
                                            alt="QR Code" 
                                            style={{ width: '120px', height: '120px' }}
                                        />
                                    )}
                                    <div className="qr-code-label">QR Code</div>
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
                            {purchaseData.items.map((item: PurchaseItem, index: number) => (
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
                            onClick={handleExportPDF}
                            disabled={isExporting}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isExporting ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    در حال تولید...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    دانلود PDF
                                </>
                            )}
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                disabled={isExporting}
                                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
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
