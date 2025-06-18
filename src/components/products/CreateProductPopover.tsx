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
import { saveOfflineSupplier, db } from '@/lib/db';

interface CreateProductPopoverProps {
  storeId: string;
}

interface CreateProductInput {
  name: string;
  sku: string;
  quantity: number;
  unit_of_measure: string;
  units_per_pack: number;
  number_of_packs: number;
  retail_price: number;
  wholesale_price: number;
  wholesale_threshold: number;
  cost_price: number;
  vat_status: boolean | null | undefined;
  category: string;
  store_id?: string;
  parent_product_id?: string;
  selling_price: number;
  input_vat_amount?: number | null;
  invoice_number?: string;
  supplier_vat_no?: string;
  is_vat_included: boolean;
  supplier_name?: string;
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

// Update VAT calculation utility to include quantity
const calculateInputVatAmount = (
  cost_price: number,
  vat_status: string,
  is_vat_included: boolean,
  quantity: number
) => {
  if (vat_status !== 'vatable') return 0;
  let vat = 0;
  if (is_vat_included) {
    vat = cost_price * quantity * 16 / 116;
  } else {
    vat = cost_price * quantity * 0.16;
  }
  return Math.round(vat * 100) / 100;
};

export function CreateProductPopover({ storeId }: CreateProductPopoverProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1); // Step state for wizard
  const { createProduct } = useSync(storeId);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<CreateProductInput>({
    name: '',
    sku: '',
    category: '',
    quantity: 0,
    number_of_packs: 0,
    retail_price: 0,
    wholesale_price: 0,
    wholesale_threshold: 0,
    vat_status: true,
    cost_price: 0,
    unit_of_measure: 'unit',
    units_per_pack: 1,
    parent_product_id: undefined,
    selling_price: 0,
    input_vat_amount: 0,
    invoice_number: '',
    supplier_vat_no: '',
    is_vat_included: false,
    supplier_name: '',
  });

