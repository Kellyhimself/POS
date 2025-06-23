import { useState, useEffect } from 'react';
import { Database } from '@/types/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle
} from '@/components/ui/dialog';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { saveOfflineSupplier, db } from '@/lib/db';
import { useUnifiedService } from '@/components/providers/UnifiedServiceProvider';
import { useSettings } from '@/components/providers/SettingsProvider';

type Product = Database['public']['Tables']['products']['Row'];

interface AddStockDialogProps {
  product: Product;
  onAddStock: (payload: {
    product: Product;
    numberOfPacks: number;
    purchaseDetails: {
      invoice_number: string;
      supplier_vat_no: string;
      is_vat_included: boolean;
      supplier_name: string;
      input_vat_amount: number;
      supplier_id?: string;
    };
  }) => Promise<void>;
  onSuccess?: () => void;
  children: React.ReactNode;
}

export default function AddStockDialog({ 
  product, 
  onAddStock,
  onSuccess,
  children 
}: AddStockDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [numberOfPacks, setNumberOfPacks] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchaseDetails, setPurchaseDetails] = useState({
    invoice_number: '',
    supplier_vat_no: '',
    is_vat_included: false,
    supplier_name: '',
    input_vat_amount: 0
  });
  const [costPrice, setCostPrice] = useState(product.cost_price);
  const [retailPrice, setRetailPrice] = useState(product.retail_price ?? 0);
  const [wholesalePrice, setWholesalePrice] = useState(product.wholesale_price ?? 0);
  const { isOnlineMode, updateProduct } = useUnifiedService();
  const { settings } = useSettings();

  // Helper function to round to 2 decimal places
  const roundToTwoDecimals = (value: number): number => {
    return Math.round(value * 100) / 100;
  };

  // Helper function to calculate VAT amount based on inclusion status using VAT standards
  const calculateVatAmount = (baseAmount: number, isVatIncluded: boolean): number => {
    if (isVatIncluded) {
      // If VAT is included, extract VAT from total amount
      // Use the VAT settings to get the correct rate
      const vatRate = settings?.default_vat_rate ?? 16;
      const basePrice = baseAmount / (1 + vatRate / 100);
      return roundToTwoDecimals(baseAmount - basePrice);
    } else {
      // If VAT is not included, calculate VAT on base amount
      const vatRate = settings?.default_vat_rate ?? 16;
      return roundToTwoDecimals(baseAmount * (vatRate / 100));
    }
  };

  // Recalculate VAT amount when packs or cost price changes
  useEffect(() => {
    if (numberOfPacks && costPrice) {
      const totalQuantity = Number(numberOfPacks) * product.units_per_pack;
      const totalAmount = costPrice * totalQuantity;
      const calculatedVatAmount = calculateVatAmount(totalAmount, purchaseDetails.is_vat_included);
      
      setPurchaseDetails(prev => ({
        ...prev,
        input_vat_amount: calculatedVatAmount
      }));
    }
  }, [numberOfPacks, costPrice, purchaseDetails.is_vat_included, product.units_per_pack, settings?.default_vat_rate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const packsNum = Number(numberOfPacks);
    if (isNaN(packsNum) || packsNum <= 0) {
      setError('Please enter a valid number of packs greater than 0');
      return;
    }
    if (isNaN(costPrice) || costPrice <= 0) {
      setError('Please enter a valid cost price greater than 0');
      return;
    }
    setIsLoading(true);
    try {
      let supplierId: string | null = null;
      
      // Only handle supplier creation in offline mode
      // In online mode, let the OnlineService handle supplier creation
      if (!isOnlineMode && (purchaseDetails.supplier_name || purchaseDetails.supplier_vat_no)) {
        let supplier = null;
        if (purchaseDetails.supplier_vat_no) {
          supplier = await db.suppliers.where('vat_no').equals(purchaseDetails.supplier_vat_no).first();
        }
        if (!supplier && purchaseDetails.supplier_name) {
          supplier = await db.suppliers.where('name').equals(purchaseDetails.supplier_name).first();
        }
        if (!supplier && purchaseDetails.supplier_name) {
          supplier = await saveOfflineSupplier({
            name: purchaseDetails.supplier_name,
            vat_no: purchaseDetails.supplier_vat_no,
            contact_info: '',
          });
        }
        if (supplier) {
          supplierId = supplier.id;
        }
      }
      
      // Update product prices if changed - use UnifiedService for both online and offline modes
      const priceUpdates: Partial<Database['public']['Tables']['products']['Update']> = {};
      let hasPriceChanges = false;
      
      if (costPrice !== product.cost_price) {
        priceUpdates.cost_price = costPrice;
        hasPriceChanges = true;
      }
      if (retailPrice !== (product.retail_price ?? 0)) {
        priceUpdates.retail_price = retailPrice;
        hasPriceChanges = true;
      }
      if (wholesalePrice !== (product.wholesale_price ?? 0)) {
        priceUpdates.wholesale_price = wholesalePrice;
        hasPriceChanges = true;
      }
      
      // Update prices if there are changes
      if (hasPriceChanges) {
        console.log('🔄 AddStockDialog: Updating product prices:', priceUpdates);
        await updateProduct(product.id, priceUpdates);
        console.log('✅ AddStockDialog: Product prices updated successfully');
      }
      
      await onAddStock({
        product: {
          ...product,
          cost_price: costPrice,
          retail_price: retailPrice,
          wholesale_price: wholesalePrice,
        },
        numberOfPacks: packsNum,
        purchaseDetails: {
          ...purchaseDetails,
          supplier_id: supplierId || undefined,
        }
      });
      setNumberOfPacks('');
      toast.success('Stock Updated', {
        description: `Successfully added ${packsNum * product.units_per_pack} units (${packsNum} packs) to ${product.name}`,
        position: 'top-center',
      });
      // Call onSuccess callback if provided
      onSuccess?.();
      setIsOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add stock. Please try again.';
      setError(errorMessage);
      toast.error('Error', {
        description: errorMessage,
        position: 'top-center',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent
        className="w-full max-w-xs xs:max-w-sm sm:max-w-md md:max-w-lg lg:max-w-4xl max-h-[90vh] bg-[#1A1F36] text-white border-[#2D3748] p-2 xs:p-3 sm:p-4 md:p-6 lg:p-8"
        showCloseButton
      >
        {/* Green header for purchase/invoice style */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between px-2 xs:px-1 sm:px-4 md:px-6 py-1 xs:py-3 sm:py-4 md:py-1 bg-green-600 rounded-t-lg">
          <DialogTitle className="text-base xs:text-lg sm:text-xl md:text-2xl font-bold text-green-100">Record Purchase</DialogTitle>
          <p className="text-xs xs:text-sm sm:text-base md:text-lg text-green-200 mt-1 md:mt-0 md:text-right">{product.name}</p>
        </div>
        <div className="flex flex-col lg:flex-row gap-2 xs:gap-3 sm:gap-4 md:gap-6 lg:gap-8 p-2 xs:p-3 sm:p-4 md:p-6"
          style={{ maxHeight: 'calc(90vh - 70px)' }}
        >
          {/* Left Side: Stock Input and Error */}
          <div className="flex-1 min-w-0 lg:border-r lg:border-white/10 lg:pr-6 overflow-y-auto">
            <div className="text-xs xs:text-sm sm:text-base text-gray-400 mb-2">
              Current stock: {product.quantity} units
            </div>
            <form onSubmit={handleSubmit} className="space-y-1 xs:space-y-4 sm:space-y-5 md:space-y-6">
              <div className="space-y-1 xs:space-y-2 sm:space-y-3">
                <label htmlFor="numberOfPacks" className="text-xs xs:text-sm sm:text-base font-medium text-white">
                  Number of Packs
                </label>
                <Input
                  id="numberOfPacks"
                  type="text"
                  value={numberOfPacks}
                  onChange={(e) => setNumberOfPacks(e.target.value)}
                  placeholder="e.g., 5"
                  className="w-full bg-[#2D3748] border-white/10 text-white placeholder:text-gray-400 text-xs xs:text-sm sm:text-base"
                  disabled={isLoading}
                />
                <div className="text-xs xs:text-sm sm:text-base text-gray-400">
                  Units per pack: {product.units_per_pack}
                </div>
                {numberOfPacks && !isNaN(Number(numberOfPacks)) && (
                  <div className="text-xs xs:text-sm sm:text-base font-medium text-green-600">
                    Total units to add: {Number(numberOfPacks) * product.units_per_pack}
                  </div>
                )}
                {/* New price fields */}
                <div className="mt-2 xs:mt-3 sm:mt-4 space-y-1 xs:space-y-2">
                  <label htmlFor="costPrice" className="text-xs xs:text-sm sm:text-base font-medium text-white">Cost Price *</label>
                  <Input
                    id="costPrice"
                    type="text"
                    value={costPrice}
                    onChange={e => setCostPrice(Number(e.target.value))}
                    placeholder="e.g., 150.00"
                    className="w-full bg-[#2D3748] border-white/10 text-white placeholder:text-gray-400 text-xs xs:text-sm sm:text-base"
                    disabled={isLoading}
                    required
                  />
                </div>
                <div className="space-y-1 xs:space-y-2">
                  <label htmlFor="retailPrice" className="text-xs xs:text-sm sm:text-base font-medium text-white">Retail Price (optional)</label>
                  <Input
                    id="retailPrice"
                    type="text"
                    value={retailPrice}
                    onChange={e => setRetailPrice(Number(e.target.value))}
                    placeholder="e.g., 200.00"
                    className="w-full bg-[#2D3748] border-white/10 text-white placeholder:text-gray-400 text-xs xs:text-sm sm:text-base"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-1 xs:space-y-2">
                  <label htmlFor="wholesalePrice" className="text-xs xs:text-sm sm:text-base font-medium text-white">Wholesale Price (optional)</label>
                  <Input
                    id="wholesalePrice"
                    type="text"
                    value={wholesalePrice}
                    onChange={e => setWholesalePrice(Number(e.target.value))}
                    placeholder="e.g., 175.00"
                    className="w-full bg-[#2D3748] border-white/10 text-white placeholder:text-gray-400 text-xs xs:text-sm sm:text-base"
                    disabled={isLoading}
                  />
                </div>
                {/* End new price fields */}
                {error && (
                  <Alert variant="destructive" className="py-2 bg-red-500/10 border-red-500/20">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs xs:text-sm sm:text-base text-red-400">{error}</AlertDescription>
                  </Alert>
                )}
              </div>
              {/* On large screens, the submit/cancel buttons are shown on the right side */}
              <div className="flex flex-col xs:flex-row justify-end gap-2 mt-2 lg:hidden">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isLoading}
                  size="sm"
                  className="border-white/10 text-black hover:bg-white/10 w-full xs:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700 text-white w-full xs:w-auto"
                  size="sm"
                >
                  {isLoading ? 'Recording...' : 'Record Purchase'}
                </Button>
              </div>
            </form>
          </div>
          {/* Right Side: Purchase Details */}
          <div className="flex-1 min-w-0 mt-4 xs:mt-6 lg:mt-0 lg:pl-6 flex flex-col"
            style={{ maxHeight: 'calc(90vh - 70px)' }}
          >
            <div className="flex-1 overflow-y-auto mb-2">
              <div className="p-2 xs:p-3 sm:p-4 bg-[#232B45]/60 rounded-lg border border-green-600/20">
                <div className="font-semibold text-xs xs:text-sm sm:text-base text-green-600 mb-1">Purchase Details (Optional)</div>
                <div className="grid grid-cols-1 gap-1 xs:gap-2 sm:gap-3">
                  <div>
                    <label htmlFor="invoice_number" className="text-xs xs:text-sm sm:text-base font-medium text-gray-300">Invoice Number *</label>
                    <Input
                      id="invoice_number"
                      value={purchaseDetails.invoice_number}
                      onChange={e => setPurchaseDetails(prev => ({ ...prev, invoice_number: e.target.value }))}
                      className="h-6 xs:h-7 sm:h-8 text-xs xs:text-sm sm:text-base bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-green-600 focus:border-green-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="supplier_vat_no" className="text-xs xs:text-sm sm:text-base font-medium text-gray-300">Supplier VAT No. *</label>
                    <Input
                      id="supplier_vat_no"
                      value={purchaseDetails.supplier_vat_no}
                      onChange={e => setPurchaseDetails(prev => ({ ...prev, supplier_vat_no: e.target.value }))}
                      className="h-6 xs:h-7 sm:h-8 text-xs xs:text-sm sm:text-base bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-green-600 focus:border-green-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="supplier_name" className="text-xs xs:text-sm sm:text-base font-medium text-gray-300">Supplier Name *</label>
                    <Input
                      id="supplier_name"
                      value={purchaseDetails.supplier_name}
                      onChange={e => setPurchaseDetails(prev => ({ ...prev, supplier_name: e.target.value }))}
                      className="h-6 xs:h-7 sm:h-8 text-xs xs:text-sm sm:text-base bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-green-600 focus:border-green-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="is_vat_included" className="text-xs xs:text-sm sm:text-base font-medium text-gray-300">VAT Included in cost price? *</label>
                    <select
                      id="is_vat_included"
                      value={purchaseDetails.is_vat_included ? 'yes' : 'no'}
                      onChange={e => {
                        const isVat = e.target.value === 'yes';
                        const totalQuantity = Number(numberOfPacks) * product.units_per_pack;
                        const totalAmount = costPrice * totalQuantity;
                        
                        const calculatedVatAmount = calculateVatAmount(totalAmount, isVat);
                        
                        setPurchaseDetails(prev => ({
                          ...prev,
                          is_vat_included: isVat,
                          input_vat_amount: calculatedVatAmount
                        }));
                      }}
                      className="w-full h-6 xs:h-7 sm:h-8 text-xs xs:text-sm sm:text-base rounded-md border border-[#3A3A3A] bg-[#2D3748] text-gray-200 px-2 focus:ring-green-600 focus:border-green-600"
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="input_vat_amount" className="text-xs xs:text-sm sm:text-base font-medium text-gray-300">Input VAT Amount (KES) *</label>
                    <Input
                      id="input_vat_amount"
                      type="text"
                      value={purchaseDetails.input_vat_amount.toFixed(2)}
                      onChange={e => {
                        const value = parseFloat(e.target.value) || 0;
                        setPurchaseDetails(prev => ({ 
                          ...prev, 
                          input_vat_amount: roundToTwoDecimals(value)
                        }));
                      }}
                      placeholder="e.g., 24.00"
                      className="h-6 xs:h-7 sm:h-8 text-xs xs:text-sm sm:text-base bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-green-600 focus:border-green-600"
                    />
                    <p className="text-xs xs:text-sm sm:text-base text-gray-400 mt-0.5">
                      {purchaseDetails.is_vat_included 
                        ? `VAT included in total amount of KES ${(costPrice * Number(numberOfPacks) * product.units_per_pack).toFixed(2)}`
                        : `VAT calculated on base amount of KES ${(costPrice * Number(numberOfPacks) * product.units_per_pack).toFixed(2)}`
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {/* On large screens, show submit/cancel buttons here */}
            <div className="flex justify-end gap-2 hidden lg:flex flex-shrink-0 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isLoading}
                size="sm"
                className="border-white/10 text-black hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form=""
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700 text-white"
                size="sm"
                onClick={handleSubmit}
              >
                {isLoading ? 'Recording...' : 'Record Purchase'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 