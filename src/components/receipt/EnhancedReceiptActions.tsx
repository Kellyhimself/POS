import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download, FileText } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useReceiptSettings } from '@/hooks/useReceiptSettings';

interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  vat_amount: number;
  vat_status: string;
  total: number;
}

interface Receipt {
  id: string;
  items: ReceiptItem[];
  total: number;
  vat_total: number;
  discount_amount?: number;
  discount_type?: 'percentage' | 'cash' | null;
  discount_value?: number;
  payment_method: string;
  phone?: string;
  cash_amount?: number;
  balance?: number;
}

interface EnhancedReceiptActionsProps {
  receipt: Receipt;
  onComplete?: () => void;
  autoPrint?: boolean;
  autoDownload?: boolean;
  enableAutoActions?: boolean;
  onCashAmountChange?: (amount: number) => void;
}

export function EnhancedReceiptActions({ 
  receipt, 
  onComplete, 
  autoPrint = false, 
  autoDownload = false, 
  enableAutoActions = true, 
  onCashAmountChange 
}: EnhancedReceiptActionsProps) {
  const { storeName, user } = useAuth();
  const { settings: receiptSettings } = useReceiptSettings();
  const userMetadata = user?.user_metadata || {};
  const vatRegistrationNumber = userMetadata.vat_registration_number || 'Pending Registration';
  const receiptRef = useRef<HTMLDivElement>(null);
  const [hasTriggeredAutoActions, setHasTriggeredAutoActions] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  console.log('EnhancedReceiptActions - Receipt Data:', receipt);
  
  // Separate function to trigger auto-actions
  const triggerAutoActions = useCallback(() => {
    console.log('EnhancedReceiptActions - triggerAutoActions called');
    
    if (autoPrint) {
      setTimeout(() => {
        handlePrint();
      }, receiptSettings.printDelay);
    }
    
    if (autoDownload) {
      setTimeout(() => {
        handleDownload();
      }, receiptSettings.downloadDelay);
    }

    // Auto-close dialog if enabled
    if (receiptSettings.closeDialogAfterActions) {
      const maxDelay = Math.max(
        autoPrint ? receiptSettings.printDelay : 0,
        autoDownload ? receiptSettings.downloadDelay : 0
      );
      
      setTimeout(() => {
        onComplete?.();
      }, maxDelay + receiptSettings.closeDialogDelay);
    }
  }, [autoPrint, autoDownload, receiptSettings, onComplete]);

  // Auto-print and auto-download with debounce for cash payments
  useEffect(() => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Only trigger auto-actions if explicitly enabled and not already triggered
    if (!enableAutoActions || hasTriggeredAutoActions) {
      return;
    }

    // For cash payments, use debounce to wait for user to finish typing
    if (receipt.payment_method === 'cash') {
      // Don't trigger if cash amount is insufficient
      if (!receipt.cash_amount || receipt.cash_amount <= 0) {
        return;
      }

      // Set a debounce timer to wait for user to finish typing
      debounceTimerRef.current = setTimeout(() => {
        console.log('EnhancedReceiptActions - Debounce timer fired, triggering auto-actions');
        triggerAutoActions();
        setHasTriggeredAutoActions(true);
      }, 1000); // Wait 1 second after user stops typing
    } else {
      // For non-cash payments, trigger immediately
      console.log('EnhancedReceiptActions - Non-cash payment, triggering auto-actions immediately');
      triggerAutoActions();
      setHasTriggeredAutoActions(true);
    }

    // Cleanup function
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [enableAutoActions, receipt.payment_method, receipt.cash_amount, hasTriggeredAutoActions, triggerAutoActions]);

  // Reset auto-actions state when component unmounts or receipt changes
  useEffect(() => {
    setHasTriggeredAutoActions(false);
  }, [receipt.id]);

  if (!receipt || !receipt.items) {
    console.log('EnhancedReceiptActions - No receipt data or items');
    return null;
  }

  const generatePDF = async () => {
    try {
      console.log('EnhancedReceiptActions - Generating PDF receipt');
      
      const [jsPDFModule, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
      ]);

      const jsPDF = jsPDFModule.default;
      const autoTable = autoTableModule.default;
      const doc = new jsPDF();
      
      // Set up fonts and styles
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      
      // Header
      doc.text(storeName || 'Store', 105, 20, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`VAT Registration No: ${vatRegistrationNumber}`, 105, 30, { align: 'center' });
      doc.text(`Receipt #${receipt.id}`, 105, 37, { align: 'center' });
      doc.text(`Date: ${new Date().toLocaleString()}`, 105, 44, { align: 'center' });
      
      // VAT Info box
      doc.setFillColor(248, 248, 248);
      doc.rect(14, 50, 182, 15, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text('VAT INCLUDED IN PRICES', 105, 58, { align: 'center' });
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text('VAT Rate: 16%', 105, 65, { align: 'center' });
      
      // Items table
      const tableData = receipt.items.map(item => [
        item.name,
        item.quantity.toString(),
        `KES ${item.price.toFixed(2)}`,
        item.vat_amount > 0 ? `KES ${item.vat_amount.toFixed(2)}` : 'Exempt',
        `KES ${item.total.toFixed(2)}`
      ]);

      autoTable(doc, {
        head: [['Item', 'Qty', 'Price (VAT inc.)', 'VAT Amount', 'Total']],
        body: tableData,
        startY: 75,
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [26, 31, 54],
          textColor: 255,
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [248, 248, 248],
        },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 35, halign: 'right' },
          3: { cellWidth: 35, halign: 'right' },
          4: { cellWidth: 35, halign: 'right' }
        }
      });

      // Get the final Y position after the table
      const estimatedRowHeight = 8;
      const headerHeight = 10;
      const finalY = 75 + headerHeight + (receipt.items.length * estimatedRowHeight) + 15;

      // Totals section
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      
      let yPos = finalY;
      doc.text('Subtotal:', 140, yPos);
      doc.text(`KES ${(receipt.total - receipt.vat_total).toFixed(2)}`, 190, yPos, { align: 'right' });
      
      yPos += 8;
      doc.text('VAT Total:', 140, yPos);
      doc.text(`KES ${receipt.vat_total.toFixed(2)}`, 190, yPos, { align: 'right' });
      
      if (receipt.discount_amount && receipt.discount_amount > 0) {
        yPos += 8;
        doc.setTextColor(220, 38, 38);
        const discountLabel = `Discount ${receipt.discount_type === 'percentage' && receipt.discount_value ? `(${receipt.discount_value}%)` : ''}:`;
        doc.text(discountLabel, 140, yPos);
        doc.text(`-KES ${receipt.discount_amount.toFixed(2)}`, 190, yPos, { align: 'right' });
        doc.setTextColor(0, 0, 0);
      }
      
      yPos += 8;
      doc.setFontSize(14);
      doc.text('Total:', 140, yPos);
      doc.text(`KES ${receipt.total.toFixed(2)}`, 190, yPos, { align: 'right' });
      
      // Payment information
      yPos += 15;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setFillColor(248, 248, 248);
      doc.rect(14, yPos - 5, 182, 25, 'F');
      
      doc.text(`Payment Method: ${receipt.payment_method.toUpperCase()}`, 20, yPos);
      if (receipt.phone) {
        yPos += 6;
        doc.text(`Phone: ${receipt.phone}`, 20, yPos);
      }
      if (receipt.cash_amount) {
        yPos += 6;
        doc.text(`Amount Received: KES ${receipt.cash_amount.toFixed(2)}`, 20, yPos);
        yPos += 6;
        doc.text(`Balance: KES ${receipt.balance?.toFixed(2)}`, 20, yPos);
      }
      
      // Footer
      yPos += 15;
      doc.setFontSize(10);
      doc.text('Thank you for your purchase!', 105, yPos, { align: 'center' });
      yPos += 6;
      doc.text('Please come again', 105, yPos, { align: 'center' });
      
      // Save the PDF
      const fileName = `receipt-${receipt.id}.pdf`;
      doc.save(fileName);
      
      console.log('EnhancedReceiptActions - PDF generated successfully');
    } catch (error) {
      console.error('Error generating PDF receipt:', error);
    }
  };

  const handlePrint = () => {
    try {
      const printContent = `
        <html>
          <head>
            <title>Receipt</title>
            <style>
              @media print {
                body { margin: 0; padding: 20px; }
                .no-print { display: none !important; }
              }
              body { 
                font-family: Arial, sans-serif; 
                padding: 40px;
                max-width: 800px;
                margin: 0 auto;
                font-size: 16px;
                line-height: 1.6;
              }
              .header { 
                text-align: center; 
                margin-bottom: 30px;
                border-bottom: 2px solid #000;
                padding-bottom: 20px;
              }
              .header h2 {
                font-size: 28px;
                margin-bottom: 10px;
              }
              .items { 
                margin: 30px 0;
                border: 1px solid #000;
                padding: 20px;
              }
              .item { 
                margin: 15px 0;
                padding: 10px;
                border-bottom: 1px dashed #ccc;
              }
              .item:last-child {
                border-bottom: none;
              }
              .total { 
                margin-top: 30px; 
                border-top: 2px solid #000; 
                padding-top: 20px;
                font-size: 18px;
              }
              .total div {
                margin: 10px 0;
              }
              .discount { 
                color: #dc2626;
                font-weight: bold;
              }
              .footer { 
                margin-top: 40px; 
                text-align: center; 
                font-size: 16px;
                border-top: 1px solid #ccc;
                padding-top: 20px;
              }
              .amount {
                font-weight: bold;
              }
              .payment-info {
                margin-top: 20px;
                padding: 15px;
                background-color: #f8f8f8;
                border-radius: 5px;
              }
              .vat-info {
                margin-top: 10px;
                padding: 10px;
                background-color: #f8f8f8;
                border-radius: 5px;
                font-size: 14px;
              }
              .vat-included {
                color: #059669;
                font-weight: bold;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>${storeName || 'Store'}</h2>
              <p>VAT Registration No: ${vatRegistrationNumber}</p>
              <p>Receipt #${receipt.id}</p>
              <p>${new Date().toLocaleString()}</p>
              <div class="vat-info">
                <p class="vat-included">VAT INCLUDED IN PRICES</p>
                <p>VAT Rate: 16%</p>
              </div>
            </div>
            <div class="items">
              ${receipt.items.map(item => `
                <div class="item">
                  <div><strong>${item.name}</strong> x ${item.quantity}</div>
                  <div>KES ${item.price.toFixed(2)} each</div>
                  ${item.vat_amount > 0 ? `<div>VAT: KES ${item.vat_amount.toFixed(2)}</div>` : '<div></div>'}
                  <div class="amount">Total: KES ${item.total.toFixed(2)}</div>
                </div>
              `).join('')}
            </div>
            <div class="total">
              <div>Subtotal: KES ${(receipt.total - receipt.vat_total).toFixed(2)}</div>
              <div>VAT: ${receipt.vat_total > 0 ? `KES ${receipt.vat_total.toFixed(2)}` : ''}</div>
              ${receipt.discount_amount && receipt.discount_amount > 0 ? `
                <div class="discount">
                  Discount ${receipt.discount_type === 'percentage' && receipt.discount_value ? `(${receipt.discount_value}%)` : ''}: 
                  -KES ${receipt.discount_amount.toFixed(2)}
                </div>
              ` : ''}
              <div class="amount">Total: KES ${receipt.total.toFixed(2)}</div>
              <div class="payment-info">
                <div>Payment Method: ${receipt.payment_method.toUpperCase()}</div>
                ${receipt.phone ? `<div>Phone: ${receipt.phone}</div>` : ''}
                ${receipt.cash_amount ? `
                  <div>Amount Received: KES ${receipt.cash_amount.toFixed(2)}</div>
                  <div>Balance: KES ${receipt.balance?.toFixed(2)}</div>
                ` : ''}
              </div>
            </div>
            <div class="footer">
              <p>Thank you for your purchase!</p>
              <p>Please come again</p>
            </div>
          </body>
        </html>
      `;

      // Create a hidden iframe for printing
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      
      iframe.contentDocument?.write(printContent);
      iframe.contentDocument?.close();
      
      iframe.onload = () => {
        iframe.contentWindow?.print();
        // Remove iframe after printing
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      };
      
      console.log('EnhancedReceiptActions - Print completed');
    } catch (error) {
      console.error('Error printing receipt:', error);
    }
  };

  const handleDownload = () => {
    try {
      const content = `
==========================================
            ${storeName || 'Store'}
==========================================
VAT Registration No: ${vatRegistrationNumber}
Receipt #${receipt.id}
Date: ${new Date().toLocaleString()}
==========================================
VAT INCLUDED IN PRICES
VAT Rate: 16%
==========================================

ITEMS:
${receipt.items.map(item => `
${item.name} x ${item.quantity}
KES ${item.price.toFixed(2)} each (VAT included)
${item.vat_amount > 0 ? `VAT Amount: KES ${item.vat_amount.toFixed(2)}` : ''}
Total: KES ${item.total.toFixed(2)}
------------------------------------------
`).join('\n')}

==========================================
Subtotal: KES ${(receipt.total - receipt.vat_total).toFixed(2)}
VAT: ${receipt.vat_total > 0 ? `KES ${receipt.vat_total.toFixed(2)}` : ''}
${receipt.discount_amount && receipt.discount_amount > 0 ? `
Discount ${receipt.discount_type === 'percentage' && receipt.discount_value ? `(${receipt.discount_value}%)` : ''}: 
-KES ${receipt.discount_amount.toFixed(2)}
` : ''}
Total: KES ${receipt.total.toFixed(2)}
==========================================

Payment Method: ${receipt.payment_method.toUpperCase()}
${receipt.phone ? `Phone: ${receipt.phone}` : ''}
${receipt.cash_amount ? `
Amount Received: KES ${receipt.cash_amount.toFixed(2)}
Balance: KES ${receipt.balance?.toFixed(2)}
` : ''}

==========================================
Thank you for your purchase!
Please come again
==========================================
      `;

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${receipt.id}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('EnhancedReceiptActions - Download completed');
    } catch (error) {
      console.error('Error downloading receipt:', error);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row items-start gap-8 h-[70vh]">
      {/* Inline Receipt Display - Only show if enabled in settings */}
      {receiptSettings.showInlineReceipt && (
        <div ref={receiptRef} className="flex-1 max-w-md bg-white text-black p-4 rounded-lg shadow-lg overflow-y-auto max-h-full">
          <div className="text-center mb-4">
            <h3 className="text-lg font-bold">{storeName || 'Store'}</h3>
            <p className="text-sm text-gray-600">VAT Registration No: {vatRegistrationNumber}</p>
            <p className="text-sm font-semibold">Receipt #{receipt.id}</p>
            <p className="text-xs text-gray-500">{new Date().toLocaleString()}</p>
            <div className="mt-2 p-2 bg-green-50 rounded">
              <p className="text-xs font-bold text-green-700">VAT INCLUDED IN PRICES</p>
              <p className="text-xs text-green-600">VAT Rate: 16%</p>
            </div>
          </div>
          
          <div className="border-t border-b border-gray-300 py-2 mb-4">
            {receipt.items.map((item, index) => (
              <div key={index} className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-gray-600">Qty: {item.quantity} x KES {item.price.toFixed(2)}</p>
                  {item.vat_amount > 0 && (
                    <p className="text-xs text-gray-500">VAT: KES {item.vat_amount.toFixed(2)}</p>
                  )}
                </div>
                <p className="text-sm font-bold">KES {item.total.toFixed(2)}</p>
              </div>
            ))}
          </div>
          
          <div className="space-y-1 mb-4">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>KES {(receipt.total - receipt.vat_total).toFixed(2)}</span>
            </div>
            {receipt.vat_total > 0 && (
              <div className="flex justify-between text-sm">
                <span>VAT:</span>
                <span>KES {receipt.vat_total.toFixed(2)}</span>
              </div>
            )}
            {receipt.discount_amount && receipt.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Discount {receipt.discount_type === 'percentage' && receipt.discount_value ? `(${receipt.discount_value}%)` : ''}:</span>
                <span>-KES {receipt.discount_amount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t pt-1">
              <span>Total:</span>
              <span>KES {receipt.total.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="bg-gray-50 p-3 rounded mb-4">
            <p className="text-sm font-medium">Payment: {receipt.payment_method.toUpperCase()}</p>
            {receipt.phone && <p className="text-sm">Phone: {receipt.phone}</p>}
            {receipt.cash_amount && (
              <>
                <p className="text-sm">Received: KES {receipt.cash_amount.toFixed(2)}</p>
                <p className="text-sm font-medium">Balance: KES {receipt.balance?.toFixed(2)}</p>
              </>
            )}
          </div>
          
          <div className="text-center text-sm text-gray-600">
            <p>Thank you for your purchase!</p>
            <p>Please come again</p>
          </div>
        </div>
      )}

      {/* Right Side Controls - Cash Input and Action Buttons */}
      <div className="flex flex-col gap-4 w-full lg:w-80 lg:flex-shrink-0 lg:flex lg:flex-col lg:items-center lg:max-h-full lg:overflow-y-auto">
        {/* Cash Amount Input Section */}
        {receipt.payment_method === 'cash' && (
          <div className="bg-[#2D3748] p-4 rounded-lg border border-[#4A5568] w-full max-w-sm flex-shrink-0">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Cash Payment Details</h4>
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="cashAmount" className="text-xs text-gray-400">
                  Amount Received (KES)
                </label>
                <input
                  id="cashAmount"
                  type="text"
                  value={receipt.cash_amount || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow empty string or valid numbers
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      onCashAmountChange?.(value === '' ? 0 : Number(value));
                    }
                  }}
                  className="w-full px-3 py-2 border border-[#4A5568] rounded bg-[#1A1F36] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0ABAB5] text-sm"
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-300">
                <span>Total Amount:</span>
                <span>KES {receipt.total.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-gray-300">Balance:</span>
                <span className={receipt.balance && receipt.balance >= 0 ? 'text-green-400' : 'text-red-400'}>
                  KES {receipt.balance?.toFixed(2) || '0.00'}
                </span>
              </div>
              {/* Auto-actions status indicator */}
              {receiptSettings.autoPrint || receiptSettings.autoDownload ? (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Auto-actions:</span>
                  <span className={
                    receipt.cash_amount && receipt.cash_amount > 0 && receipt.cash_amount >= receipt.total
                      ? 'text-green-400' 
                      : receipt.cash_amount && receipt.cash_amount > 0
                        ? 'text-yellow-400'
                        : 'text-gray-400'
                  }>
                    {receipt.cash_amount && receipt.cash_amount > 0 && receipt.cash_amount >= receipt.total
                      ? 'Ready (will trigger in 1s)' 
                      : receipt.cash_amount && receipt.cash_amount > 0
                        ? 'Waiting for sufficient amount'
                        : 'Waiting for cash amount'
                    }
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 w-full max-w-sm flex-shrink-0">
          <Button 
            variant="outline" 
            onClick={generatePDF}
            className="border-[#0ABAB5] text-[#0ABAB5] hover:bg-[#0ABAB5] hover:text-white px-6 py-3 rounded-xl"
          >
            <FileText className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
          <Button 
            variant="outline" 
            onClick={handlePrint}
            className="border-[#0ABAB5] text-[#0ABAB5] hover:bg-[#0ABAB5] hover:text-white px-6 py-3 rounded-xl"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Receipt
          </Button>
          <Button 
            variant="outline" 
            onClick={handleDownload}
            className="border-[#0ABAB5] text-[#0ABAB5] hover:bg-[#0ABAB5] hover:text-white px-6 py-3 rounded-xl"
          >
            <Download className="w-4 h-4 mr-2" />
            Download TXT
          </Button>
          <Button 
            variant="outline" 
            onClick={onComplete}
            className="border-gray-500 text-gray-500 hover:bg-gray-500 hover:text-white px-6 py-3 rounded-xl"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
} 