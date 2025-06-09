"use client";

import React, { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { syncService } from '@/lib/sync';
import { useSync } from '@/hooks/useSync';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import AddStockPopover from '@/components/products/AddStockPopover';
import { CreateProductPopover } from "@/components/products/CreateProductPopover";

const LOW_STOCK_THRESHOLD = 10;

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
}

export default function InventoryPage() {
  const { storeId, loading } = useAuth();
  const [search, setSearch] = useState('');
  const { addStockQuantity } = useSync(storeId || '');
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
        <div className="flex items-center gap-2">
          <span className={info.getValue() < LOW_STOCK_THRESHOLD ? 'text-red-600 font-semibold' : ''}>
            {info.getValue()}
          </span>
        </div>
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
      cell: info => `KES ${info.getValue()?.toFixed(2) || '0.00'}`,
    }),
    columnHelper.accessor('wholesale_price', {
      header: 'Wholesale Price',
      cell: info => `KES ${info.getValue()?.toFixed(2) || '0.00'}`,
    }),
    columnHelper.accessor('wholesale_threshold', {
      header: 'Wholesale Threshold',
      cell: info => info.getValue() || '-',
    }),
    columnHelper.accessor('cost_price', {
      header: 'Cost Price',
      cell: info => `KES ${info.getValue()?.toFixed(2) || '0.00'}`,
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

  const handleAddStock = async (productId: string, quantity: number) => {
    try {
      await addStockQuantity(productId, quantity);
      queryClient.invalidateQueries({ queryKey: ['products', storeId] });
    } catch (error) {
      console.error('Error adding stock:', error);
      throw error;
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
                          <AddStockPopover
                            product={row.original}
                            onAddStock={handleAddStock}
                          >
                            <div className="flex items-center gap-2">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </div>
                          </AddStockPopover>
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
                <AddStockPopover
                  key={row.id}
                  product={row.original}
                  onAddStock={handleAddStock}
                >
                  <div
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
                  </div>
                </AddStockPopover>
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