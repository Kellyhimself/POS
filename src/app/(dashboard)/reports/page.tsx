"use client";
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/AuthProvider';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useSync } from '@/hooks/useSync';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { toast } from 'sonner';

const TABS = [
  { key: 'sales', label: 'Sales Report' },
  { key: 'inventory', label: 'Inventory Report' },
  { key: 'vat', label: 'VAT Report' },
];

// Types for API responses
interface Transaction {
  id: string;
  product_id: string;
  quantity: number;
  total: number;
  vat_amount: number | null;
  payment_method: string | null;
  timestamp: string | null;
  products: {
    name: string;
    sku: string | null;
    selling_price: number | null;
    vat_status: boolean | null;
    category: string | null;
  } | null;
}

interface ReportData {
  data: Transaction[];
}

interface TransformedSale {
  id: string;
  sale_id: string;
  created_at: string;
  product_id: string;
  name: string;
  sku: string | null;
  quantity: number;
  price: number;
  total: number;
  vat_amount: number | null;
  payment_method: string | null;
  category: string | null;
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

interface VatCategoryBreakdown {
  category: string;
  taxable_sales: number;
  vat_amount: number;
  exempt_sales: number;
}

// Add these utility functions at the top of the file after imports
const exportToCSV = <T extends Record<string, unknown>>(data: T[], filename: string) => {
  if (!data.length) {
    toast.error('No data to export');
    return;
  }
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => 
    Object.values(row).map(value => 
      typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
    ).join(',')
  );
  const csv = [headers, ...rows].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const exportToPDF = () => {
  // For now, we'll just show a message that PDF export is coming soon
  toast.info('PDF export functionality coming soon!');
};

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('sales');
  const { storeId, loading } = useAuth();
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [productName, setProductName] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const { generateReports, generateInventoryReport } = useSync(storeId || '');

