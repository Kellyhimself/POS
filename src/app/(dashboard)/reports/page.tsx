"use client";
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/AuthProvider';
import { ChevronDown, ChevronUp } from 'lucide-react';

const TABS = [
  { key: 'sales', label: 'Sales Report' },
  { key: 'inventory', label: 'Inventory Report' },
  { key: 'vat', label: 'VAT Report' },
];

// Types for API responses
interface SalesProduct {
  name: string;
  sku: string | null;
  selling_price: number;
  vat_status: boolean | null;
  category: string | null;
}
interface SalesRow {
  id: string;
  product_id: string | null;
  quantity: number;
  total: number;
  vat_amount: number | null;
  payment_method: string | null;
  timestamp: string | null;
  products?: SalesProduct;
}

interface InventoryRow {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  quantity: number;
  low_stock: boolean;
  retail_price: number | null;
  wholesale_price: number | null;
  wholesale_threshold: number | null;
}

interface VatSummary {
  vat_total: number;
  taxable_total: number;
  exempt_total: number;
  category_breakdown: Array<{
    category: string;
    vat_total: number;
    taxable_total: number;
    exempt_total: number;
  }>;
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('sales');
  const { storeId, loading } = useAuth();
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [productName, setProductName] = useState<string>('');
  const [category, setCategory] = useState<string>('');

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
          />
        )}
        {activeTab === 'inventory' && (
          <InventoryReport
            storeId={storeId}
            productName={productName}
            category={category}
          />
        )}
        {activeTab === 'vat' && (
          <VatReport
            storeId={storeId}
            startDate={startDate}
            endDate={endDate}
            productName={productName}
            category={category}
          />
        )}
      </div>
    </div>
  );
}

function TotalsSection({ title, totals }: { title: string; totals: { label: string; value: number }[] }) {
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

function SalesReport({ storeId, startDate, endDate, productName, category }: { storeId: string; startDate: string; endDate: string; productName: string; category: string }) {
  const { data, isLoading, error } = useQuery<{ data: SalesRow[] }>({
    queryKey: ['sales-report', storeId, startDate, endDate, productName, category],
    queryFn: async () => {
      const params = new URLSearchParams({ store_id: storeId });
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (productName) params.append('product_name', productName);
      if (category) params.append('category', category);
      const res = await fetch(`/api/reports/sales?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch sales report');
      return res.json();
    },
  });

  if (isLoading) return <div>Loading sales report...</div>;
  if (error) return <div className="text-red-500">Error: {(error as Error).message}</div>;

  const rows = data?.data || [];
  
  // Calculate totals
  const totals = {
    totalSales: rows.reduce((sum, row) => sum + row.total, 0),
    totalVAT: rows.reduce((sum, row) => sum + (row.vat_amount || 0), 0),
    totalQuantity: rows.reduce((sum, row) => sum + row.quantity, 0),
    averageSale: rows.length > 0 ? rows.reduce((sum, row) => sum + row.total, 0) / rows.length : 0,
  };

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
        <button className="btn btn-outline mr-2">Export CSV</button>
        <button className="btn btn-outline">Export PDF</button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-left">Qty</th>
              <th className="px-3 py-2 text-left">Total</th>
              <th className="px-3 py-2 text-left">VAT</th>
              <th className="px-3 py-2 text-left">Payment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tx) => (
              <tr key={tx.id} className="border-b">
                <td className="px-3 py-2">{tx.timestamp ? new Date(tx.timestamp).toLocaleString() : ''}</td>
                <td className="px-3 py-2">{tx.products?.name || ''}</td>
                <td className="px-3 py-2">{tx.products?.sku || ''}</td>
                <td className="px-3 py-2">{tx.quantity}</td>
                <td className="px-3 py-2">{tx.total}</td>
                <td className="px-3 py-2">{tx.vat_amount}</td>
                <td className="px-3 py-2">{tx.payment_method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InventoryReport({ storeId, productName, category }: { storeId: string; productName: string; category: string }) {
  const { data, isLoading, error } = useQuery<{ data: InventoryRow[] }>({
    queryKey: ['inventory-report', storeId, productName, category],
    queryFn: async () => {
      const params = new URLSearchParams({ store_id: storeId });
      if (productName) params.append('product_name', productName);
      if (category) params.append('category', category);
      const res = await fetch(`/api/reports/inventory?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch inventory report');
      return res.json();
    },
  });

  if (isLoading) return <div>Loading inventory report...</div>;
  if (error) return <div className="text-red-500">Error: {(error as Error).message}</div>;

  const rows = data?.data || [];

  // Calculate totals
  const totals = {
    totalProducts: rows.length,
    totalQuantity: rows.reduce((sum, row) => sum + row.quantity, 0),
    totalRetailValue: rows.reduce((sum, row) => sum + ((row.retail_price || 0) * row.quantity), 0),
    totalWholesaleValue: rows.reduce((sum, row) => sum + ((row.wholesale_price || 0) * row.quantity), 0),
    lowStockItems: rows.filter(row => row.low_stock).length,
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
        <button className="btn btn-outline mr-2">Export CSV</button>
        <button className="btn btn-outline">Export PDF</button>
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

function VatReport({ storeId, startDate, endDate, productName, category }: { storeId: string; startDate: string; endDate: string; productName: string; category: string }) {
  const { data, isLoading, error } = useQuery<{ data: VatSummary }>({
    queryKey: ['vat-report', storeId, startDate, endDate, productName, category],
    queryFn: async () => {
      const params = new URLSearchParams({ store_id: storeId });
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (productName) params.append('product_name', productName);
      if (category) params.append('category', category);
      const res = await fetch(`/api/reports/vat?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch VAT report');
      return res.json();
    },
  });

  if (isLoading) return <div>Loading VAT report...</div>;
  if (error) return <div className="text-red-500">Error: {(error as Error).message}</div>;

  const vatData = data?.data;

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
        <button className="btn btn-outline mr-2">Export CSV</button>
        <button className="btn btn-outline">Export PDF</button>
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
            {vatData?.category_breakdown.map((item, index) => (
              <tr key={index} className="border-b">
                <td className="px-3 py-2">{item.category}</td>
                <td className="px-3 py-2">KES {item.taxable_total.toLocaleString()}</td>
                <td className="px-3 py-2">KES {item.exempt_total.toLocaleString()}</td>
                <td className="px-3 py-2">KES {item.vat_total.toLocaleString()}</td>
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