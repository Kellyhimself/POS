"use client";

import React, { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BulkOperations } from '@/components/products/BulkOperations';
import { syncService } from '@/lib/sync';

const LOW_STOCK_THRESHOLD = 10;

interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unit_of_measure: string;
  units_per_pack: number;
  retail_price: number;
  wholesale_price: number;
  wholesale_threshold: number;
  cost_price: number;
  vat_status: boolean;
  category: string;
  parent_product_id?: string;
}

const UNIT_OPTIONS = [
  { value: 'unit', label: 'Unit (Piece)' },
  { value: 'bale', label: 'Bale' },
  { value: 'carton', label: 'Carton' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'packet', label: 'Packet' },
  { value: 'sack', label: 'Sack' },
  { value: 'tin', label: 'Tin' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'crate', label: 'Crate' },
  { value: 'roll', label: 'Roll' },
  { value: 'box', label: 'Box' },
  { value: 'jar', label: 'Jar' },
  { value: 'can', label: 'Can' },
  { value: 'tube', label: 'Tube' },
  { value: 'piece', label: 'Piece' },
  { value: 'set', label: 'Set' },
  { value: 'tray', label: 'Tray' },
  { value: 'sachet', label: 'Sachet' },
  { value: 'ream', label: 'Ream' },
  { value: 'pair', label: 'Pair' },
  { value: 'bundle', label: 'Bundle' },
  { value: 'stick', label: 'Stick' },
  { value: 'sheet', label: 'Sheet' },
  { value: 'bag', label: 'Bag' },
  { value: 'bar', label: 'Bar' },
  { value: 'gallon', label: 'Gallon' },
  { value: 'litre', label: 'Litre' },
  { value: 'ml', label: 'ml' },
  { value: 'kg', label: 'kg' },
  { value: 'gm', label: 'gm' },
  { value: 'meter', label: 'Meter' },
  { value: 'yard', label: 'Yard' },
  { value: 'foot', label: 'Foot' },
  { value: 'inch', label: 'Inch' },
  { value: 'gross', label: 'Gross' },
  { value: 'quart', label: 'Quart' },
  { value: 'pint', label: 'Pint' },
  { value: 'ounce', label: 'Ounce' },
  { value: 'lb', label: 'Pound (lb)' },
];

