'use client';

import React, { useState, useEffect } from 'react';
import { useSync } from '@/hooks/useSync';
import { format } from 'date-fns';
import { saveAs } from 'file-saver';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const { user, session, storeId, storeName } = useAuth();
  const { generateReports, generateInventoryReport, generateInputVatReport, generalReport } = useSync(storeId || '');
  const { isOnline } = useAuth();
  const [generalData, setGeneralData] = useState<ReportData | null>(null);
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
          // Convert the selected dates to Kenya timezone
          // The date picker provides dates in local timezone, but we need Kenya timezone
          const startOfDay = new Date(startDate.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
          startOfDay.setHours(0, 0, 0, 0);
          
          let endOfDay: Date;
          
          if (isSingleDay) {
            // For single day mode, use the same date for both start and end
            endOfDay = new Date(startDate.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
            endOfDay.setHours(23, 59, 59, 999);
          } else {
            // For date range mode, use the end date
            endOfDay = new Date(endDate.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
            endOfDay.setHours(23, 59, 59, 999);
          }

          console.log('📅 Reports page - Date range being sent:', {
            isSingleDay,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            startOfDay: startOfDay.toISOString(),
            endOfDay: endOfDay.toISOString(),
            startOfDayLocal: startOfDay.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }),
            endOfDayLocal: endOfDay.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })
          });

          const data = await generateReports(startOfDay, endOfDay);
          if (isMounted) {
            setSalesData(data);
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
            generateReports(startOfDay, endOfDay),
            generateInputVatReport(startOfDay, endOfDay)
          ]);

          if (isMounted) {
            setSalesData(outputVatData);
            setInputVatData(inputVatData);
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

          const data = await generateReports(startOfDay, endOfDay);
          if (isMounted) {
            setSalesData(data);
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
          const data = await generalReport(startOfDay, endOfDay);
          if (isMounted) {
            setGeneralData({ data });
          }
        } else {
          const data = await generateInventoryReport();
          if (isMounted) {
            setInventoryData(data);
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
  }, [activeTab, startDate, endDate, isSingleDay, storeId, user, session]);

  const exportToCSV = async () => {
    if (!user || !session || !storeId) {
      toast.error('Authentication required to export reports');
      return;
    }

    if (!salesData && !inventoryData) {
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
        rows = salesData?.data.map(item => {
          const product = item.products?.name || 'Unknown';
          return `${product},${item.quantity},${item.total},${item.total + item.vat_amount},${item.payment_method},${format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm')}`;
        }).join('\n') || '';
      } else if (activeTab === 'inventory') {
        headers = 'Product,SKU,Category,Quantity,Retail Price,Wholesale Price,Low Stock\n';
        rows = inventoryData?.data.map(item => {
          return `${item.name},${item.sku || ''},${item.category || ''},${item.quantity},${item.retail_price?.toFixed(2) || ''},${item.wholesale_price?.toFixed(2) || ''},${item.low_stock ? 'Yes' : 'No'}`;
        }).join('\n') || '';
      } else if (activeTab === 'vat') {
        headers = 'Product,Type,Taxable Amount,VAT Amount,Date\n';
        const allVatData = [...(salesData?.data || []), ...(inputVatData?.data || [])];
        rows = allVatData.map(item => {
          const product = item.products?.name || 'Unknown';
          const type = item.submission_type === 'input_vat' ? 'Purchase' : 'Sale';
          return `${product},${type},${item.total},${item.vat_amount},${format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm')}`;
        }).join('\n') || '';
      } else if (activeTab === 'profitability') {
        headers = 'Product,Quantity,Revenue,Cost,Profit,Profit Margin,Date\n';
        rows = salesData?.data.map(item => {
          const costPrice = item.products?.cost_price || 0;
          const revenue = item.total;
          const cost = costPrice * item.quantity;
          const profit = revenue - cost;
          const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
          const product = item.products?.name || 'Unknown';
          return `${product},${item.quantity},${revenue.toFixed(2)},${cost.toFixed(2)},${profit.toFixed(2)},${profitMargin.toFixed(1)}%,${format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm')}`;
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

      console.log('🔍 Profitability calculation:', {
        product: item.products?.name,
        costPrice,
        sellingPrice,
        quantity: item.quantity,
        cost,
        profit,
        profitMargin,
        saleMode: item.sale_mode
      });

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

  const filteredSalesData = salesData?.data.filter(item => {
    const matchesSearch = item.products?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.products?.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const filteredInventoryData = inventoryData?.data.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Helper function to filter VAT data - exclude rows with zero VAT amounts
  const getFilteredVatData = () => {
    const allVatData = [...(filteredSalesData || []), ...(inputVatData?.data || [])];
    return allVatData.filter(item => {
      const isVatable = item.products?.vat_status === true;
      if (isVatable) {
        return (item.vat_amount || 0) > 0;
      }
      // For zero-rated/exempted, always include
      return true;
    });
  };

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

    return null;
  };

  const handlePdfExport = async () => {
    if (!user || !session || !storeId) {
      toast.error('Authentication required to export PDF');
      return;
    }

    setIsPdfLoading(true);
    try {
      let reportData;
      let reportTotals;

      if (activeTab === 'sales' || activeTab === 'vat') {
        reportData = salesData;
        reportTotals = activeTab === 'vat' ? calculateVatTotals() : calculateTotals();
      } else if (activeTab === 'overview') {
        reportData = generalData;
        reportTotals = null; // Optionally, you can calculate totals for overview if needed
      } else {
        reportData = inventoryData;
        reportTotals = calculateInventoryTotals();
      }

      if (!reportData) {
        throw new Error('No data available to export');
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      doc.setFontSize(20);
      doc.text(`${storeName || 'Your Store'} - ${activeTab.toUpperCase()} Report`, pageWidth / 2, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text(`Date Range: ${format(startDate, 'dd/MM/yyyy')}${isSingleDay ? '' : ` to ${format(endDate, 'dd/MM/yyyy')}`}`, pageWidth / 2, 30, { align: 'center' });
      
      if (!isOnline) {
        doc.setFontSize(10);
        doc.setTextColor(255, 0, 0);
        doc.text('OFFLINE DATA', pageWidth / 2, 40, { align: 'center' });
        doc.setTextColor(0, 0, 0);
      }

      doc.setFontSize(12);
      doc.text('Summary:', 14, 50);
      
      if (activeTab === 'sales') {
        const salesTotals = reportTotals as { totalSales: number; totalQuantity: number; averageSale: number };
        doc.setFontSize(10);
        doc.text(`Total Sales: KES ${salesTotals.totalSales.toFixed(2)}`, 20, 60);
        doc.text(`Total Quantity: ${salesTotals.totalQuantity}`, 20, 70);
      } else if (activeTab === 'vat') {
        const vatTotals = reportTotals as { output_vat_total: number; input_vat_total: number; net_vat: number };
        doc.setFontSize(10);
        doc.text(`Output VAT: KES ${vatTotals.output_vat_total.toFixed(2)}`, 20, 60);
        doc.text(`Input VAT: KES ${vatTotals.input_vat_total.toFixed(2)}`, 20, 70);
        doc.text(`Net VAT: KES ${vatTotals.net_vat.toFixed(2)}`, 20, 80);
      } else if (activeTab === 'profitability') {
        const profitabilityTotals = calculateProfitabilityTotals();
        if (profitabilityTotals) {
          doc.setFontSize(10);
          doc.text(`Total Revenue: KES ${profitabilityTotals.totalRevenue.toFixed(2)}`, 20, 60);
          doc.text(`Total Cost: KES ${profitabilityTotals.totalCost.toFixed(2)}`, 20, 70);
          doc.text(`Total Profit: KES ${profitabilityTotals.totalProfit.toFixed(2)}`, 20, 80);
          doc.text(`Avg. Profit Margin: ${profitabilityTotals.averageProfitMargin.toFixed(1)}%`, 20, 90);
        }
      } else if (activeTab === 'overview') {
        // Optionally, add summary for overview if needed
      } else {
        const inventoryTotals = reportTotals as { totalProducts: number; totalQuantity: number; totalRetailValue: number; totalWholesaleValue: number };
        doc.setFontSize(10);
        doc.text(`Total Products: ${inventoryTotals.totalProducts}`, 20, 60);
        doc.text(`Total Quantity: ${inventoryTotals.totalQuantity}`, 20, 70);
        doc.text(`Retail Value: KES ${inventoryTotals.totalRetailValue.toFixed(2)}`, 20, 80);
        doc.text(`Wholesale Value: KES ${inventoryTotals.totalWholesaleValue.toFixed(2)}`, 20, 90);
      }

      let tableData: TableRow[] = [];
      let columns: TableColumn[] = [];

      if (activeTab === 'sales' || activeTab === 'overview') {
        columns = [
          { header: 'Product', dataKey: 'product' },
          { header: 'Quantity', dataKey: 'quantity' },
          { header: 'Price', dataKey: 'price' },
          { header: 'Total', dataKey: 'total' },
          { header: 'Payment Method', dataKey: 'payment' },
          { header: 'Date', dataKey: 'date' }
        ];
        tableData = (reportData as ReportData).data.map(item => ({
          product: item.products?.name || 'Unknown',
          quantity: item.quantity,
          price: item.total.toFixed(2),
          total: (item.total + item.vat_amount).toFixed(2),
          payment: item.payment_method,
          date: format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm')
        }));
      } else if (activeTab === 'inventory') {
        columns = [
          { header: 'Product', dataKey: 'product' },
          { header: 'SKU', dataKey: 'sku' },
          { header: 'Category', dataKey: 'category' },
          { header: 'Quantity', dataKey: 'quantity' },
          { header: 'Retail Price', dataKey: 'retail' },
          { header: 'Wholesale Price', dataKey: 'wholesale' },
          { header: 'Low Stock', dataKey: 'lowStock' }
        ];
        tableData = (reportData as InventoryReportData).data.map(item => ({
          product: item.name,
          sku: item.sku || '-',
          category: item.category || '-',
          quantity: item.quantity,
          retail: item.retail_price?.toFixed(2) || '-',
          wholesale: item.wholesale_price?.toFixed(2) || '-',
          lowStock: item.low_stock ? 'Yes' : 'No'
        }));
      } else if (activeTab === 'vat') {
        columns = [
          { header: 'Product', dataKey: 'product' },
          { header: 'Type', dataKey: 'type' },
          { header: 'Taxable Amount', dataKey: 'taxable' },
          { header: 'VAT Amount', dataKey: 'vat' },
          { header: 'Date', dataKey: 'date' }
        ];
        tableData = getFilteredVatData().map((item, index) => ({
          product: item.products?.name || 'Unknown',
          type: item.submission_type === 'input_vat' ? 'Purchase' : 'Sale',
          taxable: item.total.toFixed(2),
          vat: item.vat_amount.toFixed(2),
          date: format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm')
        }));
      } else if (activeTab === 'profitability') {
        columns = [
          { header: 'Product', dataKey: 'product' },
          { header: 'Sale Mode', dataKey: 'saleMode' },
          { header: 'Quantity', dataKey: 'quantity' },
          { header: 'Revenue', dataKey: 'revenue' },
          { header: 'Cost', dataKey: 'cost' },
          { header: 'Profit', dataKey: 'profit' },
          { header: 'Profit Margin', dataKey: 'margin' },
          { header: 'Date', dataKey: 'date' }
        ];
        tableData = (reportData as ReportData).data.map(item => {
          const costPrice = item.products?.cost_price || 0;
          const revenue = item.total;
          const cost = costPrice * item.quantity;
          const profit = revenue - cost;
          const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
          
          return {
            product: item.products?.name || 'Unknown',
            saleMode: item.sale_mode || 'Unknown',
            quantity: item.quantity,
            revenue: revenue.toFixed(2),
            cost: cost.toFixed(2),
            profit: profit.toFixed(2),
            margin: `${profitMargin.toFixed(1)}%`,
            date: format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm')
          };
        });
      }

      autoTable(doc, {
        head: [columns.map(col => col.header)],
        body: tableData.map(row => columns.map(col => row[col.dataKey])),
        startY: activeTab === 'inventory' ? 100 : activeTab === 'profitability' ? 110 : 90,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 139, 202] }
      });

      const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}${!isOnline ? ' (Offline Mode)' : ''}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      doc.save(`${activeTab}_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('PDF exported successfully');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF. Please try again.');
    } finally {
      setIsPdfLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Reports</h1>
        {/* Tab navigation and export buttons in same row */}
        <div className="flex items-center justify-between mb-4">
          {/* Tab Navigation */}
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
          
          {/* Export buttons on the far right */}
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
                onClick={handlePdfExport}
                disabled={isPdfLoading}
                className={`px-4 py-2 bg-red-500 text-white rounded ${isPdfLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isPdfLoading ? 'Generating PDF...' : 'Export to PDF'}
              </button>
            )}
          </div>
        </div>

        {/* Date picker and search in separate row */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex flex-wrap gap-4 flex-grow">
            {(activeTab === 'sales' || activeTab === 'vat' || activeTab === 'profitability' || activeTab === 'overview') && (
              <>
                {/* Single Day Toggle */}
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
                {/* Date Range Picker */}
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
                    <td className="border px-4 py-2">{item.total.toFixed(2)}</td>
                    <td className="border px-4 py-2">{(item.total + item.vat_amount).toFixed(2)}</td>
                    <td className="border px-4 py-2">{item.payment_method}</td>
                    <td className="border px-4 py-2">{format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

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
                {getFilteredVatData().map((item, index) => (
                  <tr key={`${item.id}-${item.submission_type || 'sale'}-${index}`}>
                    <td className="border px-4 py-2">{item.products?.name || 'Unknown'}</td>
                    <td className="border px-4 py-2">{item.submission_type === 'input_vat' ? 'Purchase' : 'Sale'}</td>
                    <td className="border px-4 py-2">{item.total.toFixed(2)}</td>
                    <td className="border px-4 py-2">{item.vat_amount.toFixed(2)}</td>
                    <td className="border px-4 py-2">{format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

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
                      <td className="border px-4 py-2 capitalize">{item.sale_mode || 'Unknown'}</td>
                      <td className="border px-4 py-2">{item.quantity}</td>
                      <td className="border px-4 py-2">KES {revenue.toFixed(2)}</td>
                      <td className="border px-4 py-2">KES {cost.toFixed(2)}</td>
                      <td className={`border px-4 py-2 ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>KES {profit.toFixed(2)}</td>
                      <td className={`border px-4 py-2 ${profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{profitMargin.toFixed(1)}%</td>
                      <td className="border px-4 py-2">{format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

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
                {generalData.data
                  .filter(item => {
                    const matchesSearch = item.products?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      item.products?.sku?.toLowerCase().includes(searchQuery.toLowerCase());
                    return matchesSearch;
                  })
                  .map((item, index) => (
                    <tr key={`${item.id}-${item.timestamp}-${index}`}>
                      <td className="border px-4 py-2">{item.products?.name || 'Unknown'}</td>
                      <td className="border px-4 py-2">{item.quantity}</td>
                      <td className="border px-4 py-2">{item.total.toFixed(2)}</td>
                      <td className="border px-4 py-2">{(item.total + item.vat_amount).toFixed(2)}</td>
                      <td className="border px-4 py-2">{item.payment_method}</td>
                      <td className="border px-4 py-2">{format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm')}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
} 