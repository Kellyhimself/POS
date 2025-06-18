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
import { formatVatStatus } from '@/lib/vat/utils';
import { formatEtimsInvoice, submitEtimsInvoice } from '@/lib/etims/utils';
import { useVatSettings } from '@/hooks/useVatSettings';

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
  const [phone, setPhone] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'credit'>('cash');
  const { isVatEnabled, toggleVat, canToggleVat, calculatePrice, calculateVatAmount } = useVatSettings();
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<TransactionResponse['receipt'] | null>(null);
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [shouldRefetchProducts, setShouldRefetchProducts] = useState(false);
  const [discountType, setDiscountType] = useState<'percentage' | 'cash' | null>(null);
  const [discountValue, setDiscountValue] = useState<number>(0);
  const { saveSale } = useSync(storeId || '');
  const queryClient = useQueryClient();

  console.log('POS Page - Auth State:', { user, storeId, isOnline });

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async ({ product, isWholesale }: { product: Product; isWholesale: boolean }) => {
      const minQuantity = isWholesale ? (product.wholesale_threshold || 1) : 1;
      const basePrice = isWholesale ? (product.wholesale_price ?? 0) : (product.retail_price ?? 0);
      const isVatable = product.vat_status ?? false;
      
      const price = calculatePrice(basePrice, isVatable);
      const vatAmount = calculateVatAmount(basePrice, isVatable);
      const displayPrice = price;

      const existingIndex = cart.findIndex(
        item => item.product.id === product.id && item.saleMode === (isWholesale ? 'wholesale' : 'retail')
      );

      if (existingIndex !== -1) {
        setCart(prevCart => {
          const updatedCart = [...prevCart];
          const item = updatedCart[existingIndex];
          const incrementAmount = isWholesale ? (product.wholesale_threshold || 1) : 1;
          item.quantity += incrementAmount;
          item.vat_amount = calculateVatAmount(item.price, item.product.vat_status ?? false);
          item.displayPrice = calculatePrice(item.price, item.product.vat_status ?? false);
          return updatedCart;
        });
      } else {
        const cartItem: CartItem = {
          product,
          quantity: minQuantity,
          price: basePrice,
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
      
      if (item.saleMode === 'wholesale' && item.product.wholesale_threshold) {
        newQty = Math.max(newQty, item.product.wholesale_threshold);
      } else if (newQty < 1) {
        newQty = 1;
      }

      item.quantity = newQty;
      item.vat_amount = calculateVatAmount(item.price, item.product.vat_status ?? false);
      item.displayPrice = calculatePrice(item.price, item.product.vat_status ?? false);
      return updatedCart;
    });
  };

  const handleRemoveItem = (idx: number) => {
    setCart(cart => cart.filter((_, i) => i !== idx));
  };

  // Handle VAT toggle
  const handleVatToggle = () => {
    if (canToggleVat()) {
      toggleVat();
      setCart(cart => cart.map(item => ({
        ...item,
        vat_amount: calculateVatAmount(item.price, item.product.vat_status ?? false),
        displayPrice: calculatePrice(item.price, item.product.vat_status ?? false)
      })));
    }
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

      const invalidItems = cart.filter(
        item => item.saleMode === 'wholesale' && 
        item.product.wholesale_threshold && 
        item.quantity < item.product.wholesale_threshold
      );

      if (invalidItems.length > 0) {
        const itemNames = invalidItems.map(item => item.product.name).join(', ');
        throw new Error(`The following items do not meet the minimum wholesale quantity: ${itemNames}`);
      }

      // Calculate correct subtotal, VAT, and total
      const subtotal = cart.reduce((sum, item) => {
        // Always use base price (before VAT)
        return sum + (item.price * item.quantity);
      }, 0);

      const vatTotal = cart.reduce((sum, item) => {
        // Calculate VAT based on the calculated price
        const priceWithVat = calculatePrice(item.price, item.product.vat_status ?? false);
        const vatAmount = priceWithVat - item.price;
        return sum + (vatAmount * item.quantity);
      }, 0);

      const discountAmount = discountType === 'percentage'
        ? subtotal * (discountValue / 100)
        : discountType === 'cash'
          ? Math.min(discountValue, subtotal)
          : 0;

      const total_amount = cart.reduce((sum, item) => {
        // Use calculatePrice which already includes VAT if applicable
        const priceWithVat = calculatePrice(item.price, item.product.vat_status ?? false);
        return sum + (priceWithVat * item.quantity);
      }, 0) - discountAmount;

      console.log('🔄 Starting payment process:', {
        store_id: storeId,
        total_amount,
        vat_total: vatTotal,
        product_count: cart.length
      });

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

      console.log('✅ Sale saved:', {
        sale_id: saleResult.id,
        total_amount: saleResult.total_amount,
        vat_total: saleResult.vat_total
      });

      // Format and submit eTIMS invoice if VAT is applicable
      if (vatTotal > 0) {
        console.log('📝 Preparing eTIMS invoice for sale:', {
          sale_id: saleResult.id,
          vat_total: vatTotal
        });

        const etimsInvoice = formatEtimsInvoice(saleResult, cart.map(item => ({
          id: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          price: item.price,
          displayPrice: item.displayPrice,
          vat_amount: item.vat_amount
        })), storeId);

        console.log('📄 Formatted eTIMS invoice:', {
          invoice_number: etimsInvoice.invoice_number,
          total_amount: etimsInvoice.total_amount,
          vat_total: etimsInvoice.vat_total,
          items_count: etimsInvoice.items.length
        });

        const { data: etimsData, error: etimsError } = await submitEtimsInvoice(etimsInvoice);
        if (etimsError) {
          console.error('❌ Error saving eTIMS invoice:', etimsError);
        } else {
          console.log('✅ eTIMS invoice saved:', {
            invoice_number: etimsData.invoice_number,
            status: etimsData.status,
            synced: etimsData.synced
          });
        }
      } else {
        console.log('ℹ️ Skipping eTIMS submission - no VAT applicable');
      }

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
            name: user?.user_metadata?.store_name || 'Store',
            address: user?.user_metadata?.store_address || 'Location'
          },
          sale: {
            id: saleResult.id,
            created_at: saleResult.timestamp,
            payment_method: saleResult.payment_method,
            subtotal: subtotal,
            vat_total: saleResult.vat_total,
            ...(discountAmount > 0 && { discount_amount: discountAmount }),
            ...(discountType && { discount_type: discountType }),
            total: saleResult.total_amount,
            products: cart.map(item => ({
              id: item.product.id,
              name: item.product.name,
              quantity: item.quantity,
              price: item.displayPrice || item.price,
              vat_amount: item.vat_amount,
              vat_status: formatVatStatus(item.product.vat_status),
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
    <div className="flex h-screen">
      {/* Main content area - no left margin, will be positioned by the sidebar */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex h-full">
          {/* Container for product grid and cart */}
          <div className="flex-1 flex">
            {/* Product Grid - takes up 60% of the space */}
            <div className="w-[60%] h-full overflow-y-auto">
              <ProductGrid 
                onAddToCart={(product, isWholesale) => addToCartMutation.mutate({ product, isWholesale })} 
                shouldRefetch={shouldRefetchProducts}
              />
            </div>

            {/* Cart - takes up 40% of the space */}
            <div className="w-[40%] h-full border-l border-gray-200 overflow-y-auto">
              <Cart
                items={cart}
                onQuantityChange={handleQuantityChange}
                onRemoveItem={handleRemoveItem}
                onPaymentMethodChange={setPaymentMethod}
                onVatToggle={handleVatToggle}
                vatEnabled={isVatEnabled}
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

        {/* Receipt Dialog */}
        <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
          <DialogContent className="max-w-2xl bg-[#1A1F36] text-white border-[#2D3748]">
            <DialogHeader>
              <DialogTitle className="text-white">Transaction Complete</DialogTitle>
              <DialogDescription className="text-gray-300">
                Your sale has been completed successfully. Would you like to print or download the receipt?
              </DialogDescription>
            </DialogHeader>
            {receiptData && (
              <div className="py-4">
                {paymentMethod === 'cash' && (
                  <div className="mb-4 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label htmlFor="cashAmount" className="text-sm font-medium text-gray-300">
                        Amount Received (KES)
                      </label>
                      <input
                        id="cashAmount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={cashAmount}
                        onChange={handleCashAmountChange}
                        className="w-full sm:w-32 px-2 py-1 border border-[#2D3748] rounded bg-[#2D3748] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-300">
                      <span>Total Amount:</span>
                      <span>KES {receiptData.sale.total.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span className="text-gray-300">Balance:</span>
                      <span className={calculateBalance() >= 0 ? 'text-green-400' : 'text-red-400'}>
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
    </div>
  );
};

export default POSPage; 