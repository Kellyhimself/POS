import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { syncService } from '@/lib/sync';
import { useAuth } from '@/components/providers/AuthProvider';
import { Database } from '@/types/supabase';

type Product = Database['public']['Tables']['products']['Row'];

interface ProductGridProps {
  onAddToCart: (product: Product, isWholesale: boolean) => void;
  onProductsLoaded?: (products: Product[]) => void;
  shouldRefetch?: boolean;
}

export function ProductGrid({ onAddToCart, onProductsLoaded, shouldRefetch = false }: ProductGridProps) {
  const { storeId } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Fetch products
  const { data: products, isLoading, refetch } = useQuery<Product[]>({
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
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    staleTime: 0, // Consider data stale immediately
  });

  // Reset filters and refetch when shouldRefetch changes
  useEffect(() => {
    if (shouldRefetch) {
      setSearch('');
      setSelectedCategory('all');
      refetch();
    }
  }, [shouldRefetch, refetch]);

  // Notify parent component when products are loaded
  useEffect(() => {
    if (products && onProductsLoaded) {
      onProductsLoaded(products);
    }
  }, [products, onProductsLoaded]);

  // Get unique categories
  const categories = products ? ['all', ...new Set(products.map(p => p.category || 'Uncategorized'))] : ['all'];

  // Filter products by search and category
  const filteredProducts = products?.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) ||
      (product.sku && product.sku.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[#0ABAB5]">Loading products...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#F7F9FC]">
      <div className="p-6 space-y-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#0ABAB5]">Products</h2>
          </div>
          <div className="flex items-center gap-4 bg-white p-3 rounded-lg shadow-sm">
            <Input
              type="search"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 border-gray-200 focus:ring-[#0ABAB5] focus:border-transparent"
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-48 p-2 border border-gray-200 rounded focus:ring-[#0ABAB5] focus:border-transparent bg-white"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 max-w-4xl">
          {filteredProducts?.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{product.name}</h3>
                  <p className="text-sm text-gray-500">SKU: {product.sku || 'N/A'}</p>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      onClick={() => onAddToCart(product, false)}
                      className="bg-[#0ABAB5] hover:bg-[#099C98] text-white min-w-[180px]"
                    >
                      Sell as Retail - KES {product.retail_price?.toFixed(2) || '0.00'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAddToCart(product, true)}
                      className="border-[#0ABAB5] text-[#0ABAB5] hover:bg-[#0ABAB5] hover:text-white min-w-[180px]"
                    >
                      Sell as Wholesale - KES {product.wholesale_price?.toFixed(2) || '0.00'}
                    </Button>
                    {product.wholesale_threshold && product.wholesale_threshold > 1 && (
                      <p className="text-xs text-gray-500 text-center">
                        Min. wholesale: {product.wholesale_threshold} {product.unit_of_measure}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-gray-100">
                <span className="text-gray-600">
                  Stock: {product.quantity} {product.unit_of_measure}
                </span>
                {product.vat_status && (
                  <span className="text-[#0ABAB5] font-medium">VAT Included</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredProducts?.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No products found matching your search criteria
          </div>
        )}
      </div>
    </div>
  );
} 