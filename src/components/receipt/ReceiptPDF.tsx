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
    padding: 30,
    fontFamily: 'Roboto'
  },
  header: {
    marginBottom: 20,
    borderBottom: '1 solid #000',
    paddingBottom: 10
  },
  storeName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5
  },
  storeAddress: {
    fontSize: 12,
    marginBottom: 5
  },
  receiptInfo: {
    fontSize: 10,
    marginBottom: 5
  },
  table: {
    display: 'flex',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#000',
    marginTop: 20
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    borderBottomStyle: 'solid',
    minHeight: 30,
    alignItems: 'center'
  },
  tableHeader: {
    backgroundColor: '#f0f0f0'
  },
  tableCell: {
    padding: 5,
    fontSize: 10
  },
  col1: { width: '40%' },
  col2: { width: '15%' },
  col3: { width: '15%' },
  col4: { width: '15%' },
  col5: { width: '15%' },
  totals: {
    marginTop: 20,
    alignItems: 'flex-end'
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 5
  },
  totalLabel: {
    width: 100,
    fontSize: 12,
    fontWeight: 'bold'
  },
  totalValue: {
    width: 100,
    fontSize: 12,
    textAlign: 'right'
  },
  footer: {
    marginTop: 30,
    fontSize: 10,
    textAlign: 'center'
  }
});

interface ReceiptPDFProps {
  receipt: {
    store: {
      name: string;
      address: string;
    };
    sale: {
      id: string;
      created_at: string;
      payment_method: string;
      subtotal: number;
      vat_total: number;
      total: number;
      products: Array<{
        name: string;
        quantity: number;
        price: number;
        vat_amount: number;
        vat_status: string;
        total: number;
      }>;
    };
  };
}

export const ReceiptPDF = ({ receipt }: ReceiptPDFProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.storeName}>{receipt.store.name}</Text>
        <Text style={styles.storeAddress}>{receipt.store.address}</Text>
        <Text style={styles.receiptInfo}>
          Receipt No: {receipt.sale.id}
        </Text>
        <Text style={styles.receiptInfo}>
          Date: {(() => {
            const d = new Date(receipt.sale.created_at);
            return isNaN(d.getTime()) ? 'N/A' : format(d, 'dd/MM/yyyy HH:mm');
          })()}
        </Text>
        <Text style={styles.receiptInfo}>
          Payment Method: {receipt.sale.payment_method.toUpperCase()}
        </Text>
      </View>

      {/* Products Table */}
      <View style={styles.table}>
        {/* Table Header */}
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.tableCell, styles.col1]}>Item</Text>
          <Text style={[styles.tableCell, styles.col2]}>Qty</Text>
          <Text style={[styles.tableCell, styles.col3]}>Price</Text>
          <Text style={[styles.tableCell, styles.col4]}>VAT</Text>
          <Text style={[styles.tableCell, styles.col5]}>Total</Text>
        </View>

        {/* Table Rows */}
        {receipt.sale.products.map((product, index) => (
          <View key={index} style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.col1]}>{product.name}</Text>
            <Text style={[styles.tableCell, styles.col2]}>{product.quantity}</Text>
            <Text style={[styles.tableCell, styles.col3]}>{product.price.toFixed(2)}</Text>
            <Text style={[styles.tableCell, styles.col4]}>{product.vat_amount.toFixed(2)}</Text>
            <Text style={[styles.tableCell, styles.col5]}>{product.total.toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {/* Totals */}
      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal:</Text>
          <Text style={styles.totalValue}>{receipt.sale.subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>VAT Total:</Text>
          <Text style={styles.totalValue}>{receipt.sale.vat_total.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={styles.totalValue}>{receipt.sale.total.toFixed(2)}</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text>Thank you for your business!</Text>
        <Text>This is a computer generated receipt and does not require a signature.</Text>
      </View>
    </Page>
  </Document>
); 