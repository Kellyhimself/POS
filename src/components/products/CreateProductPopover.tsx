import React, { useState } from 'react';
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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useSync } from "@/hooks/useSync";
import { useQueryClient } from "@tanstack/react-query";

interface CreateProductPopoverProps {
  storeId: string;
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
  const { createProduct } = useSync(storeId);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    number_of_packs: 0,
    quantity: 0,
    unit_of_measure: 'unit',
    units_per_pack: 1,
    retail_price: 0,
    wholesale_price: 0,
    wholesale_threshold: 1,
    cost_price: 0,
    vat_status: true,
    input_vat_amount: 0,
    category: '',
    parent_product_id: undefined as string | undefined,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await createProduct({
        id: undefined,
        name: formData.name,
        sku: formData.sku,
        category: formData.category,
        store_id: storeId,
        quantity: formData.quantity,
        retail_price: formData.retail_price,
        wholesale_price: formData.wholesale_price,
        wholesale_threshold: formData.wholesale_threshold,
        vat_status: formData.vat_status,
        cost_price: formData.cost_price,
        input_vat_amount: formData.input_vat_amount,
        unit_of_measure: formData.unit_of_measure,
        units_per_pack: formData.units_per_pack,
        parent_product_id: formData.parent_product_id,
        selling_price: formData.retail_price
      });

