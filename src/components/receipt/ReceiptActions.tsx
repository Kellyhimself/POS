import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';

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

interface ReceiptActionsProps {
  receipt: Receipt;
}

export function ReceiptActions({ receipt }: ReceiptActionsProps) {
  const { storeName, userMetadata } = useAuth();
  const vatRegistrationNumber = userMetadata?.vat_registration_number || 'Pending Registration';
  console.log('ReceiptActions - Receipt Data:', receipt);
  
  if (!receipt || !receipt.items) {
    console.log('ReceiptActions - No receipt data or items');
    return null;
  }

  const handlePrint = () => {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const content = `
        <html>
          <head>
            <title>Receipt</title>
            <style>
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
                  ${item.vat_amount > 0 ? `<div>VAT: KES ${item.vat_amount.toFixed(2)}</div>` : ''}
                  <div class="amount">Total: KES ${item.total.toFixed(2)}</div>
                </div>
              `).join('')}
            </div>
            <div class="total">
              <div>Subtotal: KES ${(receipt.total - receipt.vat_total).toFixed(2)}</div>
              <div>VAT: KES ${receipt.vat_total.toFixed(2)}</div>
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

      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.print();
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
${item.vat_amount > 0 ? `VAT Amount: KES ${item.vat_amount.toFixed(2)}` : 'VAT Exempt'}
Total: KES ${item.total.toFixed(2)}
------------------------------------------
`).join('\n')}

==========================================
Subtotal: KES ${(receipt.total - receipt.vat_total).toFixed(2)}
VAT: KES ${receipt.vat_total.toFixed(2)}
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
    } catch (error) {
      console.error('Error downloading receipt:', error);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center mb-4">
        <div className="text-lg font-semibold text-gray-900 mb-1">{storeName || 'Store'}</div>
        <h3 className="text-lg font-semibold text-gray-900">Receipt #{receipt.id}</h3>
        <p className="text-sm text-gray-500">{new Date().toLocaleString()}</p>
      </div>
      <div className="flex gap-4">
        <Button 
          variant="outline" 
          onClick={handlePrint}
          className="border-[#0ABAB5] text-[#0ABAB5] hover:bg-[#0ABAB5] hover:text-white px-6"
        >
          <Printer className="w-4 h-4 mr-2" />
          Print Receipt
        </Button>
        <Button 
          variant="outline" 
          onClick={handleDownload}
          className="border-[#0ABAB5] text-[#0ABAB5] hover:bg-[#0ABAB5] hover:text-white px-6"
        >
          <Download className="w-4 h-4 mr-2" />
          Download Receipt
        </Button>
      </div>
    </div>
  );
} 