"use client";

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/AuthProvider';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ProductGrid } from '@/components/products/ProductGrid';
import { Cart } from '@/components/cart/Cart';
import { syncService } from '@/lib/sync';
import { ReceiptActions } from '@/components/receipt/ReceiptActions';
import { Database } from '@/types/supabase';

type Product = Database['public']['Tables']['products']['Row'];

interface CartItem {
  product: Product;
  quantity: number;
  price: number;
  vat_amount: number;
  displayPrice?: number;
  saleMode?: 'retail' | 'wholesale';
}

interface TransactionResponse {
  success: boolean;
  transaction: {
    id: string;
    store_id: string;
    total_amount: number;
    vat_total: number;
    payment_method: string;
    customer_phone: string | null;
    timestamp: string;
  };
  receipt: {
    store: {
      id: string;
      name: string;
      address: string;
    };
    sale: {
      id: string;
      created_at: string;
      payment_method: string;
      subtotal: number;
      vat_total: number;
      total: number;
      products: Array<{
        id: string;
        name: string;
        quantity: number;
        price: number;
        vat_amount: number;
        vat_status: string;
        total: number;
      }>;
    };
  };
}

interface MpesaResponse {
  success: boolean;
  checkoutRequestId: string;
  merchantRequestId: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
}

const POSPage = () => {
  const { user, storeId, isOnline } = useAuth();
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [phone, setPhone] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa'>('cash');
  const [vatEnabled, setVatEnabled] = useState(true);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<TransactionResponse['receipt'] | null>(null);

  console.log('POS Page - Auth State:', { user, storeId, isOnline });

  // Query for products
  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      try {
        return await syncService.getProducts(storeId);
      } catch (error) {
        console.error('Error fetching products:', error);
        throw error;
      }
    },
    enabled: !!storeId,
  });

  console.log('POS Page - Query State:', { products, isLoadingProducts });

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async ({ product, isWholesale }: { product: Product; isWholesale: boolean }) => {
      const quantity = 1;
      const price = isWholesale ? (product.wholesale_price ?? 0) : (product.retail_price ?? 0);
      const vatAmount = vatEnabled ? (price * 0.16) : 0;
      const displayPrice = price + vatAmount;

      // Check if item already exists in cart (same product and sale mode)
      const existingIndex = cart.findIndex(
        item => item.product.id === product.id && item.saleMode === (isWholesale ? 'wholesale' : 'retail')
      );

      if (existingIndex !== -1) {
        const updatedCart = [...cart];
        const item = updatedCart[existingIndex];
        item.quantity += quantity;
        item.vat_amount = vatEnabled ? (item.price * 0.16) : 0;
        setCart(updatedCart);
      } else {
        const cartItem: CartItem = {
          product,
          quantity,
          price,
          vat_amount: vatAmount,
          displayPrice,
          saleMode: isWholesale ? 'wholesale' : 'retail'
        };
        setCart([cartItem, ...cart]);
      }
    },
  });

  // Quantity adjustment handlers
  const handleQuantityChange = (idx: number, newQty: number) => {
    if (newQty < 1) return;
    
    setCart(cart => {
      const updatedCart = [...cart];
      const item = updatedCart[idx];
      item.quantity = newQty;
      item.vat_amount = vatEnabled ? (item.price * 0.16) : 0;
      return updatedCart;
    });
  };

  const handleRemoveItem = (idx: number) => {
    setCart(cart => cart.filter((_, i) => i !== idx));
  };

  // Payment mutation
  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error('No store selected');
      const total_amount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const vat_total = cart.reduce((sum, item) => sum + (item.vat_amount * item.quantity), 0);

      // Process payment based on method
      if (paymentMethod === 'mpesa') {
        if (!phone) throw new Error('Phone number is required for M-Pesa payment');
        
        const mpesaResponse = await fetch('/api/mpesa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            amount: total_amount, 
            phone, 
            store_id: storeId 
          }),
        });

        if (!mpesaResponse.ok) {
          throw new Error('M-Pesa payment failed');
        }

        const mpesaData: MpesaResponse = await mpesaResponse.json();
        if (!mpesaData.success) {
          throw new Error(mpesaData.responseDescription);
        }
      }

      // Create transaction record
      const transactionResponse = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          products: cart.map(item => ({
            id: item.product.id,
            name: item.product.name,
            quantity: item.quantity,
            price: item.displayPrice || item.price,
            vat_amount: item.vat_amount,
            saleMode: item.saleMode || 'retail',
            displayPrice: item.displayPrice || item.price
          })),
          payment_method: paymentMethod,
          total_amount,
          vat_total,
          customer_phone: paymentMethod === 'mpesa' ? phone : null
        }),
      });

      if (!transactionResponse.ok) {
        const errorData = await transactionResponse.json();
        throw new Error(errorData.error || 'Failed to create transaction');
      }

      const transactionData: TransactionResponse = await transactionResponse.json();
      return transactionData;
    },
    onSuccess: (transactionData: TransactionResponse) => {
      toast.success('Success', {
        description: 'Transaction completed successfully!',
      });
      setCart([]);
      setPhone('');
      console.log('Transaction Data:', transactionData);
      console.log('Receipt Data:', transactionData.receipt);
      setReceiptData(transactionData.receipt);
      setShowReceipt(true);
    },
    onError: (error: Error) => {
      toast.error('Error', {
        description: error.message,
      });
    },
  });

  // Sync handler
  const handleSync = async () => {
    if (!storeId) return;
    setIsSyncing(true);
    try {
      await syncService.initialSync(storeId);
      toast.success('Sync completed successfully');
      setIsSyncDialogOpen(false);
    } catch (error) {
      toast.error('Sync failed', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            <ProductGrid onAddToCart={(product, isWholesale) => addToCartMutation.mutate({ product, isWholesale })} />
          </div>
          <div className="w-96 bg-white shadow-lg">
            <Cart
              items={cart}
              onQuantityChange={handleQuantityChange}
              onRemoveItem={handleRemoveItem}
              onPaymentMethodChange={setPaymentMethod}
              onVatToggle={setVatEnabled}
              vatEnabled={vatEnabled}
              paymentMethod={paymentMethod}
              phone={phone}
              onPhoneChange={setPhone}
              onCheckout={() => paymentMutation.mutate()}
              isProcessing={paymentMutation.isPending}
            />
          </div>
        </div>
      </div>

      <Dialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-purple-900">Sync Data</DialogTitle>
            <DialogDescription className="text-gray-600">
              This will synchronize your offline data with the server. Make sure you have a stable internet connection.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-3 mt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsSyncDialogOpen(false)}
              className="border-purple-200 hover:bg-purple-50 text-purple-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSync} 
              disabled={isSyncing}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
            >
              {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSyncing ? 'Syncing...' : 'Start Sync'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transaction Complete</DialogTitle>
            <DialogDescription>
              Your sale has been completed successfully. Would you like to print or download the receipt?
            </DialogDescription>
          </DialogHeader>
          {receiptData && (
            <div className="py-4">
              <ReceiptActions 
                receipt={{
                  id: receiptData.sale.id,
                  items: receiptData.sale.products.map(product => ({
                    name: product.name,
                    quantity: product.quantity,
                    price: product.price,
                    vat_amount: product.vat_amount,
                    vat_status: product.vat_status,
                    total: product.total
                  })),
                  subtotal: receiptData.sale.subtotal,
                  vat_total: receiptData.sale.vat_total,
                  total: receiptData.sale.total,
                  store: receiptData.store,
                  created_at: receiptData.sale.created_at,
                  payment_method: receiptData.sale.payment_method
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POSPage; 