import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Database } from '@/types/supabase';
import { useVatSettings } from '@/hooks/useVatSettings';
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

type PaymentMethod = 'cash' | 'mobile money' | 'credit';
interface CartProps {
  items: CartItem[];
  onQuantityChange: (index: number, quantity: number) => void;
  onRemoveItem: (index: number) => void;
  onCheckout: () => void;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onVatToggle: (enabled: boolean) => void;
  isProcessing?: boolean;
  discountType: 'percentage' | 'cash' | null;
  discountValue: number;
  onDiscountTypeChange: (type: 'percentage' | 'cash' | null) => void;
  onDiscountValueChange: (value: number) => void;
}

export function Cart({
  items,
  onQuantityChange,
  onRemoveItem,
  onCheckout,
  paymentMethod,
  onPaymentMethodChange,
  onVatToggle,
  isProcessing = false,
  discountType,
  discountValue,
  onDiscountTypeChange,
  onDiscountValueChange,
}: CartProps) {
  const { calculatePrice, calculateVatAmount, isVatEnabled } = useVatSettings();
  const { settings: costProtectionSettings } = useCostProtectionSettings();
  
  // Calculate subtotal using dynamically calculated display prices
  const subtotal = items.reduce((sum, item) => {
    const dynamicDisplayPrice = calculatePrice(item.price, item.product.vat_status ?? false);
    return sum + (dynamicDisplayPrice * item.quantity);
  }, 0);
  
  // Calculate discount based on subtotal
  const discountAmount = discountType === 'percentage' 
    ? (subtotal * (discountValue / 100))
    : discountType === 'cash' 
      ? Math.min(discountValue, subtotal) // Ensure discount doesn't exceed subtotal
      : 0;
  
  // Calculate total (subtotal minus discount)
  const total = subtotal - discountAmount;

  // Calculate VAT total for display (only if VAT is enabled) - DYNAMICALLY
  const vatTotal = items.reduce((sum, item) => {
    // Calculate VAT dynamically based on current VAT toggle state
    const vatAmount = calculateVatAmount(item.price, item.product.vat_status ?? false);
    return sum + (vatAmount * item.quantity);
  }, 0);

  // Check for cost protection violations
  const costProtectionWarnings = items
    .map((item, index) => {
      if (!costProtectionSettings.enableCostProtection || !costProtectionSettings.showCostWarnings) {
        return null;
      }

      const costPrice = item.product.cost_price || 0;
      const sellingPrice = item.price;
      const profitMargin = costPrice > 0 ? ((sellingPrice - costPrice) / costPrice) * 100 : 0;
      
      // Check if selling below cost
      if (sellingPrice < costPrice) {
        return {
          type: 'below_cost' as const,
          message: `${item.product.name} is being sold below cost price`,
          itemIndex: index,
          severity: 'high' as const
        };
      }
      
      // Check if profit margin is below minimum
      if (costProtectionSettings.minimumProfitMargin && profitMargin < costProtectionSettings.minimumProfitMargin) {
        return {
          type: 'low_margin' as const,
          message: `${item.product.name} profit margin (${profitMargin.toFixed(1)}%) is below minimum (${costProtectionSettings.minimumProfitMargin}%)`,
          itemIndex: index,
          severity: 'medium' as const
        };
      }
      
      return null;
    })
    .filter(Boolean);

  // Check total cart cost protection violations
  const totalCartWarnings = [];
  if (costProtectionSettings.enableCostProtection && costProtectionSettings.showCostWarnings && items.length > 0) {
    // Calculate total cost and total selling price
    const totalCost = items.reduce((sum, item) => {
      const costPrice = item.product.cost_price || 0;
      return sum + (costPrice * item.quantity);
    }, 0);

    const totalSellingPriceBeforeDiscount = items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);

    // Calculate discount amount
    const discountAmount = discountType === 'percentage' 
      ? (subtotal * (discountValue / 100))
      : discountType === 'cash' 
        ? Math.min(discountValue, subtotal)
        : 0;

    const totalSellingPriceAfterDiscount = totalSellingPriceBeforeDiscount - discountAmount;

    // Check if total cart is below cost
    if (totalSellingPriceAfterDiscount < totalCost) {
      totalCartWarnings.push({
        type: 'total_below_cost' as const,
        message: `Total cart value (KES ${totalSellingPriceAfterDiscount.toFixed(2)}) is below total cost (KES ${totalCost.toFixed(2)}) after discount`,
        severity: 'high' as const
      });
    }

    // Calculate total profit margin
    const totalProfitMargin = totalCost > 0 ? ((totalSellingPriceAfterDiscount - totalCost) / totalCost) * 100 : 0;
    
    if (costProtectionSettings.minimumProfitMargin && totalProfitMargin < costProtectionSettings.minimumProfitMargin) {
      totalCartWarnings.push({
        type: 'total_low_margin' as const,
        message: `Total cart profit margin (${totalProfitMargin.toFixed(1)}%) is below minimum (${costProtectionSettings.minimumProfitMargin}%) after discount`,
        severity: 'medium' as const
      });
    }
  }

  // Combine individual item warnings with total cart warnings
  const allWarnings = [...costProtectionWarnings, ...totalCartWarnings];

  return (
    <div className="h-full flex flex-col bg-[#F7F9FC]">
      {/* Upper section: Selected products, scrollable, 55% height */}
      <div className="basis-[45%] min-h-0 overflow-y-auto p-2 xs:p-1 sm:p-2 md:p-3">
        <h2 className="text-base xs:text-sm sm:text-base md:text-lg font-bold text-[#0ABAB5] mb-2">Cart</h2>
        {/* Cost Protection Warnings */}
        {allWarnings.length > 0 && (
          <div className="mb-3 space-y-2">
            {allWarnings.map((warning, index) => (
              <div
                key={index}
                className={`flex items-center gap-2 p-2 rounded-md text-xs ${
                  warning?.severity === 'high' 
                    ? 'bg-red-50 border border-red-200 text-red-700' 
                    : 'bg-yellow-50 border border-yellow-200 text-yellow-700'
                }`}
              >
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                <span>{warning?.message}</span>
              </div>
            ))}
          </div>
        )}
        {items.length === 0 ? (
          <p className="text-xs xs:text-xs sm:text-sm text-gray-500 text-center py-2">No items in cart</p>
        ) : (
          <div className="space-y-1">
            {items.map((item, index) => {
              const dynamicDisplayPrice = calculatePrice(item.price, item.product.vat_status ?? false);
              const dynamicVatAmount = calculateVatAmount(item.price, item.product.vat_status ?? false);
              const itemWarning = allWarnings.find(w => 
                w && 'itemIndex' in w && (w as { itemIndex: number }).itemIndex === index
              );
              return (
                <div key={item.product.id + '-' + index} className={`bg-white rounded-lg shadow p-2 xs:p-1 sm:p-2 md:p-3 ${
                  itemWarning ? 'border-2 border-red-200' : ''
                }`}>
                  <div className="flex flex-col xs:flex-row sm:flex-row items-start xs:items-center sm:items-center justify-between gap-1 xs:gap-2 sm:gap-2">
                    <p className="text-xs xs:text-xs sm:text-sm font-medium text-gray-900 truncate">{item.product.name}</p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onRemoveItem(index)}
                        className="h-5 w-5 p-0 text-gray-500 hover:text-gray-700"
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col xs:flex-row sm:flex-row items-start xs:items-center sm:items-center justify-between mt-1 gap-1 xs:gap-2 sm:gap-2">
                    <div className="space-y-0.5">
                      <p className="text-xs xs:text-xs sm:text-sm text-gray-600">
                        {item.saleMode === 'wholesale' ? 'Wholesale:' : 'Retail:'} KES {dynamicDisplayPrice.toFixed(2)}
                      </p>
                      {isVatEnabled && dynamicVatAmount > 0 && (
                        <p className="text-xs xs:text-xs sm:text-sm text-gray-500">
                          VAT: KES {dynamicVatAmount.toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onQuantityChange(index, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="h-6 w-6 xs:h-6 xs:w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 p-0 border-[#0ABAB5] text-[#0ABAB5] hover:bg-[#0ABAB5] hover:text-white"
                      >
                        -
                      </Button>
                      <span className="w-6 xs:w-6 sm:w-7 md:w-8 text-center text-xs xs:text-xs sm:text-sm font-medium text-gray-900">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onQuantityChange(index, item.quantity + 1)}
                        className="h-6 w-6 xs:h-6 xs:w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 p-0 border-[#0ABAB5] text-[#0ABAB5] hover:bg-[#0ABAB5] hover:text-white"
                      >
                        +
                      </Button>
                    </div>
                  </div>
                  <div className="mt-1 text-right">
                    <p className="text-xs xs:text-xs sm:text-sm font-medium text-gray-900">
                      Total: KES {(dynamicDisplayPrice * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* Lower section: Summary, payment, checkout, 45% height */}
      <div className="basis-[55%] flex-shrink-0 border-t border-gray-200 bg-white p-3 xs:p-1 sm:p-2 md:p-4 space-y-4 flex flex-col justify-between">
        <div className="space-y-1">
          <div className="flex justify-between text-xs xs:text-xs sm:text-sm">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium text-gray-900">KES {subtotal.toFixed(2)}</span>
          </div>
          {isVatEnabled && vatTotal > 0 && (
            <div className="flex justify-between text-xs xs:text-xs sm:text-sm">
              <span className="text-gray-600">VAT:</span>
              <span className="font-medium text-gray-900">KES {vatTotal.toFixed(2)}</span>
            </div>
          )}
          {costProtectionSettings.enableCostProtection && items.length > 0 && (
            <div className="flex justify-between text-xs xs:text-xs sm:text-sm text-gray-500 pt-1 border-t border-gray-100">
              <span>Total Cost:</span>
              <span>KES {items.reduce((sum, item) => sum + ((item.product.cost_price || 0) * item.quantity), 0).toFixed(2)}</span>
            </div>
          )}
          <div className="space-y-2 pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-xs xs:text-xs sm:text-sm text-gray-600">Discount:</span>
              <div className="flex items-center gap-2">
                <select
                  value={discountType || ''}
                  onChange={(e) => onDiscountTypeChange(e.target.value as 'percentage' | 'cash' | null)}
                  className="text-xs xs:text-xs sm:text-sm border rounded px-1 py-0.5"
                >
                  <option value="">No Discount</option>
                  <option value="percentage">Percentage (%)</option>
                  <option value="cash">Cash (KES)</option>
                </select>
                {discountType && (
                  <input
                    type="number"
                    min="0"
                    max={discountType === 'percentage' ? 100 : subtotal}
                    step={discountType === 'percentage' ? 1 : 0.01}
                    value={discountValue}
                    onChange={(e) => onDiscountValueChange(Number(e.target.value))}
                    className="w-16 xs:w-14 sm:w-20 text-xs xs:text-xs sm:text-sm border rounded px-1 py-0.5"
                    placeholder={discountType === 'percentage' ? '%' : 'KES'}
                  />
                )}
              </div>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-xs xs:text-xs sm:text-sm text-red-600">
                <span>Discount Amount:</span>
                <span>-KES {discountAmount.toFixed(2)}</span>
              </div>
            )}
          </div>
          <div className="flex justify-between font-semibold pt-1 border-t border-gray-200">
            <span className="text-sm xs:text-xs sm:text-sm text-gray-900">Total:</span>
            <span className="text-sm xs:text-xs sm:text-sm text-gray-900">KES {total.toFixed(2)}</span>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex flex-col xs:flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="vat"
                checked={isVatEnabled}
                onCheckedChange={onVatToggle}
                className="data-[state=checked]:bg-[#0ABAB5]"
              />
              <Label htmlFor="vat" className="text-xs xs:text-xs sm:text-sm text-gray-700">Enable VAT</Label>
            </div>
            <RadioGroup value={paymentMethod} onValueChange={onPaymentMethodChange} className="flex flex-row gap-2 xs:gap-1 sm:gap-4">
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="cash" id="cash" className="text-[#0ABAB5] border-[#0ABAB5]" />
                <Label htmlFor="cash" className="text-xs xs:text-xs sm:text-sm text-gray-700">Cash</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="mobile money" id="mobile-money" className="text-[#0ABAB5] border-[#0ABAB5]" />
                <Label htmlFor="mobile-money" className="text-xs xs:text-xs sm:text-sm text-gray-700">Mobile Money</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="credit" id="credit" className="text-[#0ABAB5] border-[#0ABAB5]" />
                <Label htmlFor="credit" className="text-xs xs:text-xs sm:text-sm text-gray-700">Credit</Label>
              </div>
            </RadioGroup>
          </div>
          <Button
            onClick={onCheckout}
            disabled={items.length === 0 || isProcessing}
            className="w-full h-9 text-xs xs:text-xs sm:text-sm bg-[#0ABAB5] hover:bg-[#0ABAB5]/90 text-white font-medium rounded-lg transition-colors"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Processing...
              </>
            ) : (
              'Complete Sale'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
} 