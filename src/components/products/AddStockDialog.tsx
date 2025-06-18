import { useState } from 'react';
import { Database } from '@/types/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle
} from '@/components/ui/dialog';
import { X, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { saveOfflineSupplier, db, updateOfflineProductPrice } from '@/lib/db';

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
      // Check and save supplier if needed
      if (purchaseDetails.supplier_name || purchaseDetails.supplier_vat_no) {
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
      // Update prices offline-first if changed
      if (costPrice !== product.cost_price) {
        await updateOfflineProductPrice(product.id, 'cost_price', costPrice);
      }
      if (retailPrice !== (product.retail_price ?? 0)) {
        await updateOfflineProductPrice(product.id, 'retail_price', retailPrice);
      }
      if (wholesalePrice !== (product.wholesale_price ?? 0)) {
        await updateOfflineProductPrice(product.id, 'wholesale_price', wholesalePrice);
      }
      const kenyaTime = new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' });
      const kenyaDate = new Date(kenyaTime);
      const timestampISO = kenyaDate.toISOString();
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
          supplier_id: supplierId,
        }
      });
      setNumberOfPacks('');
      toast.success('Stock Updated', {
        description: `Successfully added ${packsNum * product.units_per_pack} units (${packsNum} packs) to ${product.name}`,
        position: 'top-center',
      });
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
        className="w-full max-w-[95vw] sm:w-[480px] md:w-[700px] lg:w-[900px] xl:w-[1000px] p-0 bg-[#1A1F36] text-white border border-white/10 rounded-lg shadow-lg"
        style={{ maxHeight: '90vh', minHeight: 'unset' }}
        showCloseButton
      >
        {/* Green header for purchase/invoice style */}
        <div className="flex items-center justify-between px-6 py-3 bg-green-600 rounded-t-lg">
          <DialogTitle className="text-lg font-bold text-green-100">Record Purchase</DialogTitle>
        </div>
        <div className="space-y-4 lg:space-y-0 lg:flex lg:flex-row lg:gap-8 px-4 py-4"
          style={{ minHeight: 'unset', maxHeight: 'calc(90vh - 56px)', overflowY: 'auto' }}
        >
          {/* Left Side: Stock Input and Error */}
          <div className="flex-1 min-w-0 lg:border-r lg:border-white/10 lg:pr-6">
            <div className="text-sm text-gray-400 mb-2">
              Current stock: {product.quantity} units
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="numberOfPacks" className="text-sm font-medium text-white">
                  Number of Packs
                </label>
                <Input
                  id="numberOfPacks"
                  type="number"
                  min="1"
                  value={numberOfPacks}
                  onChange={(e) => setNumberOfPacks(e.target.value)}
                  placeholder="Enter number of packs"
                  className="w-full bg-[#2D3748] border-white/10 text-white placeholder:text-gray-400"
                  disabled={isLoading}
                />
                <div className="text-sm text-gray-400">
                  Units per pack: {product.units_per_pack}
                </div>
                {numberOfPacks && !isNaN(Number(numberOfPacks)) && (
                  <div className="text-sm font-medium text-green-600">
                    Total units to add: {Number(numberOfPacks) * product.units_per_pack}
                  </div>
                )}
                {/* New price fields */}
                <div className="mt-4 space-y-2">
                  <label htmlFor="costPrice" className="text-sm font-medium text-white">Cost Price *</label>
                  <Input
                    id="costPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={costPrice}
                    onChange={e => setCostPrice(Number(e.target.value))}
                    placeholder="Enter cost price"
                    className="w-full bg-[#2D3748] border-white/10 text-white placeholder:text-gray-400"
                    disabled={isLoading}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="retailPrice" className="text-sm font-medium text-white">Retail Price (optional)</label>
                  <Input
                    id="retailPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={retailPrice}
                    onChange={e => setRetailPrice(Number(e.target.value))}
                    placeholder="Enter retail price"
                    className="w-full bg-[#2D3748] border-white/10 text-white placeholder:text-gray-400"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="wholesalePrice" className="text-sm font-medium text-white">Wholesale Price (optional)</label>
                  <Input
                    id="wholesalePrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={wholesalePrice}
                    onChange={e => setWholesalePrice(Number(e.target.value))}
                    placeholder="Enter wholesale price"
                    className="w-full bg-[#2D3748] border-white/10 text-white placeholder:text-gray-400"
                    disabled={isLoading}
                  />
                </div>
                {/* End new price fields */}
                {error && (
                  <Alert variant="destructive" className="py-2 bg-red-500/10 border-red-500/20">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-red-400">{error}</AlertDescription>
                  </Alert>
                )}
              </div>
              {/* On large screens, the submit/cancel buttons are shown on the right side */}
              <div className="flex justify-end gap-2 lg:hidden">
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
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  size="sm"
                >
                  {isLoading ? 'Recording...' : 'Record Purchase'}
                </Button>
              </div>
            </form>
          </div>
          {/* Right Side: Purchase Details */}
          <div className="flex-1 min-w-0 mt-6 lg:mt-0 lg:pl-6">
            <div className="p-3 bg-[#232B45]/60 rounded-lg border border-green-600/20">
              <div className="font-semibold text-xs text-green-600 mb-2">Purchase Details (Optional)</div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label htmlFor="invoice_number" className="text-xs font-medium text-gray-300">Invoice Number *</label>
                  <Input
                    id="invoice_number"
                    value={purchaseDetails.invoice_number}
                    onChange={e => setPurchaseDetails(prev => ({ ...prev, invoice_number: e.target.value }))}
                    className="h-7 text-xs bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-green-600 focus:border-green-600"
                  />
                </div>
                <div>
                  <label htmlFor="supplier_vat_no" className="text-xs font-medium text-gray-300">Supplier VAT No. *</label>
                  <Input
                    id="supplier_vat_no"
                    value={purchaseDetails.supplier_vat_no}
                    onChange={e => setPurchaseDetails(prev => ({ ...prev, supplier_vat_no: e.target.value }))}
                    className="h-7 text-xs bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-green-600 focus:border-green-600"
                  />
                </div>
                <div>
                  <label htmlFor="supplier_name" className="text-xs font-medium text-gray-300">Supplier Name *</label>
                  <Input
                    id="supplier_name"
                    value={purchaseDetails.supplier_name}
                    onChange={e => setPurchaseDetails(prev => ({ ...prev, supplier_name: e.target.value }))}
                    className="h-7 text-xs bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-green-600 focus:border-green-600"
                  />
                </div>
                <div>
                  <label htmlFor="is_vat_included" className="text-xs font-medium text-gray-300">Is VAT Included? *</label>
                  <select
                    id="is_vat_included"
                    value={purchaseDetails.is_vat_included ? 'yes' : 'no'}
                    onChange={e => {
                      const isVat = e.target.value === 'yes';
                      setPurchaseDetails(prev => ({
                        ...prev,
                        is_vat_included: isVat,
                        input_vat_amount: isVat ? product.cost_price * Number(numberOfPacks) * product.units_per_pack * 0.16 : prev.input_vat_amount
                      }));
                    }}
                    className="w-full h-7 text-xs rounded-md border border-[#3A3A3A] bg-[#2D3748] text-gray-200 px-2 focus:ring-green-600 focus:border-green-600"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="input_vat_amount" className="text-xs font-medium text-gray-300">Input VAT Amount (Manual) *</label>
                  <Input
                    id="input_vat_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={purchaseDetails.input_vat_amount}
                    onChange={e => setPurchaseDetails(prev => ({ ...prev, input_vat_amount: parseFloat(e.target.value) }))}
                    className="h-7 text-xs bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-green-600 focus:border-green-600"
                  />
                </div>
              </div>
            </div>
            {/* On large screens, show submit/cancel buttons here */}
            <div className="flex justify-end gap-2 mt-4 hidden lg:flex">
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