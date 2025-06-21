'use client';

import React, { useState, useEffect } from 'react';
import { useUnifiedService } from '@/components/providers/UnifiedServiceProvider';
import { format } from 'date-fns';
import { saveAs } from 'file-saver';
import { useSimplifiedAuth } from '@/components/providers/SimplifiedAuthProvider';
import { toast } from 'sonner';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportData {
  data: Array<{
    id: string;
    product_id: string;
    quantity: number;
    total: number;
    vat_amount: number;
    payment_method: string;
    timestamp: string;
    sale_mode: 'retail' | 'wholesale';
    products: {
      name: string;
      sku: string | null;
      selling_price: number;
      vat_status: boolean;
      category: string | null;
      cost_price: number;
    };
    submission_type?: string;
  }>;
}

interface InputVatReportData {
  data: Array<{
    id: string;
    invoice_number: string;
    total: number;
    vat_amount: number;
    timestamp: string;
    submission_type: string;
    products: {
      name: string;
      sku: string | null;
      selling_price: number | null;
      vat_status: boolean;
      category: string;
      cost_price?: number;
    };
  }>;
}

interface InventoryReportData {
  data: Array<{
    id: string;
    name: string;
    sku: string | null;
    category: string | null;
    quantity: number;
    low_stock: boolean;
    retail_price: number | null;
    wholesale_price: number | null;
    wholesale_threshold: number | null;
  }>;
}

interface TableColumn {
  header: string;
  dataKey: string;
}

interface TableRow {
  [key: string]: string | number;
}

