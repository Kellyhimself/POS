import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useUnifiedService } from '@/components/providers/UnifiedServiceProvider';
import { Plus, Scan } from 'lucide-react';
import { BarcodeProductCreator } from './BarcodeProductCreator';

interface CreateProductPopoverProps {
  storeId: string;
}

interface CreateProductInput {
  name: string;
  sku: string;
  barcode: string;
  category: string;
  unit_of_measure: string;
  units_per_pack: number;
  cost_price: number;
  retail_price: number;
  wholesale_price: number;
  wholesale_threshold: number;
  vat_status: boolean | null | undefined;
  store_id?: string;
  parent_product_id?: string;
  selling_price: number;
  input_vat_amount?: number | null;
}

const UNIT_OPTIONS = [
  { value: 'unit', label: 'Unit (Piece)' },
  { value: 'bale', label: 'Bale' },
  { value: 'carton', label: 'Carton' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'packet', label: 'Packet' },
  { value: 'sack', label: 'Sack' },
  { value: 'tin', label: 'Tin' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'crate', label: 'Crate' },
  { value: 'roll', label: 'Roll' },
  { value: 'box', label: 'Box' },
  { value: 'jar', label: 'Jar' },
  { value: 'can', label: 'Can' },
  { value: 'tube', label: 'Tube' },
  { value: 'piece', label: 'Piece' },
  { value: 'set', label: 'Set' },
  { value: 'tray', label: 'Tray' },
  { value: 'sachet', label: 'Sachet' },
  { value: 'ream', label: 'Ream' },
  { value: 'pair', label: 'Pair' },
  { value: 'bundle', label: 'Bundle' },
  { value: 'stick', label: 'Stick' },
  { value: 'sheet', label: 'Sheet' },
  { value: 'bag', label: 'Bag' },
  { value: 'bar', label: 'Bar' },
  { value: 'gallon', label: 'Gallon' },
  { value: 'litre', label: 'Litre' },
  { value: 'ml', label: 'ml' },
  { value: 'kg', label: 'kg' },
  { value: 'gm', label: 'gm' },
  { value: 'meter', label: 'Meter' },
  { value: 'yard', label: 'Yard' },
  { value: 'foot', label: 'Foot' },
  { value: 'inch', label: 'Inch' },
  { value: 'gross', label: 'Gross' },
  { value: 'quart', label: 'Quart' },
  { value: 'pint', label: 'Pint' },
  { value: 'ounce', label: 'Ounce' },
  { value: 'lb', label: 'Pound (lb)' },
];