const InventoryPage = () => {
  const { storeId, loading } = useAuth();
  const [search, setSearch] = useState('');
  const [newProduct, setNewProduct] = useState({
    name: '',
    sku: '',
    number_of_packs: 0,
    quantity: 0,
    unit_of_measure: 'unit',
    units_per_pack: 1,
    retail_price: 0,
    wholesale_price: 0,
    wholesale_threshold: 1,
    cost_price: 0,
    vat_status: true,
    category: '',
    parent_product_id: undefined as string | undefined,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const queryClient = useQueryClient();

  // Fetch inventory data
  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['products', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      try {
        const data = await syncService.getProducts(storeId);
        return data;
      } catch (error) {
        console.error('Error fetching products:', error);
        throw error;
      }
    },
    enabled: !!storeId,
  });

  // Filter products by search
  const filteredProducts = products?.filter((product: Product) =>
    product.name.toLowerCase().includes(search.toLowerCase()) ||
    (product.sku && product.sku.toLowerCase().includes(search.toLowerCase()))
  );

  const addProductMutation = useMutation({
    mutationFn: async (product: typeof newProduct & { store_id: string }) => {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add product');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', storeId] });
      setNewProduct({ name: '', sku: '', number_of_packs: 0, quantity: 0, unit_of_measure: 'unit', units_per_pack: 1, retail_price: 0, wholesale_price: 0, wholesale_threshold: 1, cost_price: 0, vat_status: true, category: '', parent_product_id: undefined });
    },
    onError: (err: unknown) => {
      let message = 'An unknown error occurred';
      if (isErrorWithMessage(err)) {
        message = err.message;
      }
      alert(message);
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    addProductMutation.mutate({ ...newProduct, store_id: storeId! });
  };

  function isErrorWithMessage(err: unknown): err is { message: string } {
    return typeof err === 'object' && err !== null && 'message' in err && typeof (err as { message?: unknown }).message === 'string';
  }

  // Add function to calculate total quantity
  const calculateTotalQuantity = (numberOfPacks: number, unitsPerPack: number) => {
    return numberOfPacks * unitsPerPack;
  };

  // Add function to handle pack-related changes
  const handlePackChange = (field: 'number_of_packs' | 'units_per_pack', value: number) => {
    const updatedProduct = { ...newProduct, [field]: value };
    updatedProduct.quantity = calculateTotalQuantity(
      field === 'number_of_packs' ? value : updatedProduct.number_of_packs,
      field === 'units_per_pack' ? value : updatedProduct.units_per_pack
    );
    setNewProduct(updatedProduct);
  };

  if (loading) return <div>Loading auth state...</div>;
  if (!storeId) return <div>No store assigned. Please contact your administrator.</div>;
  if (productsLoading) return <div>Loading products...</div>;

  // Bulk Operations section
  // You can move this to a different place in the layout if you prefer
  const bulkOpsSection = (
    <section className="bg-white rounded-lg shadow p-4 max-w-4xl mx-auto mb-5">
      <h2 className="text-xl font-bold text-[#0ABAB5] mb-2">Bulk Operations</h2>
      <BulkOperations storeId={storeId} />
    </section>
  );

  return (
    <div className="p-6 bg-[#F7F9FC] min-h-screen">
      {bulkOpsSection}
      {/* Add Product Form (collapsible card) */}
      <section className="bg-white rounded-lg shadow p-4 max-w-4xl mx-auto mb-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-[#0ABAB5]">Add Product</h2>
          {!formOpen && (
            <button
              className="bg-[#0ABAB5] text-white px-4 py-2 rounded hover:bg-[#099C98] transition-colors"
              onClick={() => setFormOpen(true)}
            >
              + Add Product
            </button>
          )}
          {formOpen && (
            <button
              className="text-gray-500 hover:text-gray-700 px-2 py-1 rounded"
              onClick={() => setFormOpen(false)}
              aria-label="Collapse form"
            >
              ✕
            </button>
          )}
        </div>
        {formOpen && (
          <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Card */}
            <div className="space-y-2">
              <div>
                <input 
                  type="text" 
                  required 
                  placeholder="Product name (as it appears on packaging)" 
                  className="w-full p-2 border rounded" 
                  value={newProduct.name} 
                  onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} 
                />
              </div>
              <div>
                <input 
                  type="text" 
                  required 
                  placeholder="SKU (unique product code)" 
                  className="w-full p-2 border rounded" 
                  value={newProduct.sku} 
                  onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })} 
                />
              </div>
              <div>
                <select 
                  required 
                  className="w-full p-2 border rounded" 
                  value={newProduct.unit_of_measure} 
                  onChange={e => setNewProduct({ ...newProduct, unit_of_measure: e.target.value })}
                >
                  <option value="" disabled>Select unit of measure (e.g. carton, bale, unit)</option>
                  {UNIT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Units per pack (e.g. 12 for a carton of 12)</label>
                <input 
                  type="number" 
                  required 
                  min={1} 
                  className="w-full p-2 border rounded" 
                  value={newProduct.units_per_pack} 
                  onChange={e => handlePackChange('units_per_pack', Number(e.target.value))} 
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Number of packs in stock</label>
                <input 
                  type="number" 
                  required 
                  min={0} 
                  className="w-full p-2 border rounded" 
                  value={newProduct.number_of_packs} 
                  onChange={e => handlePackChange('number_of_packs', Number(e.target.value))} 
                />
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <label className="block text-sm font-medium text-gray-700">Total Quantity (Base Units)</label>
                <p className="text-lg font-semibold text-[#0ABAB5]">{newProduct.quantity} units</p>
                <small className="text-gray-500">Automatically calculated: {newProduct.number_of_packs} packs × {newProduct.units_per_pack} units per pack</small>
              </div>
            </div>
            {/* Right Card */}
            <div className="space-y-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Retail Price (per unit)</label>
                <input 
                  type="number" 
                  required 
                  min="0"
                  step="0.01"
                  className="w-full p-2 border rounded" 
                  value={newProduct.retail_price} 
                  onChange={e => setNewProduct({ ...newProduct, retail_price: parseFloat(e.target.value) })} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Wholesale Price (per unit)</label>
                <input 
                  type="number" 
                  required 
                  min="0"
                  step="0.01" 
                  className="w-full p-2 border rounded" 
                  value={newProduct.wholesale_price} 
                  onChange={e => setNewProduct({ ...newProduct, wholesale_price: parseFloat(e.target.value) })} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Wholesale Threshold (units)</label>
                <input 
                  type="number" 
                  required 
                  min="1"
                  className="w-full p-2 border rounded" 
                  value={newProduct.wholesale_threshold} 
                  onChange={e => setNewProduct({ ...newProduct, wholesale_threshold: parseInt(e.target.value) })} 
                />
                <p className="text-sm text-gray-500">Minimum units to qualify for wholesale price</p>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Cost price per unit (in KES)</label>
                <input 
                  type="number" 
                  required 
                  min={0} 
                  step="0.01" 
                  className="w-full p-2 border rounded" 
                  value={newProduct.cost_price} 
                  onChange={e => setNewProduct({ ...newProduct, cost_price: Number(e.target.value) })} 
                />
              </div>
              <div className="flex items-center">
                <input 
                  type="checkbox" 
                  checked={newProduct.vat_status} 
                  onChange={e => setNewProduct({ ...newProduct, vat_status: e.target.checked })} 
                  className="mr-2" 
                  id="vat_status" 
                />
                <label htmlFor="vat_status" className="text-gray-700">VAT Taxable</label>
              </div>
              <div>
                <input 
                  type="text" 
                  required 
                  placeholder="Product category (e.g. Food, Snacks, Oil)" 
                  className="w-full p-2 border rounded" 
                  value={newProduct.category} 
                  onChange={e => setNewProduct({ ...newProduct, category: e.target.value })} 
                />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" className="px-4 py-2 rounded bg-gray-200 text-gray-700" onClick={() => setFormOpen(false)} disabled={isSubmitting}>Cancel</button>
                <button type="reset" className="px-4 py-2 rounded bg-gray-200 text-gray-700" onClick={() => setNewProduct({ name: '', sku: '', number_of_packs: 0, quantity: 0, unit_of_measure: 'unit', units_per_pack: 1, retail_price: 0, wholesale_price: 0, wholesale_threshold: 1, cost_price: 0, vat_status: true, category: '', parent_product_id: undefined })} disabled={isSubmitting}>Clear</button>
                <button type="submit" className="px-4 py-2 rounded bg-[#0ABAB5] text-white hover:bg-[#099C98]" disabled={isSubmitting}>{isSubmitting ? 'Adding...' : 'Add Product'}</button>
              </div>
            </div>
          </form>
        )}
      </section>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold text-[#0ABAB5]">Inventory Management</h1>
        <div className="flex gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full md:w-64 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#0ABAB5] focus:border-transparent text-gray-800 bg-white placeholder:text-gray-400"
          />
        </div>
      </div>
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4 text-[#0ABAB5]">Product List</h2>
        {filteredProducts && filteredProducts.length === 0 ? (
          <p className="text-gray-500">No products found. Add some products to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="py-1 px-4 font-semibold text-gray-700">Name</th>
                  <th className="py-1 px-4 font-semibold text-gray-700">SKU</th>
                  <th className="py-1 px-4 font-semibold text-gray-700">Qty (Base Units)</th>
                  <th className="py-1 px-4 font-semibold text-gray-700">Unit</th>
                  <th className="py-1 px-4 font-semibold text-gray-700">Units/Pack</th>
                  <th className="py-1 px-4 font-semibold text-gray-700">Retail Price</th>
                  <th className="py-1 px-4 font-semibold text-gray-700">Wholesale Price</th>
                  <th className="py-1 px-4 font-semibold text-gray-700">Wholesale Threshold</th>
                  <th className="py-1 px-4 font-semibold text-gray-700">Cost Price</th>
                  <th className="py-1 px-4 font-semibold text-gray-700">VAT</th>
                  <th className="py-1 px-4 font-semibold text-gray-700">Category</th>
                </tr>
              </thead>
              <tbody>
                {(filteredProducts || []).map((product: Product) => (
                  <tr
                    key={product.id}
                    className={`border-b hover:bg-gray-50 ${product.quantity < LOW_STOCK_THRESHOLD ? 'bg-red-50' : ''}`}
                  >
                    <td className="py-1 px-4 text-gray-800">{product.name}</td>
                    <td className="py-1 px-4 text-gray-800">{product.sku}</td>
                    <td className={`py-1 px-4 font-semibold ${product.quantity < LOW_STOCK_THRESHOLD ? 'text-red-600' : 'text-gray-800'}`}>{product.quantity}</td>
                    <td className="py-1 px-4 text-gray-800">{product.unit_of_measure}</td>
                    <td className="py-1 px-4 text-gray-800">{product.units_per_pack}</td>
                    <td className="py-1 px-4 text-gray-800">KES {product.retail_price?.toFixed(2)}</td>
                    <td className="py-1 px-4 text-gray-800">KES {product.wholesale_price?.toFixed(2)}</td>
                    <td className="py-1 px-4 text-gray-800">{product.wholesale_threshold}</td>
                    <td className="py-1 px-4 text-gray-800">KES {product.cost_price?.toFixed(2)}</td>
                    <td className="py-1 px-4 text-gray-800">{product.vat_status ? 'Taxable' : 'Non-taxable'}</td>
                    <td className="py-1 px-4 text-gray-800">{product.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default InventoryPage; 