  // Add validation function
  const validateStep = (step: number): boolean => {
    if (step === 1) {
      return !!(
        formData.name.trim() &&
        formData.unit_of_measure &&
        formData.number_of_packs > 0 &&
        formData.units_per_pack > 0
      );
    }
    if (step === 2) {
      return !!(
        formData.retail_price > 0 &&
        formData.cost_price > 0 &&
        formData.vat_status
      );
    }
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all required fields before submission
    if (!validateStep(1) || !validateStep(2)) {
      toast.error('Validation Error', {
        description: 'Please fill in all required fields before submitting.',
        position: 'top-center',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Check and save supplier if needed
      if (formData.supplier_name || formData.supplier_vat_no) {
        let supplierExists = false;
        if (formData.supplier_vat_no) {
          const vatMatch = await db.suppliers.where('vat_no').equals(formData.supplier_vat_no).first();
          supplierExists = !!vatMatch;
        }
        if (!supplierExists && formData.supplier_name) {
          const nameMatch = await db.suppliers.where('name').equals(formData.supplier_name).first();
          supplierExists = !!nameMatch;
        }
        if (!supplierExists && formData.supplier_name) {
          await saveOfflineSupplier({
            name: formData.supplier_name,
            vat_no: formData.supplier_vat_no,
            contact_info: '',
          });
        }
      }
      const quantity = (formData.number_of_packs || 0) * (formData.units_per_pack || 1);
      const inputVatAmount = calculateInputVatAmount(formData.cost_price, formData.vat_status === true ? 'vatable' : '', formData.is_vat_included, quantity);
      const productData = {
        ...formData,
        input_vat_amount: inputVatAmount ?? 0,
        vat_status: formData.vat_status,
        store_id: storeId
      };
      const createdProduct = await createProduct(productData);
      // If quantity > 0, save a purchase with supplier details
      if (formData.quantity > 0) {
        let supplierId = null;
        let supplierName = formData.supplier_name || '';
        // Try to find supplier by VAT or name
        let supplier = null;
        if (formData.supplier_vat_no) {
          supplier = await db.suppliers.where('vat_no').equals(formData.supplier_vat_no).first();
        }
        if (!supplier && formData.supplier_name) {
          supplier = await db.suppliers.where('name').equals(formData.supplier_name).first();
        }
        if (!supplier && formData.supplier_name) {
          const newSupplier = await saveOfflineSupplier({
            name: formData.supplier_name,
            vat_no: formData.supplier_vat_no,
            contact_info: '',
          });
          supplierId = newSupplier.id;
          supplierName = newSupplier.name;
        } else if (supplier) {
          supplierId = supplier.id;
          supplierName = supplier.name;
        }
        // Prepare purchase and item
        const kenyaTime = new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' });
        const kenyaDate = new Date(kenyaTime);
        const timestampISO = kenyaDate.toISOString();
        const purchase = {
          store_id: storeId,
          supplier_id: supplierId,
          supplier_name: supplierName,
          invoice_number: formData.invoice_number ?? null,
          supplier_vat_no: formData.supplier_vat_no ?? null,
          is_vat_included: formData.is_vat_included,
          input_vat_amount: formData.input_vat_amount ?? 0,
          total_amount: formData.cost_price * formData.quantity,
          date: timestampISO,
          notes: '',
          synced: false,
          created_at: timestampISO,
        };
        const item = {
          product_id: createdProduct.id, // Use the actual product UUID
          quantity: formData.quantity,
          unit_cost: formData.cost_price,
          vat_amount: formData.input_vat_amount ?? 0,
        };
        await import('@/lib/db').then(dbModule => dbModule.saveOfflinePurchase(purchase, [item]));
      }
      queryClient.invalidateQueries({ queryKey: ['products', storeId] });
      setFormData({
        name: '',
        sku: '',
        category: '',
        quantity: 0,
        number_of_packs: 0,
        retail_price: 0,
        wholesale_price: 0,
        wholesale_threshold: 0,
        vat_status: true,
        cost_price: 0,
        unit_of_measure: 'unit',
        units_per_pack: 1,
        parent_product_id: undefined,
        selling_price: 0,
        input_vat_amount: 0,
        invoice_number: '',
        supplier_vat_no: '',
        is_vat_included: false,
        supplier_name: '',
      });
      setStep(1);
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

  // Step content rendering
  const renderStep = () => {
    if (step === 1) {
  return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                  <Label htmlFor="name" className="text-[10px] sm:text-xs font-medium text-gray-300">Name *</Label>
            <Input id="name" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} required className="h-7 sm:h-8 text-xs sm:text-sm bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" />
                </div>
          <div className="space-y-2">
            <Label htmlFor="sku" className="text-[10px] sm:text-xs font-medium text-gray-300">SKU (optional)</Label>
            <Input id="sku" value={formData.sku} onChange={e => setFormData(prev => ({ ...prev, sku: e.target.value }))} className="h-7 sm:h-8 text-xs sm:text-sm bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" />
                </div>
          <div className="space-y-2">
            <Label htmlFor="category" className="text-[10px] sm:text-xs font-medium text-gray-300">Category (optional)</Label>
            <Input id="category" value={formData.category} onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))} className="h-7 sm:h-8 text-xs sm:text-sm bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" />
              </div>
              <div className="space-y-2">
                  <Label htmlFor="unit_of_measure" className="text-[10px] sm:text-xs font-medium text-gray-300">Unit of Measure *</Label>
            <select id="unit_of_measure" className="w-full h-7 sm:h-8 text-xs sm:text-sm rounded-md border border-[#3A3A3A] bg-[#2D3748] text-gray-200 px-2 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" value={formData.unit_of_measure} onChange={e => setFormData(prev => ({ ...prev, unit_of_measure: e.target.value }))} required>
                    {UNIT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              <div className="space-y-2">
                  <Label htmlFor="number_of_packs" className="text-[10px] sm:text-xs font-medium text-gray-300">Number of Packs *</Label>
            <Input id="number_of_packs" type="number" min="0" value={formData.number_of_packs} onChange={e => handlePackChange('number_of_packs', parseInt(e.target.value))} required className="h-7 sm:h-8 text-xs sm:text-sm bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" />
                </div>
          <div className="space-y-2">
                  <Label htmlFor="units_per_pack" className="text-[10px] sm:text-xs font-medium text-gray-300">Units per Pack *</Label>
            <Input id="units_per_pack" type="number" min="1" value={formData.units_per_pack} onChange={e => handlePackChange('units_per_pack', parseInt(e.target.value))} required className="h-7 sm:h-8 text-xs sm:text-sm bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" />
                </div>
          <div className="col-span-full mt-2 p-2 bg-[#2D3748]/50 rounded-lg border border-[#0ABAB5]/20">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-xs font-medium text-gray-300">Total Base Units</span>
              <span className="text-xs sm:text-sm font-semibold text-[#0ABAB5]">{formData.quantity} {formData.unit_of_measure}</span>
                  </div>
            <div className="mt-1 text-[8px] sm:text-[10px] text-gray-400">{formData.number_of_packs} packs × {formData.units_per_pack} units</div>
                  </div>
                </div>
      );
    }
    if (step === 2) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                  <Label htmlFor="cost_price" className="text-[10px] sm:text-xs font-medium text-gray-300">Cost Price *</Label>
            <Input id="cost_price" type="number" min="0" step="0.01" value={formData.cost_price} onChange={e => setFormData(prev => {
                      const cost_price = parseFloat(e.target.value);
                      const quantity = (prev.number_of_packs || 0) * (prev.units_per_pack || 1);
                      return {
                        ...prev,
                        cost_price,
                        input_vat_amount: calculateInputVatAmount(cost_price, prev.vat_status === true ? 'vatable' : '', prev.is_vat_included, quantity)
                      };
            })} required className="h-7 sm:h-8 text-xs sm:text-sm bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="retail_price" className="text-[10px] sm:text-xs font-medium text-gray-300">Retail Price *</Label>
            <Input id="retail_price" type="number" min="0" step="0.01" value={formData.retail_price} onChange={e => setFormData(prev => ({ ...prev, retail_price: parseFloat(e.target.value) }))} required className="h-7 sm:h-8 text-xs sm:text-sm bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wholesale_price" className="text-[10px] sm:text-xs font-medium text-gray-300">Wholesale Price (optional)</Label>
            <Input id="wholesale_price" type="number" min="0" step="0.01" value={formData.wholesale_price} onChange={e => setFormData(prev => ({ ...prev, wholesale_price: parseFloat(e.target.value) }))} className="h-7 sm:h-8 text-xs sm:text-sm bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wholesale_threshold" className="text-[10px] sm:text-xs font-medium text-gray-300">Wholesale Threshold (optional)</Label>
            <Input id="wholesale_threshold" type="number" min="0" value={formData.wholesale_threshold} onChange={e => setFormData(prev => ({ ...prev, wholesale_threshold: parseInt(e.target.value) }))} className="h-7 sm:h-8 text-xs sm:text-sm bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" />
                </div>

          
          <div className="space-y-2">
            <Label htmlFor="vat_status" className="text-[10px] sm:text-xs font-medium text-gray-300">VAT Status *</Label>
            <select id="vat_status" className="w-full h-7 sm:h-8 text-xs sm:text-sm rounded-md border border-[#3A3A3A] bg-[#2D3748] text-gray-200 px-2 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" value={formData.vat_status === true ? 'vatable' : formData.vat_status === false ? 'zero_rated' : 'exempted'} onChange={e => {
                      const value = e.target.value as 'vatable' | 'zero_rated' | 'exempted';
                      const quantity = (formData.number_of_packs || 0) * (formData.units_per_pack || 1);
                      setFormData(prev => ({
                        ...prev,
                        vat_status: value === 'vatable',
                        input_vat_amount: calculateInputVatAmount(prev.cost_price, value, value === 'vatable' ? prev.is_vat_included : false, quantity),
                        is_vat_included: value === 'vatable' ? prev.is_vat_included : false
                      }));
            }} required>
                    <option value="vatable">VATable (16%)</option>
                    <option value="zero_rated">Zero Rated (0%)</option>
                    <option value="exempted">Exempted</option>
                  </select>
            <p className="text-[8px] sm:text-[10px] text-gray-400">{formData.vat_status === true ? 'VAT will be charged at 16%' : formData.vat_status === false ? 'Zero rated for VAT' : 'No VAT will be charged'}</p>
                </div>
                {formData.vat_status === true && (
            <div className="space-y-2">
              <Label htmlFor="is_vat_included" className="text-[10px] sm:text-xs font-medium text-gray-300">Is VAT included in Cost Price? (optional)</Label>
              <select id="is_vat_included" value={formData.is_vat_included ? 'yes' : 'no'} onChange={e => {
                        const isVat = e.target.value === 'yes';
                        const quantity = (formData.number_of_packs || 0) * (formData.units_per_pack || 1);
                        setFormData(prev => ({
                          ...prev,
                          is_vat_included: isVat,
                          input_vat_amount: calculateInputVatAmount(prev.cost_price, prev.vat_status === true ? 'vatable' : '', isVat, quantity)
                        }));
              }} className="w-full h-7 sm:h-8 text-xs sm:text-sm rounded-md border border-[#3A3A3A] bg-[#2D3748] text-gray-200 px-2 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]">
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                )}
          <div className="space-y-2">
            <Label htmlFor="input_vat_amount" className="text-[10px] sm:text-xs font-medium text-gray-300">Input VAT Amount (optional)</Label>
            <Input id="input_vat_amount" type="number" min="0" step="0.01" value={formData.input_vat_amount ?? 0} onChange={e => setFormData(prev => ({ ...prev, input_vat_amount: parseFloat(e.target.value) }))} className="h-7 sm:h-8 text-xs sm:text-sm bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice_number" className="text-[10px] sm:text-xs font-medium text-gray-300">Invoice Number (optional)</Label>
            <Input id="invoice_number" value={formData.invoice_number} onChange={e => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))} className="h-7 sm:h-8 text-xs sm:text-sm bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supplier_vat_no" className="text-[10px] sm:text-xs font-medium text-gray-300">Supplier VAT No. (optional)</Label>
            <Input id="supplier_vat_no" value={formData.supplier_vat_no} onChange={e => setFormData(prev => ({ ...prev, supplier_vat_no: e.target.value }))} className="h-7 sm:h-8 text-xs sm:text-sm bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" />
                </div>
          <div className="space-y-2">
            <Label htmlFor="supplier_name" className="text-[10px] sm:text-xs font-medium text-gray-300">Supplier Name (optional)</Label>
            <Input id="supplier_name" value={formData.supplier_name} onChange={e => setFormData(prev => ({ ...prev, supplier_name: e.target.value }))} className="h-7 sm:h-8 text-xs sm:text-sm bg-[#2D3748] border-[#3A3A3A] text-gray-200 focus:ring-[#0ABAB5] focus:border-[#0ABAB5]" />
              </div>
            </div>
      );
    }
    return null;
  };

  // Navigation buttons
  const renderFooter = () => (
            <SheetFooter className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-2 sm:gap-3">
      {step > 1 && (
        <Button type="button" variant="outline" onClick={() => setStep(step - 1)} className="w-full sm:w-auto h-7 sm:h-8 px-3 text-xs sm:text-sm border-[#0ABAB5] text-[#0ABAB5] hover:bg-[#0ABAB5] hover:text-white transition-colors">
          Back
        </Button>
      )}
      {step < 2 && (
              <Button
                type="button"
          onClick={() => {
            if (validateStep(step)) {
              setStep(step + 1);
            } else {
              toast.error('Validation Error', {
                description: 'Please fill in all required fields before proceeding.',
                position: 'top-center',
              });
            }
          }} 
          className="w-full sm:w-auto h-7 sm:h-8 px-3 text-xs sm:text-sm bg-[#0ABAB5] hover:bg-[#099C98] text-white transition-colors"
        >
          Next
              </Button>
      )}
      {step === 2 && (
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full sm:w-auto h-7 sm:h-8 px-3 text-xs sm:text-sm bg-[#0ABAB5] hover:bg-[#099C98] text-white transition-colors"
              >
                {isSubmitting ? 'Adding...' : 'Add Product'}
              </Button>
      )}
            </SheetFooter>
  );

  return (
    <>
      <Button onClick={() => setOpen(true)} className="flex items-center gap-2 bg-[#0ABAB5] hover:bg-[#099C98] text-white">
        <Plus className="h-4 w-4" />
        Add Product
      </Button>
      <Sheet open={open} onOpenChange={o => { setOpen(o); if (!o) setStep(1); }}>
        <SheetContent side="right" className="w-full sm:w-[800px] sm:max-w-[800px] overflow-y-auto h-screen bg-[#1A1F36] border-l border-[#0ABAB5]/20">
          <SheetHeader className="space-y-2 px-3 sm:px-6">
            <SheetTitle className="text-sm sm:text-base font-semibold text-[#0ABAB5]">
              Add New Product
            </SheetTitle>
            <SheetDescription className="text-[10px] sm:text-xs text-gray-400">
              Step {step} of 2. Fill in the product details below. All fields marked with * are required.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-3 mt-4 px-3 sm:px-6">
            {renderStep()}
            {renderFooter()}
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
} 