      queryClient.invalidateQueries({ queryKey: ['products', storeId] });
      setFormData({
        name: '',
        sku: '',
        number_of_packs: 0,
        quantity: 0,
        unit_of_measure: 'unit',
        units_per_pack: 1,
        retail_price: 0,
        wholesale_price: 0,
        wholesale_threshold: 1,
        cost_price: 0,
        vat_status: true,
        input_vat_amount: 0,
        category: '',
        parent_product_id: undefined,
      });
      setOpen(false);
      toast.success('Product Added', {
        description: 'The product has been successfully added.',
        position: 'top-center',
      });
    } catch (error) {
      console.error('Error creating product:', error);
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to add product',
        position: 'top-center',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateTotalQuantity = (numberOfPacks: number, unitsPerPack: number) => {
    return numberOfPacks * unitsPerPack;
  };

  const handlePackChange = (field: 'number_of_packs' | 'units_per_pack', value: number) => {
    const newValue = Math.max(0, value);
    setFormData(prev => {
      const newData = { ...prev, [field]: newValue };
      return {
        ...newData,
        quantity: calculateTotalQuantity(
          field === 'number_of_packs' ? newValue : prev.number_of_packs,
          field === 'units_per_pack' ? newValue : prev.units_per_pack
        )
      };
    });
  };

  return (
    <>
      <Button 
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-[#0ABAB5] hover:bg-[#099C98] text-white"
      >
        <Plus className="h-4 w-4" />
        Add Product
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent 
          side="right" 
          className="w-full sm:w-[800px] sm:max-w-[800px] overflow-y-auto h-screen bg-[#1A1F36] border-l border-[#0ABAB5]/20"
        >
          <SheetHeader className="space-y-2 px-3 sm:px-6">
            <SheetTitle className="text-sm sm:text-base font-semibold text-[#0ABAB5]">
              Add New Product
            </SheetTitle>
            <SheetDescription className="text-[10px] sm:text-xs text-gray-400">
              Fill in the product details below. All fields marked with * are required.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="space-y-3 mt-4 px-3 sm:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Basic Information */}
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="name" className="text-[10px] sm:text-xs font-medium text-gray-300">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    className="h-7 sm:h-8 text-xs sm:text-sm bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="sku" className="text-[10px] sm:text-xs font-medium text-gray-300">SKU</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                    className="h-7 sm:h-8 text-xs sm:text-sm bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]"
                  />
                </div>
              </div>

              {/* Category and Unit */}
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="category" className="text-[10px] sm:text-xs font-medium text-gray-300">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="h-7 sm:h-8 text-xs sm:text-sm bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="unit_of_measure" className="text-[10px] sm:text-xs font-medium text-gray-300">Unit of Measure *</Label>
                  <select
                    id="unit_of_measure"
                    className="w-full h-7 sm:h-8 text-xs sm:text-sm rounded-md border border-[#3A3A3A] bg-[#2D3748] text-gray-200 px-2 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]"
                    value={formData.unit_of_measure}
                    onChange={(e) => setFormData(prev => ({ ...prev, unit_of_measure: e.target.value }))}
                    required
                  >
                    {UNIT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stock Information */}
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="number_of_packs" className="text-[10px] sm:text-xs font-medium text-gray-300">Number of Packs *</Label>
                  <Input
                    id="number_of_packs"
                    type="number"
                    min="0"
                    value={formData.number_of_packs}
                    onChange={(e) => handlePackChange('number_of_packs', parseInt(e.target.value))}
                    required
                    className="h-7 sm:h-8 text-xs sm:text-sm bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="units_per_pack" className="text-[10px] sm:text-xs font-medium text-gray-300">Units per Pack *</Label>
                  <Input
                    id="units_per_pack"
                    type="number"
                    min="1"
                    value={formData.units_per_pack}
                    onChange={(e) => handlePackChange('units_per_pack', parseInt(e.target.value))}
                    required
                    className="h-7 sm:h-8 text-xs sm:text-sm bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]"
                  />
                </div>

                <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-[#2D3748]/50 rounded-lg border border-[#0ABAB5]/20">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-xs font-medium text-gray-300">Total Base Units</span>
                    <span className="text-xs sm:text-sm font-semibold text-[#0ABAB5]">
                      {formData.quantity} {formData.unit_of_measure}
                    </span>
                  </div>
                  <div className="mt-1 text-[8px] sm:text-[10px] text-gray-400">
                    {formData.number_of_packs} packs × {formData.units_per_pack} units
                  </div>
                </div>
              </div>

              {/* Pricing Information */}
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="retail_price" className="text-[10px] sm:text-xs font-medium text-gray-300">Retail Price *</Label>
                  <Input
                    id="retail_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.retail_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, retail_price: parseFloat(e.target.value) }))}
                    required
                    className="h-7 sm:h-8 text-xs sm:text-sm bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="wholesale_price" className="text-[10px] sm:text-xs font-medium text-gray-300">Wholesale Price</Label>
                  <Input
                    id="wholesale_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.wholesale_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, wholesale_price: parseFloat(e.target.value) }))}
                    className="h-7 sm:h-8 text-xs sm:text-sm bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="wholesale_threshold" className="text-[10px] sm:text-xs font-medium text-gray-300">Wholesale Threshold</Label>
                  <Input
                    id="wholesale_threshold"
                    type="number"
                    min="1"
                    value={formData.wholesale_threshold}
                    onChange={(e) => setFormData(prev => ({ ...prev, wholesale_threshold: parseInt(e.target.value) }))}
                    className="h-7 sm:h-8 text-xs sm:text-sm bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="cost_price" className="text-[10px] sm:text-xs font-medium text-gray-300">Cost Price *</Label>
                  <Input
                    id="cost_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.cost_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, cost_price: parseFloat(e.target.value) }))}
                    required
                    className="h-7 sm:h-8 text-xs sm:text-sm bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="input_vat_amount" className="text-[10px] sm:text-xs font-medium text-gray-300">Input VAT Amount</Label>
                  <Input
                    id="input_vat_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.input_vat_amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, input_vat_amount: parseFloat(e.target.value) }))}
                    className="h-7 sm:h-8 text-xs sm:text-sm bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]"
                  />
                  <p className="text-[8px] sm:text-[10px] text-gray-400">VAT paid when purchasing this product</p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="vat_status" className="text-[10px] sm:text-xs font-medium text-gray-300">VAT Status</Label>
                  <select
                    id="vat_status"
                    className="w-full h-7 sm:h-8 text-xs sm:text-sm rounded-md border border-[#3A3A3A] bg-[#2D3748] text-gray-200 px-2 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]"
                    value={formData.vat_status ? 'true' : 'false'}
                    onChange={(e) => setFormData(prev => ({ ...prev, vat_status: e.target.value === 'true' }))}
                  >
                    <option value="true">Taxable</option>
                    <option value="false">Non-taxable</option>
                  </select>
                </div>
              </div>
            </div>

            <SheetFooter className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="w-full sm:w-auto h-7 sm:h-8 px-3 text-xs sm:text-sm border-[#0ABAB5] text-[#0ABAB5] hover:bg-[#0ABAB5] hover:text-white transition-colors"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full sm:w-auto h-7 sm:h-8 px-3 text-xs sm:text-sm bg-[#0ABAB5] hover:bg-[#099C98] text-white transition-colors"
              >
                {isSubmitting ? 'Adding...' : 'Add Product'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
} 