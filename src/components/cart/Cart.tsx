import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { Database } from '@/types/supabase';
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

  return (
    <div className="h-full flex flex-col bg-[#F7F9FC]">
      <div className="h-[40%] overflow-y-auto p-3">
        <h2 className="text-lg font-bold text-[#0ABAB5] mb-2">Cart</h2>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-2">No items in cart</p>
        ) : (
          <div className="space-y-1">
            {items.map((item, index) => {
              // Calculate display price and VAT amount dynamically for each item
              const dynamicDisplayPrice = calculatePrice(item.price, item.product.vat_status ?? false);
              const dynamicVatAmount = calculateVatAmount(item.price, item.product.vat_status ?? false);
              
              return (
                <div key={item.product.id + '-' + index} className="bg-white rounded-lg shadow p-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.product.name}</p>
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
                  <div className="flex items-center justify-between mt-1">
                    <div className="space-y-0.5">
                      <p className="text-xs text-gray-600">
                        {item.saleMode === 'wholesale' ? 'Wholesale:' : 'Retail:'} KES {dynamicDisplayPrice.toFixed(2)}
                      </p>
                      {/* Only show VAT if it's enabled and amount > 0 */}
                      {isVatEnabled && dynamicVatAmount > 0 && (
                        <p className="text-xs text-gray-500">
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
                        className="h-5 w-5 p-0 border-[#0ABAB5] text-[#0ABAB5] hover:bg-[#0ABAB5] hover:text-white"
                      >
                        -
                      </Button>
                      <span className="w-5 text-center text-xs font-medium text-gray-900">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onQuantityChange(index, item.quantity + 1)}
                        className="h-5 w-5 p-0 border-[#0ABAB5] text-[#0ABAB5] hover:bg-[#0ABAB5] hover:text-white"
                      >
                        +
                      </Button>
                    </div>
                  </div>
                  <div className="mt-1 text-right">
                    <p className="text-xs font-medium text-gray-900">
                      Total: KES {(dynamicDisplayPrice * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 border-t border-gray-200 bg-white p-4 space-y-4">
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium text-gray-900">KES {subtotal.toFixed(2)}</span>
          </div>
          {/* Only show VAT line if VAT is enabled and there's VAT to show */}
          {isVatEnabled && vatTotal > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">VAT:</span>
              <span className="font-medium text-gray-900">KES {vatTotal.toFixed(2)}</span>
            </div>
          )}
          
          {/* Discount Section */}
          <div className="space-y-2 pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Discount:</span>
              <div className="flex items-center gap-2">
                <select
                  value={discountType || ''}
                  onChange={(e) => onDiscountTypeChange(e.target.value as 'percentage' | 'cash' | null)}
                  className="text-xs border rounded px-1 py-0.5"
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
                    className="w-20 text-xs border rounded px-1 py-0.5"
                    placeholder={discountType === 'percentage' ? '%' : 'KES'}
                  />
                )}
              </div>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-xs text-red-600">
                <span>Discount Amount:</span>
                <span>-KES {discountAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between font-semibold pt-1 border-t border-gray-200">
            <span className="text-sm text-gray-900">Total:</span>
            <span className="text-sm text-gray-900">KES {total.toFixed(2)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Switch
              id="vat"
              checked={isVatEnabled}
              onCheckedChange={onVatToggle}
              className="data-[state=checked]:bg-[#0ABAB5]"
            />
            <Label htmlFor="vat" className="text-xs text-gray-700">Enable VAT</Label>
          </div>

          <div className="space-y-3">
            <RadioGroup value={paymentMethod} onValueChange={onPaymentMethodChange} className="flex flex-row gap-4">
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="cash" id="cash" className="text-[#0ABAB5] border-[#0ABAB5]" />
                <Label htmlFor="cash" className="text-xs text-gray-700">Cash</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="mobile money" id="mobile-money" className="text-[#0ABAB5] border-[#0ABAB5]" />
                <Label htmlFor="mobile-money" className="text-xs text-gray-700">Mobile Money</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="credit" id="credit" className="text-[#0ABAB5] border-[#0ABAB5]" />
                <Label htmlFor="credit" className="text-xs text-gray-700">Credit</Label>
              </div>
            </RadioGroup>

            <Button
              onClick={onCheckout}
              disabled={items.length === 0 || isProcessing}
              className="w-full h-9 text-sm bg-[#0ABAB5] hover:bg-[#0ABAB5]/90 text-white font-medium rounded-lg transition-colors"
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
    </div>
  );
} 