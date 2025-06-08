"use client";

import React, { useState } from 'react';
import {useMutation } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import { ProductGrid } from '@/components/products/ProductGrid';
import { Cart } from '@/components/cart/Cart';
import { ReceiptActions } from '@/components/receipt/ReceiptActions';
import { Database } from '@/types/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useSync } from '@/hooks/useSync';

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
  const { user, storeId, isOnline, userMetadata } = useAuth();
  const [phone, setPhone] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa'>('cash');
  const [vatEnabled, setVatEnabled] = useState(true);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<TransactionResponse['receipt'] | null>(null);
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [shouldRefetchProducts, setShouldRefetchProducts] = useState(false);
  const [discountType, setDiscountType] = useState<'percentage' | 'cash' | null>(null);
  const [discountValue, setDiscountValue] = useState<number>(0);
  const { saveSale, updateStock } = useSync(storeId || '');
  const queryClient = useQueryClient();

  console.log('POS Page - Auth State:', { user, storeId, isOnline });

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async ({ product, isWholesale }: { product: Product; isWholesale: boolean }) => {
      // Set initial quantity based on sale mode and minimum threshold
      const minQuantity = isWholesale ? (product.wholesale_threshold || 1) : 1;
      const price = isWholesale ? (product.wholesale_price ?? 0) : (product.retail_price ?? 0);
      const vatAmount = vatEnabled && product.vat_status ? (price * 0.16) : 0;
      const displayPrice = price + vatAmount;

      // Check if item already exists in cart (same product and sale mode)
      const existingIndex = cart.findIndex(
        item => item.product.id === product.id && item.saleMode === (isWholesale ? 'wholesale' : 'retail')
      );

      if (existingIndex !== -1) {
        setCart(prevCart => {
          const updatedCart = [...prevCart];
          const item = updatedCart[existingIndex];
          // When adding to existing item, increment by the minimum threshold for wholesale
          const incrementAmount = isWholesale ? (product.wholesale_threshold || 1) : 1;
          item.quantity += incrementAmount;
          item.vat_amount = vatEnabled && product.vat_status ? (item.price * 0.16) : 0;
          item.displayPrice = item.price + item.vat_amount;
          return updatedCart;
        });
      } else {
        const cartItem: CartItem = {
          product,
          quantity: minQuantity,
          price,
          vat_amount: vatAmount,
          displayPrice,
          saleMode: isWholesale ? 'wholesale' : 'retail'
        };
        setCart(prevCart => [cartItem, ...prevCart]);
      }
    },
  });

  // Quantity adjustment handlers
  const handleQuantityChange = (idx: number, newQty: number) => {
    setCart(prevCart => {
      const updatedCart = [...prevCart];
      const item = updatedCart[idx];
      
      // Ensure quantity meets minimum threshold for wholesale items
      if (item.saleMode === 'wholesale' && item.product.wholesale_threshold) {
        newQty = Math.max(newQty, item.product.wholesale_threshold);
      } else if (newQty < 1) {
        newQty = 1;
      }

      item.quantity = newQty;
      item.vat_amount = vatEnabled && item.product.vat_status ? (item.price * 0.16) : 0;
      item.displayPrice = item.price + item.vat_amount;
      return updatedCart;
    });
  };

  const handleRemoveItem = (idx: number) => {
    setCart(cart => cart.filter((_, i) => i !== idx));
  };

  // Handle VAT toggle
  const handleVatToggle = (enabled: boolean) => {
    setVatEnabled(enabled);
    setCart(cart => cart.map(item => ({
      ...item,
      vat_amount: enabled && item.product.vat_status ? (item.price * 0.16) : 0,
      displayPrice: item.price + (enabled && item.product.vat_status ? (item.price * 0.16) : 0)
    })));
  };

  // Calculate balance for cash payments
  const calculateBalance = () => {
    if (!receiptData || paymentMethod !== 'cash') return 0;
    return cashAmount - receiptData.sale.total;
  };

  // Handle cash amount change
  const handleCashAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setCashAmount(value);
  };

  // Payment mutation
  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error('No store selected');

      // Validate minimum thresholds for wholesale items
      const invalidItems = cart.filter(
        item => item.saleMode === 'wholesale' && 
        item.product.wholesale_threshold && 
        item.quantity < item.product.wholesale_threshold
      );

      if (invalidItems.length > 0) {
        const itemNames = invalidItems.map(item => item.product.name).join(', ');
        throw new Error(`The following items do not meet the minimum wholesale quantity: ${itemNames}`);
      }

      const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const vatTotal = cart.reduce((sum, item) => sum + (item.vat_amount * item.quantity), 0);
      
      // Calculate discount
      const discountAmount = discountType === 'percentage' 
        ? (subtotal * (discountValue / 100))
        : discountType === 'cash' 
          ? Math.min(discountValue, subtotal)
          : 0;
      
      const total_amount = subtotal + vatTotal - discountAmount;

      // Process payment based on method
      if (paymentMethod === 'mpesa') {
        if (!phone) throw new Error('Phone number is required for M-Pesa payment');
        
        if (isOnline) {
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
      }

      // Save the sale
      const saleResult = await saveSale({
        store_id: storeId,
        products: cart.map(item => ({
          id: item.product.id,
          quantity: item.quantity,
          displayPrice: item.displayPrice || item.price,
          vat_amount: item.vat_amount
        })),
        payment_method: paymentMethod,
        total_amount,
        vat_total: vatTotal,
        discount_amount: discountAmount,
        discount_type: discountType
      });

      // Invalidate and refetch products query
      await queryClient.invalidateQueries({ queryKey: ['products', storeId] });
      await queryClient.refetchQueries({ queryKey: ['products', storeId] });

      // Create receipt data structure
      const receiptData: TransactionResponse = {
        success: true,
        transaction: {
          id: saleResult.id,
          store_id: saleResult.store_id,
          total_amount: saleResult.total_amount,
          vat_total: saleResult.vat_total,
          payment_method: saleResult.payment_method,
          customer_phone: paymentMethod === 'mpesa' ? phone : null,
          timestamp: saleResult.timestamp
        },
        receipt: {
          store: {
            id: storeId,
            name: userMetadata?.store_name || 'Store',
            address: userMetadata?.store_address || 'Location'
          },
          sale: {
            id: saleResult.id,
            created_at: saleResult.timestamp,
            payment_method: saleResult.payment_method,
            subtotal: subtotal,
            vat_total: saleResult.vat_total,
            discount_amount: discountAmount,
            discount_type: discountType,
            total: saleResult.total_amount,
            products: cart.map(item => ({
              id: item.product.id,
              name: item.product.name,
              quantity: item.quantity,
              price: item.displayPrice || item.price,
              vat_amount: item.vat_amount,
              vat_status: 'included',
              total: (item.displayPrice || item.price) * item.quantity
            }))
          }
        }
      };

      return receiptData;
    },
    onSuccess: (transactionData: TransactionResponse) => {
      toast.success('Success', {
        description: 'Transaction completed successfully!',
      });
      setCart([]);
      setPhone('');
      setDiscountType(null);
      setDiscountValue(0);
      setReceiptData(transactionData.receipt);
      setShowReceipt(true);
      setShouldRefetchProducts(true);
      // Reset the refetch flag after a short delay
      setTimeout(() => setShouldRefetchProducts(false), 100);
    },
    onError: (error: Error) => {
      toast.error('Error', {
        description: error.message,
      });
    },
  });

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-100">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Product Grid - Full width on mobile, flex-1 on desktop */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-4">
            <ProductGrid 
              onAddToCart={(product, isWholesale) => addToCartMutation.mutate({ product, isWholesale })} 
              shouldRefetch={shouldRefetchProducts}
            />
          </div>

          {/* Cart - Full width on mobile, fixed width on desktop */}
          <div className="w-full lg:w-96 bg-white shadow-lg">
            <Cart
              items={cart}
              onQuantityChange={handleQuantityChange}
              onRemoveItem={handleRemoveItem}
              onPaymentMethodChange={setPaymentMethod}
              onVatToggle={handleVatToggle}
              vatEnabled={vatEnabled}
              paymentMethod={paymentMethod}
              phone={phone}
              onPhoneChange={setPhone}
              onCheckout={() => paymentMutation.mutate()}
              isProcessing={paymentMutation.isPending}
              discountType={discountType}
              discountValue={discountValue}
              onDiscountTypeChange={setDiscountType}
              onDiscountValueChange={setDiscountValue}
            />
          </div>
        </div>
      </div>

      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="w-[95vw] max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Transaction Complete</DialogTitle>
            <DialogDescription>
              Your sale has been completed successfully. Would you like to print or download the receipt?
            </DialogDescription>
          </DialogHeader>
          {receiptData && (
            <div className="py-4">
              {paymentMethod === 'cash' && (
                <div className="mb-4 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label htmlFor="cashAmount" className="text-sm font-medium">
                      Amount Received (KES)
                    </label>
                    <input
                      id="cashAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={cashAmount}
                      onChange={handleCashAmountChange}
                      className="w-full sm:w-32 px-2 py-1 border rounded"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Total Amount:</span>
                    <span>KES {receiptData.sale.total.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>Balance:</span>
                    <span className={calculateBalance() >= 0 ? 'text-green-600' : 'text-red-600'}>
                      KES {calculateBalance().toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
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
                  total: receiptData.sale.total,
                  vat_total: receiptData.sale.vat_total,
                  discount_amount: receiptData.sale.discount_amount,
                  discount_type: receiptData.sale.discount_type,
                  discount_value: discountValue,
                  payment_method: receiptData.sale.payment_method,
                  phone: paymentMethod === 'mpesa' ? phone : undefined,
                  cash_amount: paymentMethod === 'cash' ? cashAmount : undefined,
                  balance: paymentMethod === 'cash' ? calculateBalance() : undefined
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