const DateRangePicker = ({ startDate, endDate, onStartDateChange, onEndDateChange, isSingleDay }: {
  startDate: Date;
  endDate: Date;
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date) => void;
  isSingleDay: boolean;
}) => {
  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-[240px] justify-start text-left font-normal",
              !startDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {startDate ? format(startDate, "PPP") : <span>{isSingleDay ? 'Select Date' : 'Start date'}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={startDate}
            onSelect={onStartDateChange}
            initialFocus
            required
          />
        </PopoverContent>
      </Popover>
      {!isSingleDay && <span>to</span>}
      {!isSingleDay && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[240px] justify-start text-left font-normal",
                !endDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, "PPP") : <span>End date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={onEndDateChange}
              initialFocus
              required
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'vat' | 'profitability' | 'overview'>('sales');
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().setDate(new Date().getDate() - 30)));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [isSingleDay, setIsSingleDay] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [salesData, setSalesData] = useState<ReportData | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryReportData | null>(null);
  const [inputVatData, setInputVatData] = useState<InputVatReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const { user, session, storeId, storeName } = useSimplifiedAuth();
  const { mode } = useSimplifiedAuth();
  const { currentMode, generateReports, generateInventoryReport, generateInputVatReport, generalReport } = useUnifiedService();
  const [generalData, setGeneralData] = useState<ReportData | null>(null);
  const [pdfLibrariesLoaded, setPdfLibrariesLoaded] = useState(false);
  const [pdfLibraries, setPdfLibraries] = useState<{ jsPDF: any; autoTable: any } | null>(null);
  
  const tabList = [
    { key: 'sales', label: 'Sales Report' },
    { key: 'inventory', label: 'Inventory Report' },
    { key: 'vat', label: 'VAT Report' },
    { key: 'profitability', label: 'Profitability Report' },
    { key: 'overview', label: 'Overview' },
  ];

  // Update end date when single day mode is toggled
  useEffect(() => {
    if (isSingleDay) {
      setEndDate(startDate);
    }
  }, [isSingleDay, startDate]);

  useEffect(() => {
    if (!user || !session) {
      toast.error('Please log in to access reports');
      return;
    }
  }, [user, session]);

  // Pre-load PDF libraries for offline support
  useEffect(() => {
    const loadPdfLibraries = async () => {
      try {
        console.log('📄 Loading PDF libraries for offline support...');
        const [jsPDFModule, autoTableModule] = await Promise.all([
          import('jspdf'),
          import('jspdf-autotable')
        ]);
        
        setPdfLibraries({
          jsPDF: jsPDFModule.default,
          autoTable: autoTableModule.default
        });
        setPdfLibrariesLoaded(true);
        console.log('📄 PDF libraries loaded successfully');
      } catch (error) {
        console.error('Error pre-loading PDF libraries:', error);
        // Don't show error toast here as it might be expected in offline mode
      }
    };

    loadPdfLibraries();
  }, []);

  // Data fetching effect
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!user || !session || !storeId) {
        toast.error('Authentication required. Please log in again.');
        return;
      }

      setIsLoading(true);
      try {
        if (activeTab === 'sales') {
          const startOfDay = new Date(startDate.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
          startOfDay.setHours(0, 0, 0, 0);
          
          let endOfDay: Date;
          
          if (isSingleDay) {
            endOfDay = new Date(startDate.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
            endOfDay.setHours(23, 59, 59, 999);
          } else {
            endOfDay = new Date(endDate.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
            endOfDay.setHours(23, 59, 59, 999);
          }

          const data = await generateReports(storeId!, startOfDay, endOfDay);
          console.log('🔍 Sales report data structure:', {
            data,
            dataType: typeof data,
            dataLength: data.length,
            data0: data[0],
            data0Type: typeof data[0]
          });
          if (isMounted) {
            // Fix: The data structure is [{ data: [...] }], so we need to access data[0].data
            const reportData = (data[0] as any)?.data || [];
            setSalesData({ data: reportData as ReportData['data'] });
          }
        } else if (activeTab === 'vat') {
          const startOfDay = new Date(startDate.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
          startOfDay.setHours(0, 0, 0, 0);
          
          let endOfDay: Date;
          
          if (isSingleDay) {
            endOfDay = new Date(startDate.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
            endOfDay.setHours(23, 59, 59, 999);
          } else {
            endOfDay = new Date(endDate.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
            endOfDay.setHours(23, 59, 59, 999);
          }

          const [outputVatData, inputVatData] = await Promise.all([
            generateReports(storeId!, startOfDay, endOfDay),
            generateInputVatReport(storeId!, startOfDay, endOfDay)
          ]);

          if (isMounted) {
            // Fix: The data structure is [{ data: [...] }], so we need to access data[0].data
            const outputReportData = (outputVatData[0] as any)?.data || [];
            const inputReportData = (inputVatData[0] as any)?.data || [];
            
            setSalesData({ data: outputReportData as ReportData['data'] });
            setInputVatData({ data: inputReportData as InputVatReportData['data'] });
          }
        } else if (activeTab === 'profitability') {
          const startOfDay = new Date(startDate.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
          startOfDay.setHours(0, 0, 0, 0);
          
          let endOfDay: Date;
          
          if (isSingleDay) {
            endOfDay = new Date(startDate.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
            endOfDay.setHours(23, 59, 59, 999);
          } else {
            endOfDay = new Date(endDate.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
            endOfDay.setHours(23, 59, 59, 999);
          }

          const data = await generateReports(storeId!, startOfDay, endOfDay);
          console.log('🔍 Profitability report data structure:', {
            data,
            dataType: typeof data,
            dataLength: data.length,
            data0: data[0],
            data0Type: typeof data[0]
          });
          if (isMounted) {
            // Fix: The data structure is [{ data: [...] }], so we need to access data[0].data
            const reportData = (data[0] as any)?.data || [];
            setSalesData({ data: reportData as ReportData['data'] });
          }
        } else if (activeTab === 'overview') {
          const startOfDay = new Date(startDate.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
          startOfDay.setHours(0, 0, 0, 0);
          let endOfDay: Date;
          if (isSingleDay) {
            endOfDay = new Date(startDate.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
            endOfDay.setHours(23, 59, 59, 999);
          } else {
            endOfDay = new Date(endDate.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
            endOfDay.setHours(23, 59, 59, 999);
          }
          const data = await generalReport(storeId!, startOfDay, endOfDay);
          console.log('🔍 generalReport data structure:', {
            data,
            dataType: typeof data,
            dataLength: data.length,
            data0: data[0],
            data0Type: typeof data[0],
            isArray: Array.isArray(data[0])
          });
          if (isMounted) {
            // Fix: The data structure is [{ data: [...] }], so we need to access data[0].data
            const reportData = (data[0] as any)?.data || [];
            setGeneralData({ data: reportData as ReportData['data'] });
          }
        } else {
          const data = await generateInventoryReport(storeId!);
          console.log('🔍 Inventory report data structure:', {
            data,
            dataType: typeof data,
            dataLength: data.length,
            data0: data[0],
            data0Type: typeof data[0]
          });
          if (isMounted) {
            // Fix: The data structure is [{ data: [...] }], so we need to access data[0].data
            const reportData = (data[0] as any)?.data || [];
            setInventoryData({ data: reportData as InventoryReportData['data'] });
          }
        }
      } catch (error) {
        console.error('Error fetching reports:', error);
        if (isMounted) {
          toast.error('Failed to fetch report data. Please try again.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [activeTab, startDate, endDate, isSingleDay, storeId, user, session, generateReports, generateInventoryReport, generateInputVatReport, generalReport]);

  // Export functions
  const exportToCSV = async () => {
    if (!user || !session || !storeId) {
      toast.error('Authentication required to export reports');
      return;
    }

    if (!salesData && !inventoryData && !generalData) {
      toast.error('No data available to export');
      return;
    }

    setIsExporting(true);
    try {
      let csvContent = '';
      let headers = '';
      let rows = '';

      if (activeTab === 'sales') {
        headers = 'Product,Quantity,Price,Total,Payment Method,Date\n';
        rows = filteredSalesData?.map(item => {
          const product = item.products?.name || 'Unknown';
          return `${product},${item.quantity},${(item.total / item.quantity).toFixed(2)},${item.total.toFixed(2)},${item.payment_method},${format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm')}`;
        }).join('\n') || '';
      } else if (activeTab === 'inventory') {
        headers = 'Product,SKU,Category,Quantity,Retail Price,Wholesale Price,Low Stock\n';
        rows = filteredInventoryData?.map(item => {
          return `${item.name},${item.sku || ''},${item.category || ''},${item.quantity},${item.retail_price?.toFixed(2) || ''},${item.wholesale_price?.toFixed(2) || ''},${item.low_stock ? 'Yes' : 'No'}`;
        }).join('\n') || '';
      } else if (activeTab === 'vat') {
        headers = 'Product,Type,Taxable Amount,VAT Amount,Date\n';
        const filteredVatData = getFilteredVatData();
        rows = filteredVatData.map(item => {
          const product = item.products?.name || 'Unknown';
          const type = item.submission_type === 'input_vat' ? 'Purchase' : 'Sale';
          return `${product},${type},${item.total},${item.vat_amount},${format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm')}`;
        }).join('\n') || '';
      } else if (activeTab === 'profitability') {
        headers = 'Product,Quantity,Revenue,Cost,Profit,Profit Margin,Date\n';
        rows = filteredSalesData?.map(item => {
          const costPrice = item.products?.cost_price || 0;
          const revenue = item.total;
          const cost = costPrice * item.quantity;
          const profit = revenue - cost;
          const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
          const product = item.products?.name || 'Unknown';
          return `${product},${item.quantity},${revenue.toFixed(2)},${cost.toFixed(2)},${profit.toFixed(2)},${profitMargin.toFixed(1)}%,${format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm')}`;
        }).join('\n') || '';
      } else if (activeTab === 'overview') {
        headers = 'Product,Quantity,Price,Total,Payment Method,Date\n';
        rows = filteredGeneralData?.map(item => {
          const product = item.products?.name || 'Unknown';
          return `${product},${item.quantity},${(item.total / item.quantity).toFixed(2)},${item.total.toFixed(2)},${item.payment_method},${format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm')}`;
        }).join('\n') || '';
      }

      csvContent = headers + rows;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      saveAs(blob, `${activeTab}_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      toast.success('CSV exported successfully');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export CSV. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPDF = async () => {
    if (!user || !session || !storeId) {
      toast.error('Authentication required to export reports');
      return;
    }

    if (!salesData && !inventoryData && !generalData) {
      toast.error('No data available to export');
      return;
    }

    setIsPdfLoading(true);
    try {
      // Check if we're offline and provide a helpful message
      if (mode !== 'online') {
        console.log('📄 PDF Export: Attempting to export in offline mode');
      }

      // Use pre-loaded libraries if available, otherwise try dynamic import
      let jsPDF, autoTable;
      
      if (pdfLibrariesLoaded && pdfLibraries) {
        jsPDF = pdfLibraries.jsPDF;
        autoTable = pdfLibraries.autoTable;
        console.log('📄 Using pre-loaded PDF libraries');
      } else {
        try {
          console.log('📄 Loading PDF libraries dynamically...');
          const [jsPDFModule, autoTableModule] = await Promise.all([
            import('jspdf'),
            import('jspdf-autotable')
          ]);
          jsPDF = jsPDFModule.default;
          autoTable = autoTableModule.default;
        } catch (importError) {
          console.error('Error importing PDF libraries:', importError);
          if (mode !== 'online') {
            toast.error('PDF export requires internet connection to load libraries. Please try again when online.');
          } else {
            toast.error('Failed to load PDF libraries. Please refresh the page and try again.');
          }
          return;
        }
      }

      const doc = new jsPDF();
      
      // Add title
      const title = `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Report`;
      doc.setFontSize(20);
      doc.text(title, 14, 20);
      
      // Add store info
      doc.setFontSize(12);
      doc.text(`Store: ${storeName || 'Unknown Store'}`, 14, 30);
      doc.text(`Date Range: ${format(startDate, 'dd/MM/yyyy')}${!isSingleDay ? ` - ${format(endDate, 'dd/MM/yyyy')}` : ''}`, 14, 37);
      doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 44);

      // Add summary data
      let yPosition = 65;
      
      if (activeTab === 'sales' && salesData) {
        const totals = calculateTotals();
        if (totals) {
          doc.setFontSize(14);
          doc.text('Summary', 14, yPosition);
          yPosition += 10;
          doc.setFontSize(10);
          doc.text(`Total Sales: KES ${totals.totalSales.toFixed(2)}`, 14, yPosition);
          yPosition += 7;
          doc.text(`Total Quantity: ${totals.totalQuantity}`, 14, yPosition);
          yPosition += 7;
          doc.text(`Average Sale: KES ${totals.averageSale.toFixed(2)}`, 14, yPosition);
          yPosition += 15;
        }
      } else if (activeTab === 'inventory' && inventoryData) {
        const totals = calculateInventoryTotals();
        if (totals) {
          doc.setFontSize(14);
          doc.text('Summary', 14, yPosition);
          yPosition += 10;
          doc.setFontSize(10);
          doc.text(`Total Products: ${totals.totalProducts}`, 14, yPosition);
          yPosition += 7;
          doc.text(`Total Quantity: ${totals.totalQuantity}`, 14, yPosition);
          yPosition += 7;
          doc.text(`Retail Value: KES ${totals.totalRetailValue.toFixed(2)}`, 14, yPosition);
          yPosition += 7;
          doc.text(`Wholesale Value: KES ${totals.totalWholesaleValue.toFixed(2)}`, 14, yPosition);
          yPosition += 15;
        }
      } else if (activeTab === 'vat' && salesData) {
        const totals = calculateVatTotals();
        if (totals) {
          doc.setFontSize(14);
          doc.text('Summary', 14, yPosition);
          yPosition += 10;
          doc.setFontSize(10);
          doc.text(`Output VAT: KES ${totals.output_vat_total.toFixed(2)}`, 14, yPosition);
          yPosition += 7;
          doc.text(`Input VAT: KES ${totals.input_vat_total.toFixed(2)}`, 14, yPosition);
          yPosition += 7;
          doc.text(`Net VAT: KES ${totals.net_vat.toFixed(2)}`, 14, yPosition);
          yPosition += 7;
          doc.text(`VAT Rate: 16%`, 14, yPosition);
          yPosition += 15;
        }
      } else if (activeTab === 'profitability' && salesData) {
        const totals = calculateProfitabilityTotals();
        if (totals) {
          doc.setFontSize(14);
          doc.text('Summary', 14, yPosition);
          yPosition += 10;
          doc.setFontSize(10);
          doc.text(`Total Revenue: KES ${totals.totalRevenue.toFixed(2)}`, 14, yPosition);
          yPosition += 7;
          doc.text(`Total Cost: KES ${totals.totalCost.toFixed(2)}`, 14, yPosition);
          yPosition += 7;
          doc.text(`Total Profit: KES ${totals.totalProfit.toFixed(2)}`, 14, yPosition);
          yPosition += 7;
          doc.text(`Avg. Profit Margin: ${totals.averageProfitMargin.toFixed(1)}%`, 14, yPosition);
          yPosition += 15;
        }
      } else if (activeTab === 'overview' && generalData) {
        const totals = calculateOverviewTotals();
        if (totals) {
          doc.setFontSize(14);
          doc.text('Summary', 14, yPosition);
          yPosition += 10;
          doc.setFontSize(10);
          doc.text(`Total Sales: KES ${totals.totalSales.toFixed(2)}`, 14, yPosition);
          yPosition += 7;
          doc.text(`Total Quantity: ${totals.totalQuantity}`, 14, yPosition);
          yPosition += 7;
          doc.text(`Average Sale: KES ${totals.averageSale.toFixed(2)}`, 14, yPosition);
          yPosition += 15;
        }
      }

      // Prepare table data
      let tableData: string[][] = [];
      let tableHeaders: string[] = [];

      if (activeTab === 'sales' && salesData) {
        tableHeaders = ['Product', 'Quantity', 'Price', 'Total', 'Payment Method', 'Date'];
        tableData = filteredSalesData?.map(item => [
          item.products?.name || 'Unknown',
          item.quantity.toString(),
          (item.total / item.quantity).toFixed(2),
          item.total.toFixed(2),
          item.payment_method,
          format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm')
        ]) || [];
      } else if (activeTab === 'inventory' && inventoryData) {
        tableHeaders = ['Product', 'SKU', 'Category', 'Quantity', 'Retail Price', 'Wholesale Price', 'Low Stock'];
        tableData = filteredInventoryData?.map(item => [
          item.name,
          item.sku || '-',
          item.category || '-',
          item.quantity.toString(),
          item.retail_price?.toFixed(2) || '-',
          item.wholesale_price?.toFixed(2) || '-',
          item.low_stock ? 'Yes' : 'No'
        ]) || [];
      } else if (activeTab === 'vat' && salesData) {
        tableHeaders = ['Product', 'Type', 'Taxable Amount', 'VAT Amount', 'Date'];
        const filteredVatData = getFilteredVatData();
        tableData = filteredVatData.map(item => [
          item.products?.name || 'Unknown',
          item.submission_type === 'input_vat' ? 'Purchase' : 'Sale',
          item.total.toFixed(2),
          item.vat_amount.toFixed(2),
          format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm')
        ]);
      } else if (activeTab === 'profitability' && salesData) {
        tableHeaders = ['Product', 'Sale Mode', 'Quantity', 'Revenue', 'Cost', 'Profit', 'Profit Margin', 'Date'];
        tableData = filteredSalesData?.map(item => {
          const costPrice = item.products?.cost_price || 0;
          const revenue = item.total;
          const cost = costPrice * item.quantity;
          const profit = revenue - cost;
          const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
          return [
            item.products?.name || 'Unknown',
            item.sale_mode || 'Unknown',
            item.quantity.toString(),
            revenue.toFixed(2),
            cost.toFixed(2),
            profit.toFixed(2),
            `${profitMargin.toFixed(1)}%`,
            format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm')
          ];
        }) || [];
      } else if (activeTab === 'overview' && generalData) {
        tableHeaders = ['Product', 'Quantity', 'Price', 'Total', 'Payment Method', 'Date'];
        tableData = filteredGeneralData?.map(item => [
          item.products?.name || 'Unknown',
          item.quantity.toString(),
          (item.total / item.quantity).toFixed(2),
          item.total.toFixed(2),
          item.payment_method,
          format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm')
        ]) || [];
      }

      // Add table if there's data
      if (tableData.length > 0) {
        autoTable(doc, {
          head: [tableHeaders],
          body: tableData,
          startY: yPosition,
          styles: {
            fontSize: 8,
            cellPadding: 2,
          },
          headStyles: {
            fillColor: [66, 139, 202],
            textColor: 255,
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245],
          },
        });
      } else {
        // Add no data message
        doc.setFontSize(12);
        doc.text('No data available for the selected date range', 14, yPosition);
      }

      // Save the PDF
      const fileName = `${activeTab}_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(fileName);
      toast.success('PDF exported successfully');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF. Please try again.');
    } finally {
      setIsPdfLoading(false);
    }
  };

  // Calculation functions
  const calculateTotals = () => {
    if (!salesData?.data) return null;

    const totals = salesData.data.reduce((acc, item) => ({
      totalSales: acc.totalSales + (item.total || 0),
      totalQuantity: acc.totalQuantity + (item.quantity || 0),
      averageSale: (acc.totalSales + (item.total || 0)) / (acc.totalQuantity + (item.quantity || 0))
    }), {
      totalSales: 0,
      totalQuantity: 0,
      averageSale: 0
    });

    return totals;
  };

  const calculateOverviewTotals = () => {
    if (!generalData?.data || !Array.isArray(generalData.data)) return null;

    const totals = generalData.data.reduce((acc, item) => ({
      totalSales: acc.totalSales + (item.total || 0),
      totalQuantity: acc.totalQuantity + (item.quantity || 0),
      averageSale: (acc.totalSales + (item.total || 0)) / (acc.totalQuantity + (item.quantity || 0))
    }), {
      totalSales: 0,
      totalQuantity: 0,
      averageSale: 0
    });

    return totals;
  };

  const calculateInventoryTotals = () => {
    if (!inventoryData?.data) return null;

    return inventoryData.data.reduce((acc, item) => ({
      totalProducts: acc.totalProducts + 1,
      totalQuantity: acc.totalQuantity + (item.quantity || 0),
      totalRetailValue: acc.totalRetailValue + ((item.retail_price || 0) * (item.quantity || 0)),
      totalWholesaleValue: acc.totalWholesaleValue + ((item.wholesale_price || 0) * (item.quantity || 0))
    }), {
      totalProducts: 0,
      totalQuantity: 0,
      totalRetailValue: 0,
      totalWholesaleValue: 0
    });
  };

  const calculateVatTotals = () => {
    if (!salesData?.data || !inputVatData?.data) return null;

    const outputVatTotal = salesData.data.reduce((sum, item) => sum + (item.vat_amount || 0), 0);
    const inputVatTotal = inputVatData.data.reduce((sum, item) => sum + (item.vat_amount || 0), 0);
    const netVat = outputVatTotal - inputVatTotal;

    return {
      output_vat_total: outputVatTotal,
      input_vat_total: inputVatTotal,
      net_vat: netVat
    };
  };

  const calculateProfitabilityTotals = () => {
    if (!salesData?.data) return null;

    const totals = salesData.data.reduce((acc, item) => {
      const costPrice = item.products?.cost_price || 0;
      const sellingPrice = item.total;
      const cost = costPrice * item.quantity;
      const profit = sellingPrice - cost;
      const profitMargin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;

      return {
        totalRevenue: acc.totalRevenue + sellingPrice,
        totalCost: acc.totalCost + cost,
        totalProfit: acc.totalProfit + profit,
        totalQuantity: acc.totalQuantity + item.quantity,
        averageProfitMargin: acc.averageProfitMargin + profitMargin
      };
    }, {
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      totalQuantity: 0,
      averageProfitMargin: 0
    });

    if (salesData.data.length > 0) {
      totals.averageProfitMargin = totals.averageProfitMargin / salesData.data.length;
    }

    return totals;
  };

  // Filtering functions
  const filteredSalesData = salesData?.data.filter(item => {
    const matchesSearch = item.products?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.products?.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Remove the duplicate VAT filtering since getSalesReport already handles this
    // The data from getSalesReport is already filtered to exclude VATable products with 0 VAT
    return matchesSearch;
  });

  const filteredInventoryData = inventoryData?.data.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFilteredVatData = () => {
    const allVatData = [...(filteredSalesData || []), ...(inputVatData?.data || [])];
    
    const filteredData = allVatData.filter(item => {
      const matchesSearch = item.products?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.products?.sku?.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;
      
      // Check if this is input VAT data
      const isInputVat = item.submission_type === 'input_vat';
      
      if (isInputVat) {
        // For input VAT: only show items with VAT amount > 0
        return (item.vat_amount || 0) > 0;
      } else {
        // For output VAT: use existing logic - filter out rows that are VATable but have 0 VAT amounts
        const isVatable = item.products?.vat_status === true;
        if (isVatable) {
          return (item.vat_amount || 0) > 0;
        }
        return true;
      }
    });
    
    return filteredData;
  };

  // Overview data filtering - no VAT filtering, just search
  const filteredGeneralData = Array.isArray(generalData?.data) ? generalData.data.filter(item => {
    const matchesSearch = item.products?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.products?.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  }) : [];

  // Debug logging for overview data
  console.log('🔍 Overview data debug:', {
    generalData,
    generalDataType: typeof generalData,
    generalDataData: generalData?.data,
    generalDataDataType: typeof generalData?.data,
    isArray: Array.isArray(generalData?.data),
    filteredGeneralData,
    filteredGeneralDataLength: filteredGeneralData?.length
  });

  // Summary cards
  const renderSummaryCards = () => {
    if (isLoading) return null;

    if (activeTab === 'sales' && salesData) {
      const totals = calculateTotals();
      if (!totals) return null;

      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Total Sales</h3>
            <p className="text-2xl font-bold">KES {totals.totalSales.toFixed(2)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Total Quantity</h3>
            <p className="text-2xl font-bold">{totals.totalQuantity}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Average Sale</h3>
            <p className="text-2xl font-bold">KES {totals.averageSale.toFixed(2)}</p>
          </div>
        </div>
      );
    }

    if (activeTab === 'inventory' && inventoryData) {
      const totals = calculateInventoryTotals();
      if (!totals) return null;

      return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Total Products</h3>
            <p className="text-2xl font-bold">{totals.totalProducts}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Total Quantity</h3>
            <p className="text-2xl font-bold">{totals.totalQuantity}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Retail Value</h3>
            <p className="text-2xl font-bold">KES {totals.totalRetailValue.toFixed(2)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Wholesale Value</h3>
            <p className="text-2xl font-bold">KES {totals.totalWholesaleValue.toFixed(2)}</p>
          </div>
        </div>
      );
    }

    if (activeTab === 'vat' && salesData) {
      const totals = calculateVatTotals();
      if (!totals) return null;

      return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Output VAT</h3>
            <p className="text-2xl font-bold">KES {totals.output_vat_total.toFixed(2)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Input VAT</h3>
            <p className="text-2xl font-bold">KES {totals.input_vat_total.toFixed(2)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Net VAT</h3>
            <p className="text-2xl font-bold">KES {totals.net_vat.toFixed(2)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">VAT Rate</h3>
            <p className="text-2xl font-bold">16%</p>
          </div>
        </div>
      );
    }

    if (activeTab === 'profitability' && salesData) {
      const totals = calculateProfitabilityTotals();
      if (!totals) return null;

      return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Total Revenue</h3>
            <p className="text-2xl font-bold">KES {totals.totalRevenue.toFixed(2)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Total Cost</h3>
            <p className="text-2xl font-bold">KES {totals.totalCost.toFixed(2)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Total Profit</h3>
            <p className="text-2xl font-bold text-green-600">KES {totals.totalProfit.toFixed(2)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Avg. Profit Margin</h3>
            <p className="text-2xl font-bold text-green-600">{totals.averageProfitMargin.toFixed(1)}%</p>
          </div>
        </div>
      );
    }

    if (activeTab === 'overview' && generalData) {
      const totals = calculateOverviewTotals();
      if (!totals) return null;

      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Total Sales</h3>
            <p className="text-2xl font-bold">KES {totals.totalSales.toFixed(2)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Total Quantity</h3>
            <p className="text-2xl font-bold">{totals.totalQuantity}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Average Sale</h3>
            <p className="text-2xl font-bold">KES {totals.averageSale.toFixed(2)}</p>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Reports</h1>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex border-b border-gray-200">
            {tabList.map(tab => (
              <button
                key={tab.key}
                className={`px-4 py-2 -mb-px border-b-4 transition-colors duration-200 font-medium
                  ${activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-blue-600'}`}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          {/* Export buttons */}
          <div className="flex gap-2">
            <button
              onClick={exportToCSV}
              disabled={isExporting || isLoading}
              className={`px-4 py-2 bg-green-500 text-white rounded ${(isExporting || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isExporting ? 'Exporting...' : 'Export to CSV'}
            </button>
            {((activeTab === 'sales' && salesData) || 
              (activeTab === 'inventory' && inventoryData) || 
              (activeTab === 'vat' && salesData) ||
              (activeTab === 'profitability' && salesData) ||
              (activeTab === 'overview' && generalData)) && !isLoading && (
              <button
                onClick={exportToPDF}
                disabled={isPdfLoading || (!pdfLibrariesLoaded && mode !== 'online')}
                className={`px-4 py-2 bg-red-500 text-white rounded ${(isPdfLoading || (!pdfLibrariesLoaded && mode !== 'online')) ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={(!pdfLibrariesLoaded && mode !== 'online') ? 'PDF libraries not loaded. Please try again when online.' : ''}
              >
                {isPdfLoading ? 'Generating PDF...' : 'Export to PDF'}
              </button>
            )}
          </div>
        </div>

        {/* Date picker and search */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex flex-wrap gap-4 flex-grow">
            {(activeTab === 'sales' || activeTab === 'vat' || activeTab === 'profitability' || activeTab === 'overview') && (
              <>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={isSingleDay}
                      onChange={(e) => setIsSingleDay(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    Single Day
                  </label>
                </div>
                <DateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                  isSingleDay={isSingleDay}
                />
              </>
            )}
            <div className="relative flex-grow">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by product name, SKU, or category..."
                className="border-2 border-blue-400 focus:border-blue-600 rounded px-2 py-1 w-full transition-colors duration-200"
              />
            </div>
          </div>
        </div>

        {renderSummaryCards()}
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading report data...</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          {/* Sales Report Table */}
          {activeTab === 'sales' && salesData && (
            <table className="min-w-full bg-white">
              <thead>
                <tr>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Quantity</th>
                  <th className="px-4 py-2">Price</th>
                  <th className="px-4 py-2">Total</th>
                  <th className="px-4 py-2">Payment Method</th>
                  <th className="px-4 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredSalesData?.map((item, index) => (
                  <tr key={`${item.id}-${item.timestamp}-${index}`}>
                    <td className="border px-4 py-2">{item.products?.name || 'Unknown'}</td>
                    <td className="border px-4 py-2">{item.quantity}</td>
                    <td className="border px-4 py-2">{(item.total / item.quantity).toFixed(2)}</td>
                    <td className="border px-4 py-2">{item.total.toFixed(2)}</td>
                    <td className="border px-4 py-2">{item.payment_method}</td>
                    <td className="border px-4 py-2">{format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Inventory Report Table */}
          {activeTab === 'inventory' && inventoryData && (
            <table className="min-w-full bg-white">
              <thead>
                <tr>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">SKU</th>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2">Quantity</th>
                  <th className="px-4 py-2">Retail Price</th>
                  <th className="px-4 py-2">Wholesale Price</th>
                  <th className="px-4 py-2">Low Stock</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventoryData?.map((item) => (
                  <tr key={item.id}>
                    <td className="border px-4 py-2">{item.name}</td>
                    <td className="border px-4 py-2">{item.sku || '-'}</td>
                    <td className="border px-4 py-2">{item.category || '-'}</td>
                    <td className="border px-4 py-2">{item.quantity}</td>
                    <td className="border px-4 py-2">{item.retail_price?.toFixed(2) || '-'}</td>
                    <td className="border px-4 py-2">{item.wholesale_price?.toFixed(2) || '-'}</td>
                    <td className="border px-4 py-2">{item.low_stock ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* VAT Report Table */}
          {activeTab === 'vat' && salesData && (
            <table className="min-w-full bg-white">
              <thead>
                <tr>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Taxable Amount</th>
                  <th className="px-4 py-2">VAT Amount</th>
                  <th className="px-4 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {getFilteredVatData().length > 0 ? (
                  getFilteredVatData().map((item) => (
                    <tr key={`${item.id}-${item.submission_type || 'sale'}`}>
                      <td className="border px-4 py-2">{item.products?.name || 'Unknown'}</td>
                      <td className="border px-4 py-2">{item.submission_type === 'input_vat' ? 'Purchase' : 'Sale'}</td>
                      <td className="border px-4 py-2">{item.total.toFixed(2)}</td>
                      <td className="border px-4 py-2">{item.vat_amount.toFixed(2)}</td>
                      <td className="border px-4 py-2">{format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm')}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="border px-4 py-2 text-center text-gray-500">
                      <div className="py-4">
                        <p className="text-sm">No VAT data available for the selected date range</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Input VAT data appears when you add stock with VAT amounts greater than 0
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* Profitability Report Table */}
          {activeTab === 'profitability' && salesData && (
            <table className="min-w-full bg-white">
              <thead>
                <tr>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Sale Mode</th>
                  <th className="px-4 py-2">Quantity</th>
                  <th className="px-4 py-2">Revenue</th>
                  <th className="px-4 py-2">Cost</th>
                  <th className="px-4 py-2">Profit</th>
                  <th className="px-4 py-2">Profit Margin</th>
                  <th className="px-4 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredSalesData?.map((item) => {
                  const costPrice = item.products?.cost_price || 0;
                  const revenue = item.total;
                  const cost = costPrice * item.quantity;
                  const profit = revenue - cost;
                  const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

                  return (
                    <tr key={`${item.id}-${item.product_id}-${item.timestamp}`}>
                      <td className="border px-4 py-2">{item.products?.name || 'Unknown'}</td>
                      <td className="border px-4 py-2">{item.sale_mode || 'Unknown'}</td>
                      <td className="border px-4 py-2">{item.quantity}</td>
                      <td className="border px-4 py-2">{revenue.toFixed(2)}</td>
                      <td className="border px-4 py-2">{cost.toFixed(2)}</td>
                      <td className="border px-4 py-2">{profit.toFixed(2)}</td>
                      <td className="border px-4 py-2">{profitMargin.toFixed(1)}%</td>
                      <td className="border px-4 py-2">{format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Overview Report Table */}
          {activeTab === 'overview' && generalData && (
            <table className="min-w-full bg-white">
              <thead>
                <tr>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Quantity</th>
                  <th className="px-4 py-2">Price</th>
                  <th className="px-4 py-2">Total</th>
                  <th className="px-4 py-2">Payment Method</th>
                  <th className="px-4 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredGeneralData && filteredGeneralData.length > 0 ? (
                  filteredGeneralData.map((item, index) => (
                    <tr key={`${item.id}-${item.timestamp}-${index}`}>
                      <td className="border px-4 py-2">{item.products?.name || 'Unknown'}</td>
                      <td className="border px-4 py-2">{item.quantity}</td>
                      <td className="border px-4 py-2">{(item.total / item.quantity).toFixed(2)}</td>
                      <td className="border px-4 py-2">{item.total.toFixed(2)}</td>
                      <td className="border px-4 py-2">{item.payment_method}</td>
                      <td className="border px-4 py-2">{format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm')}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="border px-4 py-2 text-center text-gray-500">
                      No data available for the selected date range
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
} 