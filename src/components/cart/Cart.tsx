import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
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

interface CartProps {
  items: CartItem[];
  onQuantityChange: (index: number, quantity: number) => void;
  onRemoveItem: (index: number) => void;
  onCheckout: () => void;
  paymentMethod: 'cash' | 'mpesa';
  onPaymentMethodChange: (method: 'cash' | 'mpesa') => void;
  vatEnabled: boolean;
  onVatToggle: (enabled: boolean) => void;
  phone: string;
  onPhoneChange: (phone: string) => void;
  isProcessing?: boolean;
}

export function Cart({
  items,
  onQuantityChange,
  onRemoveItem,
  onCheckout,
  paymentMethod,
  onPaymentMethodChange,
  vatEnabled,
  onVatToggle,
  phone,
  onPhoneChange,
  isProcessing = false,
}: CartProps) {
  const subtotal = items.reduce((sum, item) => {
    const price = item.saleMode === 'wholesale' ? (item.product.wholesale_price ?? 0) : (item.product.retail_price ?? 0);
    return sum + (price * item.quantity);
  }, 0);
  
  const vatTotal = items.reduce((sum, item) => sum + (item.vat_amount * item.quantity), 0);
  const total = subtotal + vatTotal;

  return (
    <div className="h-full flex flex-col bg-[#F7F9FC]">
      <div className="h-[40%] overflow-y-auto p-3">
        <h2 className="text-lg font-bold text-[#0ABAB5] mb-2">Cart</h2>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-2">No items in cart</p>
        ) : (
          <div className="space-y-1">
            {items.map((item, index) => (
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
                      {item.saleMode === 'wholesale' ? 'Wholesale:' : 'Retail:'} KES {item.price.toFixed(2)}
                    </p>
                    {item.saleMode === 'wholesale' && item.product.wholesale_threshold && (
                      <p className="text-xs text-gray-500">
                        Min: {item.product.wholesale_threshold}
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
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 border-t border-gray-200 bg-white p-4 space-y-4">
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium text-gray-900">KES {subtotal.toFixed(2)}</span>
          </div>
          {vatEnabled && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">VAT:</span>
              <span className="font-medium text-gray-900">KES {vatTotal.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold pt-1 border-t border-gray-200">
            <span className="text-sm text-gray-900">Total:</span>
            <span className="text-sm text-gray-900">KES {total.toFixed(2)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Switch
              id="vat"
              checked={vatEnabled}
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
                <RadioGroupItem value="mpesa" id="mpesa" className="text-[#0ABAB5] border-[#0ABAB5]" />
                <Label htmlFor="mpesa" className="text-xs text-gray-700">M-Pesa</Label>
              </div>
            </RadioGroup>

            {paymentMethod === 'mpesa' && (
              <div className="space-y-1">
                <Label htmlFor="phone" className="text-xs text-gray-700">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => onPhoneChange(e.target.value)}
                  placeholder="Enter phone number"
                  className="h-8 text-sm border-gray-200 focus:ring-[#0ABAB5] focus:border-transparent"
                />
              </div>
            )}

            <Button
              onClick={onCheckout}
              disabled={items.length === 0 || (paymentMethod === 'mpesa' && !phone) || isProcessing}
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