import { createClient } from '@/lib/supabase-clients/pages';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  wholesalePrice: number;
  quantity: number;
  unit_of_measure: string;
  vat_status: string;
  category: string;
  store_id: string;
  created_at: string;
  updated_at: string;
}

export async function getProducts(storeId: string): Promise<Product[]> {
  const response = await fetch(`/api/products?store_id=${storeId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch products');
  }
  return response.json();
} 