  // Reset filters when tab changes
  function handleTabChange(tabKey: string) {
    setActiveTab(tabKey);
    setStartDate('');
    setEndDate('');
    setProductName('');
    setCategory('');
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (!storeId) return <div className="p-8 text-red-500">No store selected or user not authenticated.</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Reports</h1>
      <div className="flex flex-wrap items-end gap-4 mb-4">
        {(activeTab === 'sales' || activeTab === 'vat' || activeTab === 'inventory') && (
          <>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Product Name</label>
              <input
                type="text"
                className="border rounded px-2 py-1 text-sm"
                placeholder="Search product name..."
                value={productName}
                onChange={e => setProductName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <input
                type="text"
                className="border rounded px-2 py-1 text-sm"
                placeholder="Search category..."
                value={category}
                onChange={e => setCategory(e.target.value)}
              />
            </div>
          </>
        )}
        {(activeTab === 'sales' || activeTab === 'vat') && (
          <>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start Date</label>
              <input
                type="date"
                className="border rounded px-2 py-1 text-sm"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                max={endDate || undefined}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End Date</label>
              <input
                type="date"
                className="border rounded px-2 py-1 text-sm"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                min={startDate || undefined}
              />
            </div>
          </>
        )}
      </div>
      <div className="flex space-x-4 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`px-4 py-2 rounded-t-lg font-semibold border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[#0ABAB5] text-[#0ABAB5] bg-white'
                : 'border-transparent text-gray-500 bg-gray-100 hover:text-[#0ABAB5]'
            }`}
            onClick={() => handleTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-lg shadow p-6 min-h-[400px]">
        {activeTab === 'sales' && (
          <SalesReport
            storeId={storeId}
            startDate={startDate}
            endDate={endDate}
            productName={productName}
            category={category}
            generateReports={generateReports}
          />
        )}
        {activeTab === 'inventory' && (
          <InventoryReport
            storeId={storeId}
            productName={productName}
            category={category}
            generateInventoryReport={generateInventoryReport}
          />
        )}
        {activeTab === 'vat' && (
          <VatReport
            storeId={storeId}
            startDate={startDate}
            endDate={endDate}
            productName={productName}
            category={category}
            generateReports={generateReports}
          />
        )}
      </div>
    </div>
  );
}

function TotalsSection({ title, totals }: { title: string; totals: Array<{ label: string; value: number }> }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-4 border rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-t-lg"
      >
        <span className="font-semibold">{title}</span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5" />
        ) : (
          <ChevronDown className="w-5 h-5" />
        )}
      </button>
      {isOpen && (
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          {totals.map((total, index) => (
            <div key={index} className="bg-white p-3 rounded-lg shadow-sm">
              <div className="text-sm text-gray-500">{total.label}</div>
              <div className="text-lg font-semibold">KES {total.value.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SalesReport({ 
  storeId, 
  startDate, 
  endDate, 
  productName, 
  category,
  generateReports 
}: { 
  storeId: string; 
  startDate: string; 
  endDate: string; 
  productName: string; 
  category: string;
  generateReports: (startDate: Date, endDate: Date) => Promise<ReportData>;
}) {
  console.log('SalesReport - Props:', { storeId, startDate, endDate, productName, category });
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['sales-report', storeId, startDate, endDate, productName, category],
    queryFn: async () => {
      console.log('SalesReport - Starting data fetch');
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      console.log('SalesReport - Date range:', { start, end });
      
      const report = await generateReports(start, end);
      console.log('SalesReport - Raw report data:', report);
      
      // Filter by product name and category
      let filteredSales = report.data;
      if (productName) {
        filteredSales = filteredSales.filter((sale: Transaction) => 
          sale.products?.name?.toLowerCase().includes(productName.toLowerCase())
        );
      }
      if (category) {
        filteredSales = filteredSales.filter((sale: Transaction) => 
          sale.products?.category?.toLowerCase().includes(category.toLowerCase())
        );
      }
      console.log('SalesReport - Filtered sales:', filteredSales);

      // Transform the data to include all items in the sale
      const transformedSales: TransformedSale[] = filteredSales.map((sale: Transaction) => ({
        id: `${sale.id}`,
        sale_id: sale.id,
        created_at: sale.timestamp || new Date().toISOString(),
        product_id: sale.product_id,
        name: sale.products?.name || 'Unknown Product',
        sku: sale.products?.sku || null,
        quantity: sale.quantity,
        price: sale.quantity > 0 ? sale.total / sale.quantity : 0,
        total: sale.total,
        vat_amount: sale.vat_amount || 0,
        payment_method: sale.payment_method || 'Unknown',
        category: sale.products?.category || null
      }));
      console.log('SalesReport - Transformed sales:', transformedSales);

      return { data: transformedSales };
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  console.log('SalesReport - Query state:', { isLoading, error, data });

  const rows = data?.data || [];
  console.log('SalesReport - Final rows to display:', rows);
  
  // Calculate totals
  const totals = {
    totalSales: rows.reduce((sum: number, row: TransformedSale) => sum + row.total, 0),
    totalVAT: rows.reduce((sum: number, row: TransformedSale) => sum + (row.vat_amount || 0), 0),
    totalQuantity: rows.reduce((sum: number, row: TransformedSale) => sum + row.quantity, 0),
    averageSale: rows.length > 0 ? rows.reduce((sum: number, row: TransformedSale) => sum + row.total, 0) / rows.length : 0,
  };

  // Define columns for TanStack Table
  const columnHelper = createColumnHelper<TransformedSale>();
  const columns = [
    columnHelper.accessor('created_at', {
      header: 'Date',
      cell: info => new Date(info.getValue()).toLocaleString(),
    }),
    columnHelper.accessor('name', {
      header: 'Product',
      cell: info => info.getValue(),
    }),
    columnHelper.accessor('sku', {
      header: 'SKU',
      cell: info => info.getValue() || '',
    }),
    columnHelper.accessor('quantity', {
      header: 'Qty',
      cell: info => info.getValue(),
    }),
    columnHelper.accessor('price', {
      header: 'Price',
      cell: info => `KES ${info.getValue().toLocaleString()}`,
    }),
    columnHelper.accessor('total', {
      header: 'Total',
      cell: info => `KES ${info.getValue().toLocaleString()}`,
    }),
    columnHelper.accessor('vat_amount', {
      header: 'VAT',
      cell: info => `KES ${info.getValue().toLocaleString()}`,
    }),
    columnHelper.accessor('payment_method', {
      header: 'Payment',
      cell: info => info.getValue(),
    }),
  ];

  // Initialize TanStack Table
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const handleExportCSV = () => {
    if (!rows.length) {
      toast.error('No data to export');
      return;
    }
    const filename = `sales_report_${startDate || 'all'}_to_${endDate || 'all'}.csv`;
    exportToCSV(rows as Record<string, unknown>[], filename);
  };

  const handleExportPDF = () => {
    if (!rows.length) {
      toast.error('No data to export');
      return;
    }
    exportToPDF();
  };

  if (isLoading) return <div>Loading sales report...</div>;
  if (error) return <div className="text-red-500">Error: {(error as Error).message}</div>;

  return (
    <div>
      <TotalsSection
        title="Sales Summary"
        totals={[
          { label: 'Total Sales', value: totals.totalSales },
          { label: 'Total VAT', value: totals.totalVAT },
          { label: 'Total Quantity', value: totals.totalQuantity },
          { label: 'Average Sale', value: totals.averageSale },
        ]}
      />
      <div className="flex justify-end mb-2">
        <button 
          onClick={handleExportCSV}
          className="btn btn-outline mr-2"
          disabled={!rows.length}
        >
          Export CSV
        </button>
        <button 
          onClick={handleExportPDF}
          className="btn btn-outline"
          disabled={!rows.length}
        >
          Export PDF
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="bg-gray-100">
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left cursor-pointer hover:bg-gray-200"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                    {{
                      asc: ' 🔼',
                      desc: ' 🔽',
                    }[header.column.getIsSorted() as string] ?? null}
                  </th>
                ))}
            </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="border-b">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-3 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <button
            className="btn btn-outline"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            {'<<'}
          </button>
          <button
            className="btn btn-outline"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {'<'}
          </button>
          <button
            className="btn btn-outline"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {'>'}
          </button>
          <button
            className="btn btn-outline"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            {'>>'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">
            Page {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount()}
          </span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={e => {
              table.setPageSize(Number(e.target.value));
            }}
            className="border rounded px-2 py-1"
          >
            {[10, 20, 30, 40, 50].map(pageSize => (
              <option key={pageSize} value={pageSize}>
                Show {pageSize}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function InventoryReport({ 
  storeId, 
  productName, 
  category,
  generateInventoryReport 
}: { 
  storeId: string; 
  productName: string; 
  category: string;
  generateInventoryReport: () => Promise<InventoryReportData>;
}) {
  console.log('InventoryReport - Props:', { storeId, productName, category });
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory-report', storeId, productName, category],
    queryFn: async () => {
      console.log('InventoryReport - Starting data fetch');
      
      const report = await generateInventoryReport();
      console.log('InventoryReport - Raw report data:', report);
      
      // Filter by product name and category
      let filteredProducts = report.data;
      if (productName) {
        filteredProducts = filteredProducts.filter((product: InventoryReportData['data'][0]) => 
          product.name.toLowerCase().includes(productName.toLowerCase())
        );
      }
      if (category) {
        filteredProducts = filteredProducts.filter((product: InventoryReportData['data'][0]) => 
          product.category?.toLowerCase().includes(category.toLowerCase())
        );
      }
      console.log('InventoryReport - Filtered products:', filteredProducts);

      return { data: filteredProducts };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  console.log('InventoryReport - Query state:', { isLoading, error, data });

  if (isLoading) return <div>Loading inventory report...</div>;
  if (error) return <div className="text-red-500">Error: {(error as Error).message}</div>;

  const rows = data?.data || [];
  console.log('InventoryReport - Final rows to display:', rows);

  // Calculate totals
  const totals = {
    totalProducts: rows.length,
    totalQuantity: rows.reduce((sum: number, row: InventoryReportData['data'][0]) => sum + row.quantity, 0),
    totalRetailValue: rows.reduce((sum: number, row: InventoryReportData['data'][0]) => sum + ((row.retail_price || 0) * row.quantity), 0),
    totalWholesaleValue: rows.reduce((sum: number, row: InventoryReportData['data'][0]) => sum + ((row.wholesale_price || 0) * row.quantity), 0),
    lowStockItems: rows.filter((row: InventoryReportData['data'][0]) => row.low_stock).length,
  };

  const handleExportCSV = () => {
    if (!rows.length) {
      toast.error('No data to export');
      return;
    }
    const filename = `inventory_report_${new Date().toISOString()}.csv`;
    exportToCSV(rows as Record<string, unknown>[], filename);
  };

  const handleExportPDF = () => {
    if (!rows.length) {
      toast.error('No data to export');
      return;
    }
    exportToPDF();
  };

  return (
    <div>
      <TotalsSection
        title="Inventory Summary"
        totals={[
          { label: 'Total Products', value: totals.totalProducts },
          { label: 'Total Quantity', value: totals.totalQuantity },
          { label: 'Total Retail Value', value: totals.totalRetailValue },
          { label: 'Total Wholesale Value', value: totals.totalWholesaleValue },
        ]}
      />
      <div className="flex justify-end mb-2">
        <button 
          onClick={handleExportCSV}
          className="btn btn-outline mr-2"
          disabled={!rows.length}
        >
          Export CSV
        </button>
        <button 
          onClick={handleExportPDF}
          className="btn btn-outline"
          disabled={!rows.length}
        >
          Export PDF
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-left">Quantity</th>
              <th className="px-3 py-2 text-left">Low Stock</th>
              <th className="px-3 py-2 text-left">Retail Price</th>
              <th className="px-3 py-2 text-left">Wholesale Price</th>
              <th className="px-3 py-2 text-left">Wholesale Threshold</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((product) => (
              <tr key={product.id} className="border-b">
                <td className="px-3 py-2">{product.name}</td>
                <td className="px-3 py-2">{product.sku}</td>
                <td className="px-3 py-2">{product.category}</td>
                <td className="px-3 py-2">{product.quantity}</td>
                <td className="px-3 py-2">{product.low_stock ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2">KES {product.retail_price?.toLocaleString() || 'N/A'}</td>
                <td className="px-3 py-2">KES {product.wholesale_price?.toLocaleString() || 'N/A'}</td>
                <td className="px-3 py-2">{product.wholesale_threshold || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VatReport({ 
  storeId, 
  startDate, 
  endDate, 
  productName, 
  category,
  generateReports 
}: { 
  storeId: string; 
  startDate: string; 
  endDate: string; 
  productName: string; 
  category: string;
  generateReports: (startDate: Date, endDate: Date) => Promise<ReportData>;
}) {
  console.log('VatReport - Props:', { storeId, startDate, endDate, productName, category });
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['vat-report', storeId, startDate, endDate, productName, category],
    queryFn: async () => {
      console.log('VatReport - Starting data fetch');
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      console.log('VatReport - Date range:', { start, end });
      
      const report = await generateReports(start, end);
      console.log('VatReport - Raw report data:', report);
      
      // Filter by product name and category
      let filteredSales = report.data;
      if (productName) {
        filteredSales = filteredSales.filter((sale: Transaction) => 
          sale.products?.name?.toLowerCase().includes(productName.toLowerCase())
        );
      }
      if (category) {
        filteredSales = filteredSales.filter((sale: Transaction) => 
          sale.products?.category?.toLowerCase().includes(category.toLowerCase())
        );
      }
      console.log('VatReport - Filtered sales:', filteredSales);

      // Calculate VAT summary
      const vatSummary = calculateVAT(filteredSales);
      console.log('VatReport - Calculated VAT summary:', vatSummary);

      return { data: vatSummary };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  console.log('VatReport - Query state:', { isLoading, error, data });

  if (isLoading) return <div>Loading VAT report...</div>;
  if (error) return <div className="text-red-500">Error: {(error as Error).message}</div>;

  const vatData = data?.data;
  console.log('VatReport - Final VAT data to display:', vatData);

  const handleExportCSV = () => {
    if (!vatData?.category_breakdown?.length) {
      toast.error('No data to export');
      return;
    }
    const filename = `vat_report_${startDate || 'all'}_to_${endDate || 'all'}.csv`;
    exportToCSV(vatData.category_breakdown as Record<string, unknown>[], filename);
  };

  const handleExportPDF = () => {
    if (!vatData?.category_breakdown?.length) {
      toast.error('No data to export');
      return;
    }
    exportToPDF();
  };

  return (
    <div>
      <TotalsSection
        title="VAT Summary"
        totals={[
          { label: 'Total VAT', value: vatData?.vat_total || 0 },
          { label: 'Taxable Sales', value: vatData?.taxable_total || 0 },
          { label: 'Exempt Sales', value: vatData?.exempt_total || 0 },
          { label: 'Total Sales', value: (vatData?.taxable_total || 0) + (vatData?.exempt_total || 0) },
        ]}
      />
      <div className="flex justify-end mb-2">
        <button 
          onClick={handleExportCSV}
          className="btn btn-outline mr-2"
          disabled={!vatData?.category_breakdown?.length}
        >
          Export CSV
        </button>
        <button 
          onClick={handleExportPDF}
          className="btn btn-outline"
          disabled={!vatData?.category_breakdown?.length}
        >
          Export PDF
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-left">Taxable Sales</th>
              <th className="px-3 py-2 text-left">Exempt Sales</th>
              <th className="px-3 py-2 text-left">VAT Amount</th>
            </tr>
          </thead>
          <tbody>
            {vatData?.category_breakdown.map((item: VatCategoryBreakdown, index: number) => (
              <tr key={index} className="border-b">
                <td className="px-3 py-2">{item.category}</td>
                <td className="px-3 py-2">KES {item.taxable_sales.toLocaleString()}</td>
                <td className="px-3 py-2">KES {item.exempt_sales.toLocaleString()}</td>
                <td className="px-3 py-2">KES {item.vat_amount.toLocaleString()}</td>
              </tr>
            ))}
            <tr className="border-b font-semibold bg-gray-50">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2">KES {vatData?.taxable_total.toLocaleString() || '0'}</td>
              <td className="px-3 py-2">KES {vatData?.exempt_total.toLocaleString() || '0'}</td>
              <td className="px-3 py-2">KES {vatData?.vat_total.toLocaleString() || '0'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const calculateVAT = (sales: Transaction[]) => {
  const categoryBreakdown = sales.reduce((acc: Record<string, VatCategoryBreakdown>, sale) => {
    const category = sale.products?.category || 'Uncategorized';
    const vatAmount = sale.vat_amount ?? 0;
    const total = sale.total ?? 0;

    if (!acc[category]) {
      acc[category] = {
        category,
        taxable_sales: 0,
        vat_amount: 0,
        exempt_sales: 0
      };
    }

    if (sale.products?.vat_status) {
      acc[category].taxable_sales += total;
      acc[category].vat_amount += vatAmount;
    } else {
      acc[category].exempt_sales += total;
    }

    return acc;
  }, {});

  return {
    category_breakdown: Object.values(categoryBreakdown),
    vat_total: sales.reduce((sum, sale) => sum + (sale.vat_amount ?? 0), 0),
    taxable_total: sales.reduce((sum, sale) => 
      sum + (sale.products?.vat_status ? (sale.total ?? 0) : 0), 0),
    exempt_total: sales.reduce((sum, sale) => 
      sum + (!sale.products?.vat_status ? (sale.total ?? 0) : 0), 0)
  };
}; 