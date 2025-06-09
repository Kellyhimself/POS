import React from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';

// Register fonts
Font.register({
  family: 'Roboto',
  src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf'
});

// Create styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 50,
    fontFamily: 'Roboto'
  },
  header: {
    marginBottom: 40,
    borderBottom: '2 solid #000',
    paddingBottom: 20
  },
  storeName: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center'
  },
  storeAddress: {
    fontSize: 18,
    marginBottom: 12,
    textAlign: 'center'
  },
  receiptInfo: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center'
  },
  table: {
    display: 'flex',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 2,
    borderColor: '#000',
    marginTop: 40
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    borderBottomStyle: 'solid',
    minHeight: 50,
    alignItems: 'center'
  },
  tableHeader: {
    backgroundColor: '#f0f0f0',
    fontWeight: 'bold'
  },
  tableCell: {
    padding: 10,
    fontSize: 16
  },
  col1: { width: '40%' },
  col2: { width: '15%' },
  col3: { width: '15%' },
  col4: { width: '15%' },
  col5: { width: '15%' },
  totals: {
    marginTop: 40,
    alignItems: 'flex-end',
    paddingRight: 20
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12
  },
  totalLabel: {
    width: 150,
    fontSize: 18,
    fontWeight: 'bold'
  },
  totalValue: {
    width: 150,
    fontSize: 18,
    textAlign: 'right'
  },
  discount: {
    color: '#dc2626',
    fontSize: 18
  },
  footer: {
    marginTop: 50,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 1.5
  }
});

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

interface ReceiptPDFProps {
  receipt: Receipt;
}

export function ReceiptPDF({ receipt }: ReceiptPDFProps) {
  const { storeName, userMetadata } = useAuth();
  const vatRegistrationNumber = userMetadata?.vat_registration_number || 'Pending Registration';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.storeName}>{storeName || 'Store'}</Text>
          <Text style={styles.receiptInfo}>
            VAT Registration No: {vatRegistrationNumber}
          </Text>
          <Text style={styles.receiptInfo}>
            Receipt No: {receipt.id}
          </Text>
          <Text style={styles.receiptInfo}>
            Date: {format(new Date(), 'dd/MM/yyyy HH:mm')}
          </Text>
          <View style={{ 
            backgroundColor: '#f8f8f8', 
            padding: 10, 
            marginTop: 10,
            borderRadius: 5
          }}>
            <Text style={{ 
              color: '#059669', 
              fontWeight: 'bold',
              textAlign: 'center',
              marginBottom: 5
            }}>
              VAT INCLUDED IN PRICES
            </Text>
            <Text style={{ textAlign: 'center' }}>
              VAT Rate: 16%
            </Text>
          </View>
          <Text style={styles.receiptInfo}>
            Payment Method: {receipt.payment_method.toUpperCase()}
          </Text>
        </View>

        {/* Products Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, styles.col1]}>Item</Text>
            <Text style={[styles.tableCell, styles.col2]}>Qty</Text>
            <Text style={[styles.tableCell, styles.col3]}>Price (VAT inc.)</Text>
            <Text style={[styles.tableCell, styles.col4]}>VAT Amount</Text>
            <Text style={[styles.tableCell, styles.col5]}>Total</Text>
          </View>

          {/* Table Rows */}
          {receipt.items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.col1]}>{item.name}</Text>
              <Text style={[styles.tableCell, styles.col2]}>{item.quantity}</Text>
              <Text style={[styles.tableCell, styles.col3]}>{item.price.toFixed(2)}</Text>
              <Text style={[styles.tableCell, styles.col4]}>
                {item.vat_amount > 0 ? item.vat_amount.toFixed(2) : 'Exempt'}
              </Text>
              <Text style={[styles.tableCell, styles.col5]}>{item.total.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>{(receipt.total - receipt.vat_total).toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>VAT Total:</Text>
            <Text style={styles.totalValue}>{receipt.vat_total.toFixed(2)}</Text>
          </View>
          {receipt.discount_amount && receipt.discount_amount > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, styles.discount]}>
                Discount {receipt.discount_type === 'percentage' && receipt.discount_value ? `(${receipt.discount_value}%)` : ''}:
              </Text>
              <Text style={[styles.totalValue, styles.discount]}>
                -{receipt.discount_amount.toFixed(2)}
              </Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalValue}>{receipt.total.toFixed(2)}</Text>
          </View>
          {receipt.cash_amount && (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Amount Received:</Text>
                <Text style={styles.totalValue}>{receipt.cash_amount.toFixed(2)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Balance:</Text>
                <Text style={styles.totalValue}>{receipt.balance?.toFixed(2)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Thank you for your business!</Text>
          <Text>This is a computer generated receipt and does not require a signature.</Text>
        </View>
      </Page>
    </Document>
  );
} 