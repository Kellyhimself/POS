"use client";

import React, { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { syncService } from '@/lib/sync';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Plus, Pencil } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import AddStockDialog from '@/components/products/AddStockDialog';
import { CreateProductPopover } from "@/components/products/CreateProductPopover";
import { submitStockUpdateEtimsInvoice } from '@/lib/etims/utils';
import { saveOfflinePurchase, updateOfflineProductPrice } from '@/lib/db';

const LOW_STOCK_THRESHOLD = 50;

interface Product {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  unit_of_measure: string;
  units_per_pack: number;
  retail_price: number | null;
  wholesale_price: number | null;
  wholesale_threshold: number | null;
  cost_price: number;
  vat_status: boolean | null;
  category: string | null;
  parent_product_id: string | null;
  store_id: string | null;
  selling_price: number;
  input_vat_amount: number | null;
}

function EditablePriceCell({
  value,
  onSave,
  currency = 'KES',
  min = 0,
  step = 0.01,
}: {
  value: number | null;
  onSave: (newValue: number) => void;
  currency?: string;
  min?: number;
  step?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value ?? 0);

  const handleBlur = () => {
    setEditing(false);
    if (inputValue !== value && !isNaN(inputValue)) {
      onSave(inputValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setEditing(false);
      if (inputValue !== value && !isNaN(inputValue)) {
        onSave(inputValue);
      }
    } else if (e.key === 'Escape') {
      setEditing(false);
      setInputValue(value ?? 0);
    }
  };

  return editing ? (
    <Input
      type="number"
      min={min}
      step={step}
      value={inputValue}
      autoFocus
      onChange={e => setInputValue(Number(e.target.value))}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="w-24 text-sm"
    />
  ) : (
    <span
      className="cursor-pointer border-b-2 border-blue-500 text-blue-600 bg-blue-50/40 px-2 py-1 rounded transition-colors duration-150 flex items-center gap-1 hover:bg-blue-100 hover:text-blue-700"
      onClick={() => setEditing(true)}
      title="Click to edit"
      style={{ minWidth: 80, display: 'inline-flex' }}
    >
      <Pencil className="w-4 h-4 mr-1 opacity-70" />
      {currency} {(value ?? 0).toFixed(2)}
    </span>
  );
}

function EditableQuantityCell({
  value,
  onAddStock,
  product,
}: {
  value: number;
  onAddStock: (params: {
    product: Product;
    numberOfPacks: number;
    purchaseDetails: {
      invoice_number: string;
      supplier_vat_no: string;
      is_vat_included: boolean;
      supplier_name: string;
      input_vat_amount: number;
      supplier_id?: string;
    };
  }) => Promise<void>;
  product: Product;
}) {
  return (
    <AddStockDialog
      product={product}
      onAddStock={onAddStock}
    >
      <span
        className="cursor-pointer border-b-2 border-blue-500 text-blue-600 bg-blue-50/40 px-2 py-1 rounded transition-colors duration-150 flex items-center gap-1 hover:bg-blue-100 hover:text-blue-700"
        title="Click to add stock"
        style={{ minWidth: 80, display: 'inline-flex' }}
      >
        <Plus className="w-4 h-4 mr-1 opacity-70" />
        {value}
      </span>
    </AddStockDialog>
  );
}

export default function InventoryPage() {
  const { storeId, loading } = useAuth();
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const columnHelper = createColumnHelper<Product>();

  const columns = [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: info => info.getValue(),
      filterFn: (row, id, value: string) => {
        const cellValue = row.getValue(id) as string;
        return cellValue?.toLowerCase().includes(value.toLowerCase());
      },
    }),
    columnHelper.accessor('sku', {
      header: 'SKU',
      cell: info => info.getValue() || '-',
      filterFn: (row, id, value: string) => {
        const sku = row.getValue(id) as string | null;
        return sku ? sku.toLowerCase().includes(value.toLowerCase()) : false;
      },
    }),
    columnHelper.accessor('quantity', {
      header: 'Quantity',
      cell: info => (
        <EditableQuantityCell
          value={info.getValue()}
          onAddStock={handleAddStock}
          product={info.row.original}
        />
      ),
    }),
    columnHelper.accessor('unit_of_measure', {
      header: 'Unit',
      cell: info => info.getValue(),
    }),
    columnHelper.accessor('units_per_pack', {
      header: 'Units/Pack',
      cell: info => info.getValue(),
    }),
    columnHelper.accessor('retail_price', {
      header: 'Retail Price',
      cell: info => (
        <EditablePriceCell
          value={info.getValue()}
          onSave={val => handleInlinePriceUpdate(info.row.original.id, 'retail_price', val)}
        />
      ),
    }),
    columnHelper.accessor('wholesale_price', {
      header: 'Wholesale Price',
      cell: info => (
        <EditablePriceCell
          value={info.getValue()}
          onSave={val => handleInlinePriceUpdate(info.row.original.id, 'wholesale_price', val)}
        />
      ),
    }),
    columnHelper.accessor('wholesale_threshold', {
      header: 'Wholesale Threshold',
      cell: info => info.getValue() || '-',
    }),
    columnHelper.accessor('cost_price', {
      header: 'Cost Price',
      cell: info => (
        <EditablePriceCell
          value={info.getValue()}
          onSave={val => handleInlinePriceUpdate(info.row.original.id, 'cost_price', val)}
        />
      ),
    }),
    columnHelper.accessor('vat_status', {
      header: 'VAT',
      cell: info => info.getValue() ? 'Taxable' : 'Non-taxable',
    }),
    columnHelper.accessor('category', {
      header: 'Category',
      cell: info => info.getValue() || '-',
    }),
  ];

  // Fetch inventory data
  const { data: products, isLoading: productsLoading, error } = useQuery<Product[]>({
    queryKey: ['products', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      try {
        const data = await syncService.getProducts(storeId);
        return data.map(product => ({
          ...product,
          selling_price: product.retail_price || 0
        }));
      } catch (error) {
        console.error('Error fetching products:', error);
        throw error;
      }
    },
    enabled: !!storeId,
  });

  const table = useReactTable({
    data: products || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      globalFilter: search,
    },
    onGlobalFilterChange: setSearch,
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const handleAddStock = async ({ product, numberOfPacks, purchaseDetails }: {
    product: Product;
    numberOfPacks: number;
    purchaseDetails: {
      invoice_number: string;
      supplier_vat_no: string;
      is_vat_included: boolean;
      supplier_name: string;
      input_vat_amount: number;
      supplier_id?: string;
    };
  }) => {
    try {
      if (!storeId) {
        throw new Error('Store ID is required');
      }
      const totalQuantity = numberOfPacks * product.units_per_pack;
      // Prepare purchase and item
      const kenyaTime = new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' });
      const kenyaDate = new Date(kenyaTime);
      const timestampISO = kenyaDate.toISOString();
      const purchase = {
        store_id: storeId,
        supplier_id: purchaseDetails.supplier_id || null,
        supplier_name: purchaseDetails.supplier_name,
        invoice_number: purchaseDetails.invoice_number,
        supplier_vat_no: purchaseDetails.supplier_vat_no,
        is_vat_included: purchaseDetails.is_vat_included,
        input_vat_amount: purchaseDetails.input_vat_amount,
        total_amount: product.cost_price * totalQuantity,
        date: timestampISO,
        notes: '',
        synced: false,
        created_at: timestampISO,
      };
      const item = {
        purchase_id: '', // This will be set by saveOfflinePurchase
        product_id: product.id,
        quantity: totalQuantity,
        unit_cost: product.cost_price,
        vat_amount: purchaseDetails.input_vat_amount,
        created_at: timestampISO,
      };
      // Save offline purchase (this also updates stock)
      await saveOfflinePurchase(purchase, [item]);
      // eTIMS submission if input VAT
      if (purchaseDetails.input_vat_amount > 0) {
        await submitStockUpdateEtimsInvoice(
          storeId,
          {
            id: product.id,
            name: product.name,
            cost_price: product.cost_price,
            quantity: totalQuantity,
            vat_status: product.vat_status || false
          },
          totalQuantity,
          purchaseDetails.input_vat_amount
        );
      }
      queryClient.invalidateQueries({ queryKey: ['products', storeId] });
    } catch (error) {
      throw error;
    }
  };

  const handleInlinePriceUpdate = async (productId: string, field: 'cost_price' | 'retail_price' | 'wholesale_price', newValue: number) => {
    if (!storeId) return;
    try {
      // Optimistically update UI
      queryClient.setQueryData(['products', storeId], (old: Product[] | undefined) => {
        if (!old) return old;
        return old.map(p => p.id === productId ? { ...p, [field]: newValue } : p);
      });
      // Update in local DB (offline-first)
      await updateOfflineProductPrice(productId, field, newValue);
      queryClient.invalidateQueries({ queryKey: ['products', storeId] });
    } catch {
      queryClient.invalidateQueries({ queryKey: ['products', storeId] });
    }
  };

  if (loading) return <div>Loading auth state...</div>;
  if (!storeId) return <div>No store assigned. Please contact your administrator.</div>;
  if (productsLoading) return <div>Loading products...</div>;

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error ? error.message : 'An error occurred while loading products'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory</h1>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-2">
        <div className="flex gap-2 w-full md:w-auto">
          <Input
            type="text"
            placeholder="Search by name or SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full md:w-64 p-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-[#0ABAB5] focus:border-transparent text-gray-800 bg-white placeholder:text-gray-400"
          />
          <div className="relative flex items-center justify-center">
            <CreateProductPopover storeId={storeId} />
          </div>
        </div>
      </div>

      <section className="bg-white rounded-lg shadow p-3 md:p-4">
        <h2 className="text-lg md:text-xl font-bold mb-3 text-[#0ABAB5]">Product List</h2>
        {table.getRowModel().rows.length === 0 ? (
          <p className="text-sm text-gray-500">No products found. Add some products to get started.</p>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id} className="border-b">
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          className="py-1.5 px-2 font-medium text-gray-700 whitespace-nowrap"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map(row => (
                    <tr
                      key={row.id}
                      className={`border-b hover:bg-gray-50 cursor-pointer ${
                        row.original.quantity < LOW_STOCK_THRESHOLD ? 'bg-red-50' : ''
                      }`}
                    >
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="py-1.5 px-2 text-gray-800 whitespace-nowrap">
                          {cell.column.id === 'quantity' ? (
                            <AddStockDialog
                              product={row.original}
                              onAddStock={handleAddStock}
                            >
                              <div className="flex items-center gap-2">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </div>
                            </AddStockDialog>
                          ) : (
                            flexRender(cell.column.columnDef.cell, cell.getContext())
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Grid View */}
            <div className="md:hidden space-y-2">
              {table.getRowModel().rows.map(row => (
                <div
                  key={row.id}
                    className={`p-2 rounded-lg border ${
                      row.original.quantity < LOW_STOCK_THRESHOLD ? 'bg-red-50' : 'bg-gray-50'
                    }`}
                  >
                    <div className="grid grid-cols-2 gap-1 text-sm">
                      <div className="font-medium text-gray-600">Name:</div>
                      <div className="text-gray-800">{row.original.name}</div>
                      
                      <div className="font-medium text-gray-600">SKU:</div>
                      <div className="text-gray-800">{row.original.sku || '-'}</div>
                      
                      <div className="font-medium text-gray-600">Quantity:</div>
                      <div className="flex items-center gap-2">
                        <span className={row.original.quantity < LOW_STOCK_THRESHOLD ? 'text-red-600 font-semibold' : ''}>
                          {row.original.quantity}
                        </span>
                      </div>
                      
                      <div className="font-medium text-gray-600">Unit:</div>
                      <div className="text-gray-800">{row.original.unit_of_measure}</div>
                      
                      <div className="font-medium text-gray-600">Retail Price:</div>
                      <div className="text-gray-800">KES {row.original.retail_price?.toFixed(2) || '0.00'}</div>
                      
                      <div className="font-medium text-gray-600">Category:</div>
                      <div className="text-gray-800">{row.original.category || '-'}</div>
                    </div>
                  <div className="mt-2 flex justify-end">
                    <AddStockDialog
                      product={row.original}
                      onAddStock={handleAddStock}
                    >
                      <button
                        type="button"
                        className="flex items-center gap-1 px-3 py-1 rounded bg-[#0ABAB5] text-white hover:bg-[#099C98] text-sm shadow"
                        title="Add Stock"
                      >
                        <span>Add Stock</span>
                        <Plus className="w-4 h-4" />
                      </button>
                    </AddStockDialog>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination controls */}
            <div className="flex items-center justify-between mt-3 text-sm">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Next
                </Button>
              </div>
              <span className="text-xs text-gray-600">
                Page {table.getState().pagination.pageIndex + 1} of{' '}
                {table.getPageCount()}
              </span>
            </div>
          </>
        )}
      </section>
    </div>
  );
} 