export function CreateProductPopover({ storeId }: CreateProductPopoverProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBarcodeCreator, setShowBarcodeCreator] = useState(false);
  const { createProduct } = useUnifiedService();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<CreateProductInput>({
    name: '',
    sku: '',
    barcode: '',
    category: '',
    unit_of_measure: 'unit',
    units_per_pack: 1,
    cost_price: 0,
    retail_price: 0,
    wholesale_price: 0,
    wholesale_threshold: 12, // Default Kenya wholesale threshold
    vat_status: true,
    store_id: storeId,
    parent_product_id: undefined,
    selling_price: 0,
    input_vat_amount: 0,
  });

  // Validation function
  const validateForm = (): boolean => {
    return !!(
      formData.name.trim() &&
      formData.unit_of_measure &&
      formData.units_per_pack > 0 &&
      formData.retail_price > 0 &&
      formData.cost_price > 0 &&
      formData.vat_status !== undefined
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Validation Error', {
        description: 'Please fill in all required fields before submitting.',
        position: 'top-center',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Convert empty barcode string to null for database validation
      const barcodeValue = formData.barcode.trim() || null;
      
      // Convert to unified service format - PRODUCT MASTER DATA ONLY
      const productData = {
        name: formData.name,
        sku: formData.sku,
        barcode: barcodeValue, // Use null instead of empty string
        category: formData.category,
        store_id: storeId,
        quantity: 0, // Start with 0 quantity - stock will be added separately
        cost_price: formData.cost_price,
        selling_price: formData.retail_price, // Use retail price as selling price
        retail_price: formData.retail_price,
        wholesale_price: formData.wholesale_price,
        wholesale_threshold: formData.wholesale_threshold,
        vat_status: formData.vat_status || false,
        unit_of_measure: formData.unit_of_measure,
        units_per_pack: formData.units_per_pack,
        input_vat_amount: 0 // Will be calculated when stock is added
      };
      
      await createProduct(productData);
      
      queryClient.invalidateQueries({ queryKey: ['products', storeId] });
      
      // Reset form
      setFormData({
        name: '',
        sku: '',
        barcode: '',
        category: '',
        unit_of_measure: 'unit',
        units_per_pack: 1,
        cost_price: 0,
        retail_price: 0,
        wholesale_price: 0,
        wholesale_threshold: 12,
        vat_status: true,
        store_id: storeId,
        parent_product_id: undefined,
        selling_price: 0,
        input_vat_amount: 0,
      });
      setOpen(false);
      
      toast.success('Product Created', {
        description: 'Product has been created successfully. You can now add stock using the "Add Stock" button.',
        position: 'top-center',
      });
    } catch (error) {
      console.error('Error creating product:', error);
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to create product',
        position: 'top-center',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProductCreated = (productData: { name: string; barcode: string; sku?: string; category?: string; retail_price?: number; wholesale_price?: number; cost_price?: number; unit_of_measure?: string; units_per_pack?: number; vat_status?: boolean }) => {
    console.log('Product created via barcode scanner:', productData);
    toast.success(`Product created: ${productData.name}`);
    setShowBarcodeCreator(false);
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ['products', storeId] });
  };

  // Single-step form rendering
  const renderForm = () => (
    <div className="grid grid-cols-1 xs:grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-3 xs:gap-2 sm:gap-3 md:gap-4">
      {/* Basic Information */}
      <div className="space-y-2 xs:space-y-2 sm:space-y-3 md:space-y-3">
        <h3 className="text-xs xs:text-[11px] sm:text-sm md:text-base font-semibold text-[#0ABAB5] border-b border-[#0ABAB5]/20 pb-1">Basic Information</h3>
        
        <div className="space-y-1 xs:space-y-1 sm:space-y-2 md:space-y-2">
          <Label htmlFor="name" className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-medium text-gray-300">Name *</Label>
          <Input 
            id="name" 
            value={formData.name} 
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} 
            required 
            className="h-7 xs:h-8 sm:h-8 md:h-9 text-xs xs:text-xs sm:text-sm md:text-base bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" 
          />
        </div>
        
        <div className="space-y-1 xs:space-y-1 sm:space-y-2 md:space-y-2">
          <Label htmlFor="sku" className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-medium text-gray-300">SKU (optional)</Label>
          <Input 
            id="sku" 
            value={formData.sku} 
            onChange={e => setFormData(prev => ({ ...prev, sku: e.target.value }))} 
            className="h-7 xs:h-8 sm:h-8 md:h-9 text-xs xs:text-xs sm:text-sm md:text-base bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" 
          />
        </div>
        
        <div className="space-y-1 xs:space-y-1 sm:space-y-2 md:space-y-2">
          <Label htmlFor="barcode" className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-medium text-gray-300">Barcode (optional)</Label>
          <div className="flex gap-1 xs:gap-2 sm:gap-2 md:gap-2">
            <Input 
              id="barcode" 
              value={formData.barcode} 
              onChange={e => setFormData(prev => ({ ...prev, barcode: e.target.value }))} 
              placeholder="EAN-13, UPC, Code 128, etc."
              className="flex-1 h-7 xs:h-8 sm:h-8 md:h-9 text-xs xs:text-xs sm:text-sm md:text-base bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" 
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowBarcodeCreator(true)}
              className="h-7 xs:h-8 sm:h-8 md:h-9 px-2 text-xs xs:text-xs sm:text-sm md:text-base bg-[#2D3748] border-[#3A3A3A] text-gray-200 hover:bg-[#0ABAB5] hover:text-white"
              title="Scan barcode to auto-fill product info"
            >
              <Scan className="w-3 h-3" />
            </Button>
          </div>
        </div>
        
        <div className="space-y-1 xs:space-y-1 sm:space-y-2 md:space-y-2">
          <Label htmlFor="category" className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-medium text-gray-300">Category (optional)</Label>
          <Input 
            id="category" 
            value={formData.category} 
            onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))} 
            className="h-7 xs:h-8 sm:h-8 md:h-9 text-xs xs:text-xs sm:text-sm md:text-base bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" 
          />
        </div>
        
        <div className="space-y-1 xs:space-y-1 sm:space-y-2 md:space-y-2">
          <Label htmlFor="unit_of_measure" className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-medium text-gray-300">Unit of Measure *</Label>
          <select 
            id="unit_of_measure" 
            className="w-full h-7 xs:h-8 sm:h-8 md:h-9 text-xs xs:text-xs sm:text-sm md:text-base rounded-md border border-[#3A3A3A] bg-[#2D3748] text-gray-200 px-2 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" 
            value={formData.unit_of_measure} 
            onChange={e => setFormData(prev => ({ ...prev, unit_of_measure: e.target.value }))} 
            required
          >
            {UNIT_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        
        <div className="space-y-1 xs:space-y-1 sm:space-y-2 md:space-y-2">
          <Label htmlFor="units_per_pack" className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-medium text-gray-300">Units per Pack *</Label>
          <Input 
            id="units_per_pack" 
            type="number" 
            min="1" 
            value={formData.units_per_pack} 
            onChange={e => setFormData(prev => ({ ...prev, units_per_pack: parseInt(e.target.value) || 1 }))} 
            required 
            className="h-7 xs:h-8 sm:h-8 md:h-9 text-xs xs:text-xs sm:text-sm md:text-base bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" 
          />
        </div>
      </div>

      {/* Pricing & VAT */}
      <div className="space-y-2 xs:space-y-2 sm:space-y-3 md:space-y-3">
        <h3 className="text-xs xs:text-[11px] sm:text-sm md:text-base font-semibold text-[#0ABAB5] border-b border-[#0ABAB5]/20 pb-1">Pricing & VAT</h3>
        
        <div className="space-y-1 xs:space-y-1 sm:space-y-2 md:space-y-2">
          <Label htmlFor="cost_price" className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-medium text-gray-300">Cost Price *</Label>
          <Input 
            id="cost_price" 
            type="number" 
            min="0" 
            step="0.01" 
            value={formData.cost_price} 
            onChange={e => setFormData(prev => ({ ...prev, cost_price: parseFloat(e.target.value) || 0 }))} 
            required 
            className="h-7 xs:h-8 sm:h-8 md:h-9 text-xs xs:text-xs sm:text-sm md:text-base bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" 
          />
        </div>
        
        <div className="space-y-1 xs:space-y-1 sm:space-y-2 md:space-y-2">
          <Label htmlFor="retail_price" className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-medium text-gray-300">Retail Price *</Label>
          <Input 
            id="retail_price" 
            type="number" 
            min="0" 
            step="0.01" 
            value={formData.retail_price} 
            onChange={e => setFormData(prev => ({ ...prev, retail_price: parseFloat(e.target.value) || 0 }))} 
            required 
            className="h-7 xs:h-8 sm:h-8 md:h-9 text-xs xs:text-xs sm:text-sm md:text-base bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" 
          />
        </div>
        
        <div className="space-y-1 xs:space-y-1 sm:space-y-2 md:space-y-2">
          <Label htmlFor="wholesale_price" className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-medium text-gray-300">Wholesale Price (optional)</Label>
          <Input 
            id="wholesale_price" 
            type="number" 
            min="0" 
            step="0.01" 
            value={formData.wholesale_price} 
            onChange={e => setFormData(prev => ({ ...prev, wholesale_price: parseFloat(e.target.value) || 0 }))} 
            className="h-7 xs:h-8 sm:h-8 md:h-9 text-xs xs:text-xs sm:text-sm md:text-base bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" 
          />
        </div>
        
        <div className="space-y-1 xs:space-y-1 sm:space-y-2 md:space-y-2">
          <Label htmlFor="wholesale_threshold" className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-medium text-gray-300">Wholesale Threshold (optional)</Label>
          <Input 
            id="wholesale_threshold" 
            type="number" 
            min="0" 
            value={formData.wholesale_threshold} 
            onChange={e => setFormData(prev => ({ ...prev, wholesale_threshold: parseInt(e.target.value) || 0 }))} 
            className="h-7 xs:h-8 sm:h-8 md:h-9 text-xs xs:text-xs sm:text-sm md:text-base bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" 
          />
          <p className="text-[8px] xs:text-[9px] sm:text-[10px] md:text-xs text-gray-400">Minimum quantity for wholesale pricing (default: 12)</p>
        </div>
        
        <div className="space-y-1 xs:space-y-1 sm:space-y-2 md:space-y-2">
          <Label htmlFor="vat_status" className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-medium text-gray-300">VAT Status *</Label>
          <select 
            id="vat_status" 
            className="w-full h-7 xs:h-8 sm:h-8 md:h-9 text-xs xs:text-xs sm:text-sm md:text-base rounded-md border border-[#3A3A3A] bg-[#2D3748] text-gray-200 px-2 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" 
            value={formData.vat_status === true ? 'vatable' : formData.vat_status === false ? 'zero_rated' : 'exempted'} 
            onChange={e => {
              const value = e.target.value as 'vatable' | 'zero_rated' | 'exempted';
              setFormData(prev => ({
                ...prev,
                vat_status: value === 'vatable'
              }));
            }} 
            required
          >
            <option value="vatable">VATable (16%)</option>
            <option value="zero_rated">Zero Rated (0%)</option>
            <option value="exempted">Exempted</option>
          </select>
          <p className="text-[8px] xs:text-[9px] sm:text-[10px] md:text-xs text-gray-400">
            {formData.vat_status === true ? 'VAT will be charged at 16%' : formData.vat_status === false ? 'Zero rated for VAT' : 'No VAT will be charged'}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Button onClick={() => setOpen(true)} className="flex items-center gap-2 bg-[#0ABAB5] hover:bg-[#099C98] text-white text-xs xs:text-xs sm:text-sm md:text-base px-2 xs:px-3 sm:px-4 md:px-6 h-8 xs:h-9 sm:h-10 md:h-11">
        <Plus className="h-4 w-4" />
        Add Product
      </Button>
      
      {/* Barcode Product Creator Modal */}
      {showBarcodeCreator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 xs:p-3 sm:p-4 md:p-6">
          <div className="bg-white rounded-lg w-full max-w-full xs:max-w-2xl sm:max-w-3xl md:max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-3 xs:p-4 sm:p-6 md:p-8">
              <div className="flex items-center justify-between mb-2 xs:mb-3 sm:mb-4 md:mb-6">
                <h2 className="text-base xs:text-lg sm:text-xl md:text-2xl font-bold text-gray-900">Create Product with Barcode Scanner</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBarcodeCreator(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </Button>
              </div>
              <BarcodeProductCreator
                storeId={storeId}
                onProductCreated={handleProductCreated}
              />
            </div>
          </div>
        </div>
      )}
      
      <Sheet open={open} onOpenChange={o => { setOpen(o); }}>
        <SheetContent side="right" className="w-full xs:w-full sm:w-[90vw] md:w-[800px] md:max-w-[800px] overflow-y-auto h-screen bg-[#1A1F36] border-l border-[#0ABAB5]/20 p-2 xs:p-3 sm:p-6 md:p-8">
          <SheetHeader className="space-y-1 xs:space-y-2 sm:space-y-2 md:space-y-3 px-2 xs:px-3 sm:px-6 md:px-8">
            <SheetTitle className="text-xs xs:text-sm sm:text-base md:text-lg font-semibold text-[#0ABAB5]">
              Create New Product
            </SheetTitle>
            <SheetDescription className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm text-gray-400">
              Create product master data. Stock can be added separately using the &quot;Add Stock&quot; button.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-3 xs:space-y-4 sm:space-y-4 md:space-y-6 mt-2 xs:mt-4 px-2 xs:px-3 sm:px-6 md:px-8">
            {renderForm()}
            <SheetFooter className="mt-4 xs:mt-6 flex justify-end gap-1 xs:gap-2 sm:gap-2 md:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="h-8 xs:h-9 sm:h-10 md:h-11 px-2 xs:px-3 sm:px-4 md:px-6 text-xs xs:text-xs sm:text-sm md:text-base border-[#0ABAB5] text-[#0ABAB5] hover:bg-[#0ABAB5] hover:text-white transition-colors"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="h-8 xs:h-9 sm:h-10 md:h-11 px-2 xs:px-3 sm:px-4 md:px-6 text-xs xs:text-xs sm:text-sm md:text-base bg-[#0ABAB5] hover:bg-[#099C98] text-white transition-colors"
              >
                {isSubmitting ? 'Creating...' : 'Create Product'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}