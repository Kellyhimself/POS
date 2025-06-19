'use client'

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useUnifiedService } from '@/components/providers/UnifiedServiceProvider';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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

const PurchaseHistoryPage: React.FC = () => {
  const { storeId, loading } = useAuth();
  const { currentMode, getPurchases, getProducts } = useUnifiedService();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().setDate(new Date().getDate() - 30)));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [isSingleDay, setIsSingleDay] = useState(false);
  const [filterMode, setFilterMode] = useState<'overview' | 'filtered'>('filtered');

  useEffect(() => {
    // Update end date when single day mode is toggled
    if (isSingleDay) {
      // Set endDate to the end of the same day (23:59:59.999)
      const endOfDay = new Date(startDate);
      endOfDay.setHours(23, 59, 59, 999);
      setEndDate(endOfDay);
    }
  }, [isSingleDay, startDate]);

  // Fetch purchases using unified service
  const { data: purchases = [], isLoading: purchasesLoading, error: purchasesError } = useQuery({
    queryKey: ['purchases', storeId, currentMode, startDate, endDate, isSingleDay],
    queryFn: async () => {
      if (!storeId) return [];
      return await getPurchases(storeId, startDate, endDate);
    },
    enabled: !!storeId,
  });

  // Fetch products for filtering
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products', storeId, currentMode],
    queryFn: async () => {
      if (!storeId) return [];
      return await getProducts(storeId);
    },
    enabled: !!storeId,
  });

  // Filtering logic
  const filteredPurchases = purchases.filter((p) => {
    // Server-side filtering already handles date range, so we only need to filter by search terms and VAT status
    const searchQuery = searchTerm.toLowerCase();
    
    // Check if search term matches supplier name, invoice number, or any product name
    const matchesSupplier = !searchQuery || (p.supplier_name || '').toLowerCase().includes(searchQuery);
    const matchesInvoice = !searchQuery || (p.invoice_number || '').toLowerCase().includes(searchQuery);
    
    // Check if any product in the purchase matches the search term
    const matchesProduct = !searchQuery || p.items.some(item => {
      const product = products.find(prod => prod.id === item.product_id);
      return product && product.name.toLowerCase().includes(searchQuery);
    });
    
    const matchesSearch = matchesSupplier || matchesInvoice || matchesProduct;
    if (!matchesSearch) return false;
    
    if (filterMode === 'overview') return true;
    
    // Filtered mode (default):
    // Show only purchases where at least one item is:
    // - VATable (product.vat_status === true) AND input_vat_amount > 0
    // - Zero rated (product.vat_status === false)
    // - Exempted (product.vat_status === null)
    const itemsWithProduct = p.items.map(item => {
      const product = products.find(prod => prod.id === item.product_id);
      return { item, product };
    });
    return itemsWithProduct.some(({ item, product }) => {
      if (!product) return false;
      if (product.vat_status === true) {
        return (item.vat_amount ?? 0) > 0;
      }
      if (product.vat_status === false) {
        return true; // zero rated
      }
      if (product.vat_status === null) {
        return true; // exempted
      }
      return false;
    });
  });

  // Calculate summary statistics
  const calculateSummary = () => {
    const totals = filteredPurchases.reduce((acc, purchase) => ({
      totalAmount: acc.totalAmount + (purchase.total_amount || 0),
      totalVat: acc.totalVat + (purchase.input_vat_amount || 0),
      totalItems: acc.totalItems + purchase.items.reduce((sum, item) => sum + item.quantity, 0),
      totalPurchases: acc.totalPurchases + 1
    }), {
      totalAmount: 0,
      totalVat: 0,
      totalItems: 0,
      totalPurchases: 0
    });

    return {
      ...totals,
      averagePurchase: totals.totalPurchases > 0 ? totals.totalAmount / totals.totalPurchases : 0
    };
  };

  const summary = calculateSummary();

  if (loading) return <div>Loading auth state...</div>;
  if (!storeId) return <div>No store assigned. Please contact your administrator.</div>;
  if (purchasesLoading || productsLoading) return <div>Loading purchases...</div>;

  if (purchasesError) {
    return (
      <div className="p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {purchasesError instanceof Error ? purchasesError.message : 'An error occurred while loading purchases'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Purchase History</h1>
        </div>
        
        {/* VAT/Overview Filter Dropdown */}
        <div className="mb-4 flex gap-2 items-center">
          <label htmlFor="purchase-filter-mode" className="text-sm font-medium text-gray-700">View:</label>
          <select
            id="purchase-filter-mode"
            value={filterMode}
            onChange={e => setFilterMode(e.target.value as 'overview' | 'filtered')}
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="filtered">Filtered</option>
            <option value="overview">Overview</option>
          </select>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex flex-wrap gap-4 flex-grow">
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

            {/* Search Filter */}
            <div className="relative flex-grow">
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by supplier, invoice number, or product name..."
                className="border-2 border-blue-400 focus:border-blue-600 rounded px-2 py-1 w-full transition-colors duration-200"
              />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Total Purchases</h3>
            <p className="text-2xl font-bold">{summary.totalPurchases}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Total Amount</h3>
            <p className="text-2xl font-bold">KES {summary.totalAmount.toLocaleString()}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Total Input VAT</h3>
            <p className="text-2xl font-bold">KES {summary.totalVat.toLocaleString()}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Average Purchase</h3>
            <p className="text-2xl font-bold">KES {summary.averagePurchase.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Supplier</th>
              <th className="px-4 py-2 text-left">Invoice #</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2 text-right">Input VAT</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filteredPurchases.map((purchase) => (
              <React.Fragment key={purchase.id}>
                <tr className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{format(new Date(purchase.date || ''), 'dd/MM/yyyy')}</td>
                  <td className="px-4 py-2">{purchase.supplier_name || '-'}</td>
                  <td className="px-4 py-2">{purchase.invoice_number || '-'}</td>
                  <td className="px-4 py-2 text-right">KES {purchase.total_amount.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">KES {purchase.input_vat_amount?.toLocaleString() || '-'}</td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => setExpanded(expanded === purchase.id ? null : purchase.id)}
                      className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    >
                      {expanded === purchase.id ? 'Hide' : 'Details'}
                    </button>
                  </td>
                </tr>
                {expanded === purchase.id && (
                  <tr className="bg-gray-50">
                    <td colSpan={6} className="px-4 py-2">
                      <div>
                        <div className="font-semibold mb-2">Items</div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="px-2 py-1 text-left">Product</th>
                              <th className="px-2 py-1 text-right">Qty</th>
                              <th className="px-2 py-1 text-right">Unit Cost</th>
                              <th className="px-2 py-1 text-right">VAT</th>
                            </tr>
                          </thead>
                          <tbody>
                            {purchase.items.map(item => {
                              // Find product name by id
                              const product = products.find(p => p.id === item.product_id);
                              return (
                              <tr key={item.id} className="border-b hover:bg-gray-50">
                                  <td className="px-2 py-1">{product ? product.name : item.product_id}</td>
                                <td className="px-2 py-1 text-right">{item.quantity}</td>
                                <td className="px-2 py-1 text-right">KES {item.unit_cost.toLocaleString()}</td>
                                <td className="px-2 py-1 text-right">KES {item.vat_amount?.toLocaleString() || '-'}</td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {filteredPurchases.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-gray-400">No purchases found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PurchaseHistoryPage; 