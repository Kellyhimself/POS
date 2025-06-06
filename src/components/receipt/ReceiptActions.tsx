import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';

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
  payment_method: string;
  phone?: string;
}

interface ReceiptActionsProps {
  receipt: Receipt;
}

export function ReceiptActions({ receipt }: ReceiptActionsProps) {
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
            <title>Receipt #${receipt.id}</title>
            <style>
              body { font-family: monospace; padding: 20px; }
              .header { text-align: center; margin-bottom: 20px; }
              .items { margin: 20px 0; }
              .item { margin: 10px 0; }
              .total { margin-top: 20px; border-top: 1px dashed #000; padding-top: 10px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>Receipt #${receipt.id}</h2>
              <p>${new Date().toLocaleString()}</p>
            </div>
            <div class="items">
              ${receipt.items.map(item => `
                <div class="item">
                  <div>${item.name} x ${item.quantity}</div>
                  <div>Price: KES ${item.price.toFixed(2)}</div>
                  ${item.vat_status === 'enabled' ? `<div>VAT: KES ${item.vat_amount.toFixed(2)}</div>` : ''}
                  <div>Total: KES ${item.total.toFixed(2)}</div>
                </div>
              `).join('')}
            </div>
            <div class="total">
              <div>Subtotal: KES ${(receipt.total - receipt.vat_total).toFixed(2)}</div>
              <div>VAT: KES ${receipt.vat_total.toFixed(2)}</div>
              <div><strong>Total: KES ${receipt.total.toFixed(2)}</strong></div>
              <div>Payment Method: ${receipt.payment_method}</div>
              ${receipt.phone ? `<div>Phone: ${receipt.phone}</div>` : ''}
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
Receipt #${receipt.id}
Date: ${new Date().toLocaleString()}

Items:
${receipt.items.map(item => `
${item.name} x ${item.quantity}
Price: KES ${item.price.toFixed(2)}
${item.vat_status === 'enabled' ? `VAT: KES ${item.vat_amount.toFixed(2)}` : ''}
Total: KES ${item.total.toFixed(2)}
`).join('\n')}

Subtotal: KES ${(receipt.total - receipt.vat_total).toFixed(2)}
VAT: KES ${receipt.vat_total.toFixed(2)}
Total: KES ${receipt.total.toFixed(2)}
Payment Method: ${receipt.payment_method}
${receipt.phone ? `Phone: ${receipt.phone}` : ''}
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