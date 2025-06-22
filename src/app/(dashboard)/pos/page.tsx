"use client";

import React, { useState } from 'react';
import {useMutation } from '@tanstack/react-query';
import { useSimplifiedAuth } from '@/components/providers/SimplifiedAuthProvider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import { ProductGrid } from '@/components/products/ProductGrid';
import { Cart } from '@/components/cart/Cart';
import { EnhancedReceiptActions } from '@/components/receipt/EnhancedReceiptActions';
import { useReceiptSettings } from '@/hooks/useReceiptSettings';
import { Database } from '@/types/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { formatEtimsInvoice } from '@/lib/etims/utils';
import { submitEtimsInvoice } from '@/lib/etims/utils';
import { useVatSettings } from '@/hooks/useVatSettings';
import { useUnifiedService } from '@/components/providers/UnifiedServiceProvider';
import { CollapsibleBarcodeScanner } from '@/components/pos/CollapsibleBarcodeScanner';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useCostProtectionSettings } from '@/hooks/useCostProtectionSettings';

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
      discount_amount?: number;
      discount_type?: 'percentage' | 'cash' | null;
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
  const { user, storeId, mode } = useSimplifiedAuth();
  const { currentMode, createSale } = useUnifiedService();
  const [phone, setPhone] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile money' | 'credit'>('cash');
  const { toggleVat, canToggleVat, calculatePrice, calculateVatAmount } = useVatSettings();
  const { settings: receiptSettings } = useReceiptSettings();
  const { settings: costProtectionSettings } = useCostProtectionSettings();
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<TransactionResponse['receipt'] | null>(null);
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [shouldRefetchProducts, setShouldRefetchProducts] = useState(false);
  const [discountType, setDiscountType] = useState<'percentage' | 'cash' | null>(null);
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const queryClient = useQueryClient();

  console.log('POS Page - Auth State:', { user, storeId, mode, currentMode });

  // Handle barcode scan from collapsible scanner
  const handleBarcodeScannerAddToCart = (scannedProduct: { id: string; name: string; barcode?: string; price: number; stock_quantity: number }, quantity: number) => {
    // Convert scanned product to our Product type and add to cart
    const product: Product = {
      id: scannedProduct.id,
      name: scannedProduct.name,
      barcode: scannedProduct.barcode || null,
      retail_price: scannedProduct.price,
      wholesale_price: scannedProduct.price,
      quantity: scannedProduct.stock_quantity,
      unit_of_measure: 'units',
      category: 'Scanned',
      sku: scannedProduct.barcode || null,
      vat_status: false,
      wholesale_threshold: 1,
      store_id: storeId || '',
      cost_price: scannedProduct.price,
      selling_price: scannedProduct.price,
      units_per_pack: 1,
      input_vat_amount: null,
      parent_product_id: null
    };

    // Add the product with the specified quantity
    const existingIndex = cart.findIndex(
      item => item.product.id === product.id && item.saleMode === 'retail'
    );

    if (existingIndex !== -1) {
      setCart(prevCart => {
        const updatedCart = [...prevCart];
        const item = updatedCart[existingIndex];
        item.quantity += quantity;
        item.vat_amount = calculateVatAmount(item.price, item.product.vat_status ?? false);
        item.displayPrice = calculatePrice(item.price, item.product.vat_status ?? false);
        return updatedCart;
      });
      } else {
      const cartItem: CartItem = {
        product,
        quantity: quantity,
        price: scannedProduct.price,
        vat_amount: calculateVatAmount(scannedProduct.price, false),
        displayPrice: calculatePrice(scannedProduct.price, false),
        saleMode: 'retail'
      };
      setCart(prevCart => [cartItem, ...prevCart]);
    }
    
    toast.success(`Added to cart: ${product.name} (${quantity} units)`);
  };

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async ({ product, isWholesale }: { product: Product; isWholesale: boolean }) => {
      const minQuantity = isWholesale ? (product.wholesale_threshold || 1) : 1;
      
      // Safety check for product prices
      const rawPrice = isWholesale ? product.wholesale_price : product.retail_price;
      const basePrice = (typeof rawPrice === 'number' && !isNaN(rawPrice)) ? rawPrice : 0;
      
      if (basePrice === 0) {
        console.warn('⚠️ Product has no valid price:', {
          productId: product.id,
          productName: product.name,
          isWholesale,
          wholesalePrice: product.wholesale_price,
          retailPrice: product.retail_price
        });
      }
      
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
  const handleCashAmountChange = (amount: number) => {
    setCashAmount(amount);
  };

  // Handle closing receipt dialog
  const handleCloseReceipt = () => {
    console.log('POSPage - handleCloseReceipt called, closing dialog');
    setShowReceipt(false);
    setReceiptData(null);
    setCashAmount(0);
    
    // Reset form states for next sale
    setPaymentMethod('cash');
    setPhone('');
    setDiscountType(null);
    setDiscountValue(0);
    
    // Ensure processing state is reset
    setIsProcessingPayment(false);
    
    console.log('POSPage - Receipt dialog closed, ready for next sale');
  };

  // Helper function to map Cart payment method to backend payment method
  const mapPaymentMethod = (method: 'cash' | 'mobile money' | 'credit'): 'cash' | 'mpesa' => {
    switch (method) {
      case 'mobile money':
        return 'mpesa';
      case 'credit':
        return 'cash'; // Map credit to cash for now
      default:
        return method;
    }
  };

  // Payment mutation
  const paymentMutation = useMutation({
    mutationFn: async () => {
      console.log('🔄 Payment mutation started, isPending:', paymentMutation.isPending);
      setIsProcessingPayment(true);
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

      // Check cost protection violations
      if (costProtectionSettings.enableCostProtection) {
        // Calculate total cost and total selling price for the entire cart
        const totalCost = cart.reduce((sum, item) => {
          const costPrice = item.product.cost_price || 0;
          return sum + (costPrice * item.quantity);
        }, 0);

        const totalSellingPriceBeforeDiscount = cart.reduce((sum, item) => {
          return sum + (item.price * item.quantity);
        }, 0);

        // Calculate discount amount
        const discountAmount = discountType === 'percentage'
          ? totalSellingPriceBeforeDiscount * (discountValue / 100)
          : discountType === 'cash'
            ? Math.min(discountValue, totalSellingPriceBeforeDiscount)
            : 0;

        const totalSellingPriceAfterDiscount = totalSellingPriceBeforeDiscount - discountAmount;

        // Check individual item violations
        const itemViolations = cart
          .map((item) => {
            const costPrice = item.product.cost_price || 0;
            const sellingPrice = item.price;
            const profitMargin = costPrice > 0 ? ((sellingPrice - costPrice) / costPrice) * 100 : 0;
            
            // Check if selling below cost
            if (sellingPrice < costPrice) {
              return {
                type: 'below_cost' as const,
                message: `${item.product.name} is being sold below cost price (Cost: KES ${costPrice.toFixed(2)}, Selling: KES ${sellingPrice.toFixed(2)})`,
                severity: 'high' as const
              };
            }
            
            // Check if profit margin is below minimum
            if (costProtectionSettings.minimumProfitMargin && profitMargin < costProtectionSettings.minimumProfitMargin) {
              return {
                type: 'low_margin' as const,
                message: `${item.product.name} profit margin (${profitMargin.toFixed(1)}%) is below minimum (${costProtectionSettings.minimumProfitMargin}%)`,
                severity: 'medium' as const
              };
            }
            
            return null;
          })
          .filter(Boolean);

        // Check total cart violations (after discount)
        const totalCartViolations = [];
        
        if (totalSellingPriceAfterDiscount < totalCost) {
          totalCartViolations.push({
            type: 'total_below_cost' as const,
            message: `Total cart value (KES ${totalSellingPriceAfterDiscount.toFixed(2)}) is below total cost (KES ${totalCost.toFixed(2)}) after discount`,
            severity: 'high' as const
          });
        }

        // Calculate total profit margin
        const totalProfitMargin = totalCost > 0 ? ((totalSellingPriceAfterDiscount - totalCost) / totalCost) * 100 : 0;
        
        if (costProtectionSettings.minimumProfitMargin && totalProfitMargin < costProtectionSettings.minimumProfitMargin) {
          totalCartViolations.push({
            type: 'total_low_margin' as const,
            message: `Total cart profit margin (${totalProfitMargin.toFixed(1)}%) is below minimum (${costProtectionSettings.minimumProfitMargin}%) after discount`,
            severity: 'medium' as const
          });
        }

        // Combine all violations
        const allViolations = [...itemViolations, ...totalCartViolations];

        if (allViolations.length > 0) {
          const highSeverityViolations = allViolations.filter(v => v?.severity === 'high');
          const mediumSeverityViolations = allViolations.filter(v => v?.severity === 'medium');
          
          // Check if user is admin
          const isAdmin = user?.user_metadata?.role === 'admin';
          
          // If there are high severity violations (below cost) and admin approval is required
          if (highSeverityViolations.length > 0 && costProtectionSettings.requireAdminApproval && !isAdmin) {
            const violationMessages = highSeverityViolations.map(v => v?.message).join('; ');
            throw new Error(`Cost protection violation: ${violationMessages}. Admin approval required.`);
          }
          
          // If below cost sales are not allowed even with approval
          if (highSeverityViolations.length > 0 && !costProtectionSettings.allowBelowCostWithApproval) {
            const violationMessages = highSeverityViolations.map(v => v?.message).join('; ');
            throw new Error(`Cost protection violation: ${violationMessages}. Below cost sales are not allowed.`);
          }
          
          // Show warnings for medium severity violations (low margin)
          if (mediumSeverityViolations.length > 0) {
            console.warn('⚠️ Cost protection warnings:', mediumSeverityViolations.map(v => v?.message));
          }
        }
      } else {
        console.log('🔒 Cost protection is disabled - skipping validation');
      }

      // Calculate correct subtotal, VAT, and total
      const subtotal = cart.reduce((sum, item) => {
        // Always use base price (before VAT)
        return sum + (item.price * item.quantity);
      }, 0);

      const vatTotal = cart.reduce((sum, item) => {
        // Calculate VAT using the correct function
        const vatAmount = calculateVatAmount(item.price, item.product.vat_status ?? false);
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
      if (paymentMethod === 'mobile money') {
        if (!phone) throw new Error('Phone number is required for mobile money payment');
        if (mode) {
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
            throw new Error('Mobile money payment failed');
          }
          const mpesaData: MpesaResponse = await mpesaResponse.json();
          if (!mpesaData.success) {
            throw new Error(mpesaData.responseDescription);
          }
        }
      }

      // Save the sale
      const saleResult = await createSale({
        store_id: storeId,
        user_id: user?.id || '',
        products: cart.map(item => ({
          id: item.product.id,
          quantity: item.quantity,
          unit_price: item.displayPrice || item.price,
          vat_amount: item.vat_amount // This is VAT per unit, which is correct
        })),
        payment_method: mapPaymentMethod(paymentMethod),
        total_amount,
        vat_total: vatTotal
      });

      console.log('✅ Sale saved:', {
        sale_id: saleResult.id,
        total: saleResult.total,
        vat_amount: saleResult.vat_amount
      });

      // Format and submit eTIMS invoice if VAT is applicable
      if (vatTotal > 0) {
        console.log('📝 Preparing eTIMS invoice for sale:', {
          sale_id: saleResult.id,
          vat_total: vatTotal
        });

        // Create a mock transaction object for eTIMS formatting
        const mockTransaction = {
          id: saleResult.id,
          store_id: saleResult.store_id || storeId,
          total_amount: saleResult.total,
          vat_total: saleResult.vat_amount || 0,
          payment_method: saleResult.payment_method,
          timestamp: saleResult.timestamp || new Date().toISOString()
        };

        const etimsInvoice = formatEtimsInvoice(mockTransaction, cart.map(item => ({
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
        } else if (etimsData) {
          console.log('✅ eTIMS invoice saved:', {
            invoice_number: etimsData.invoice_number,
            status: etimsData.status
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
          store_id: saleResult.store_id || storeId,
          total_amount: saleResult.total,
          vat_total: saleResult.vat_amount || 0,
          payment_method: saleResult.payment_method || mapPaymentMethod(paymentMethod),
          customer_phone: paymentMethod === 'mobile money' ? phone : null,
          timestamp: saleResult.timestamp || new Date().toISOString()
        },
        receipt: {
          store: {
            id: storeId,
            name: (user?.user_metadata?.store_name as string) || 'Store',
            address: (user?.user_metadata?.store_address as string) || 'Location'
          },
          sale: {
            id: saleResult.id,
            created_at: saleResult.timestamp || new Date().toISOString(),
            payment_method: saleResult.payment_method || mapPaymentMethod(paymentMethod),
            subtotal: subtotal,
            vat_total: saleResult.vat_amount || 0,
            total: saleResult.total,
            discount_amount: discountAmount,
            discount_type: discountType,
            products: cart.map(item => ({
              id: item.product.id,
              name: item.product.name,
              quantity: item.quantity,
              price: item.displayPrice || item.price,
              vat_amount: item.vat_amount,
              vat_status: item.product.vat_status ? 'vatable' : 'non-vatable',
              total: (item.displayPrice || item.price) * item.quantity
            }))
          }
        }
      };

      console.log('✅ Payment mutation completed successfully');
      return receiptData;
    },
    onSuccess: (transactionData: TransactionResponse) => {
      console.log('🎉 Payment mutation onSuccess called');
      setIsProcessingPayment(false);
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
      
      // No page refresh needed - state is already clean for next sale
      console.log('✅ Sale completed, ready for next transaction');
    },
    onError: (error: Error) => {
      console.log('❌ Payment mutation onError called:', error.message);
      setIsProcessingPayment(false);
      toast.error('Error', {
        description: error.message,
      });
    },
  });

  return (
    <div className="flex h-screen">
      {/* Main content area */}
      <div className="flex-1 flex h-full">
        {/* Container for scanner, product grid and cart */}
        <div className="flex-1 flex">
          {/* Barcode Scanner - takes up 20% of the space */}
          <div className="w-[20%] h-full p-4 flex justify-center">
            <CollapsibleBarcodeScanner 
              onAddToCart={handleBarcodeScannerAddToCart}
            />
      </div>

          {/* Product Grid - takes up 50% of the space */}
          <div className="w-[50%] h-full overflow-y-auto">
              <ProductGrid 
                onAddToCart={(product, isWholesale) => addToCartMutation.mutate({ product, isWholesale })} 
                shouldRefetch={shouldRefetchProducts}
              />
            </div>

          {/* Cart - takes up 30% of the space */}
          <div className="w-[30%] h-full border-l border-gray-200 overflow-y-auto">
              <Cart
                items={cart}
                onQuantityChange={handleQuantityChange}
                onRemoveItem={handleRemoveItem}
                onPaymentMethodChange={setPaymentMethod}
                onVatToggle={handleVatToggle}
                paymentMethod={paymentMethod}
                onCheckout={() => {
                  console.log('🛒 Cart checkout clicked, paymentMutation.isPending:', paymentMutation.isPending, 'isProcessingPayment:', isProcessingPayment);
                  // Prevent multiple submissions by checking both states
                  if (!paymentMutation.isPending && !isProcessingPayment) {
                    paymentMutation.mutate();
                  } else {
                    console.log('⚠️ Checkout blocked - payment already in progress');
                  }
                }}
                isProcessing={isProcessingPayment || paymentMutation.isPending}
                discountType={discountType}
                discountValue={discountValue}
                onDiscountTypeChange={setDiscountType}
                onDiscountValueChange={setDiscountValue}
              />
            </div>
          </div>
        </div>

        {/* Receipt Dialog */}
        <Dialog open={showReceipt}>
          <DialogContent className="max-w-2xl lg:max-w-4xl max-h-[90vh] bg-[#1A1F36] text-white border-[#2D3748]" showCloseButton={false}>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-white">Transaction Complete</DialogTitle>

                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCloseReceipt}
                  className="text-gray-400 hover:text-white hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>
            {receiptData && (
              <div className="py-4">
                <EnhancedReceiptActions 
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
                    phone: paymentMethod === 'mobile money' ? phone : undefined,
                    cash_amount: paymentMethod === 'cash' ? cashAmount : undefined,
                    balance: paymentMethod === 'cash' ? calculateBalance() : undefined
                  }}
                  onComplete={handleCloseReceipt}
                  autoPrint={receiptSettings.autoPrint}
                  autoDownload={receiptSettings.autoDownload}
                  enableAutoActions={
                    // For cash payments, only enable auto-actions if cash amount is properly set
                    paymentMethod === 'cash' 
                      ? cashAmount > 0 && cashAmount >= receiptData.sale.total
                      : true // For non-cash payments, always enable
                  }
                  onCashAmountChange={handleCashAmountChange}
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
    </div>
  );
};

export default POSPage; 