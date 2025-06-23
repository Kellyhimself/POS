'use client'

import React, { useEffect, useState } from 'react';
import { useSimplifiedAuth } from '@/components/providers/SimplifiedAuthProvider';
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
    <div className="flex flex-col md:flex-row w-full min-w-0 gap-2">
      <div className="w-full md:w-auto">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[240px] justify-start text-left font-normal xs:w-full sm:w-full",
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
      </div>
      {!isSingleDay && (
        <>
          <span className="block md:hidden text-gray-500 text-center my-1">to</span>
          <span className="hidden md:block mx-2 text-gray-500 self-center">to</span>
          <div className="w-full md:w-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[240px] justify-start text-left font-normal xs:w-full sm:w-full",
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
          </div>
        </>
      )}
    </div>
  );
};

const PurchaseHistoryPage: React.FC = () => {
  const { storeId, loading } = useSimplifiedAuth();
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
    <div className="p-6 xs:p-2 sm:p-3 md:p-4">
      <div className="mb-6 xs:mb-3 sm:mb-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 xs:mb-2 sm:mb-3">
          <h1 className="text-2xl xs:text-lg sm:text-xl font-bold">Purchase History</h1>
        </div>
        {/* VAT/Overview Filter Dropdown */}
        <div className="mb-4 flex gap-2 items-center xs:flex-col xs:items-start xs:gap-1">
          <label htmlFor="purchase-filter-mode" className="text-sm font-medium text-gray-700">View:</label>
          <select
            id="purchase-filter-mode"
            value={filterMode}
            onChange={e => setFilterMode(e.target.value as 'overview' | 'filtered')}
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 xs:w-full"
          >
            <option value="filtered">Filtered</option>
            <option value="overview">Overview</option>
          </select>
        </div>
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-4 w-full min-w-0">
          <div className="flex flex-col md:flex-row gap-4 w-full min-w-0">
            {/* Single Day Toggle */}
            <div className="flex items-center gap-2 xs:gap-1 xs:w-full sm:w-full w-full">
              <label className="flex items-center gap-2 text-sm font-medium w-full">
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
            <div className="xs:w-full sm:w-full w-full">
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              isSingleDay={isSingleDay}
            />
            </div>
            {/* Search Filter */}
            <div className="relative xs:w-full sm:w-full w-full min-w-0">
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by supplier, invoice number, or product name..."
                className="border-2 border-blue-400 focus:border-blue-600 rounded px-2 py-1 w-full transition-colors duration-200 xs:w-full sm:w-full min-w-0"
              />
            </div>
          </div>
        </div>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 xs:gap-2 sm:gap-3 mb-6 xs:mb-3 sm:mb-4">
          <div className="bg-white p-4 xs:p-2 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm xs:text-xs">Total Purchases</h3>
            <p className="text-2xl xs:text-lg font-bold">{summary.totalPurchases}</p>
          </div>
          <div className="bg-white p-4 xs:p-2 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm xs:text-xs">Total Amount</h3>
            <p className="text-2xl xs:text-lg font-bold">KES {summary.totalAmount.toLocaleString()}</p>
          </div>
          <div className="bg-white p-4 xs:p-2 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm xs:text-xs">Total Input VAT</h3>
            <p className="text-2xl xs:text-lg font-bold">KES {summary.totalVat.toLocaleString()}</p>
          </div>
          <div className="bg-white p-4 xs:p-2 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm xs:text-xs">Average Purchase</h3>
            <p className="text-2xl xs:text-lg font-bold">KES {summary.averagePurchase.toLocaleString()}</p>
          </div>
        </div>
      </div>
      {/* Table for md+ screens, Cards for xs/sm */}
      <div className="hidden md:block">
      <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full text-sm">
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
      {/* Card view for xs/sm screens */}
      <div className="block md:hidden space-y-4">
        {filteredPurchases.length === 0 && (
          <div className="px-4 py-4 text-center text-gray-400 bg-white rounded-lg shadow">No purchases found.</div>
        )}
        {filteredPurchases.map((purchase) => (
          <div key={purchase.id} className="bg-white rounded-lg shadow p-3 xs:p-2">
            <div className="flex justify-between items-center mb-2">
              <div>
                <div className="text-xs text-gray-500">{format(new Date(purchase.date || ''), 'dd/MM/yyyy')}</div>
                <div className="font-semibold text-sm xs:text-xs">{purchase.supplier_name || '-'}</div>
                <div className="text-xs text-gray-400">Invoice: {purchase.invoice_number || '-'}</div>
              </div>
              <button
                onClick={() => setExpanded(expanded === purchase.id ? null : purchase.id)}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                {expanded === purchase.id ? 'Hide' : 'Details'}
              </button>
            </div>
            <div className="flex justify-between items-center mb-1">
              <div className="text-xs text-gray-600">Total:</div>
              <div className="font-bold text-sm xs:text-xs">KES {purchase.total_amount.toLocaleString()}</div>
            </div>
            <div className="flex justify-between items-center mb-1">
              <div className="text-xs text-gray-600">Input VAT:</div>
              <div className="font-bold text-sm xs:text-xs">KES {purchase.input_vat_amount?.toLocaleString() || '-'}</div>
            </div>
            {expanded === purchase.id && (
              <div className="mt-2">
                <div className="font-semibold mb-1 text-xs">Items</div>
                <div className="space-y-2">
                  {purchase.items.map(item => {
                    const product = products.find(p => p.id === item.product_id);
                    return (
                      <div key={item.id} className="border rounded p-2 bg-gray-50">
                        <div className="flex justify-between items-center">
                          <div className="font-medium text-xs">{product ? product.name : item.product_id}</div>
                          <div className="text-xs text-gray-500">Qty: {item.quantity}</div>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <div className="text-xs text-gray-600">Unit Cost:</div>
                          <div className="text-xs">KES {item.unit_cost.toLocaleString()}</div>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <div className="text-xs text-gray-600">VAT:</div>
                          <div className="text-xs">KES {item.vat_amount?.toLocaleString() || '-'}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PurchaseHistoryPage; 