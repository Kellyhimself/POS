import { useState } from 'react';
import { Database } from '@/types/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { X, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

type Product = Database['public']['Tables']['products']['Row'];

interface AddStockPopoverProps {
  product: Product;
  onAddStock: (productId: string, quantity: number) => Promise<void>;
  onSuccess?: () => void;
  children: React.ReactNode;
}

export default function AddStockPopover({ 
  product, 
  onAddStock,
  onSuccess,
  children 
}: AddStockPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [numberOfPacks, setNumberOfPacks] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const packsNum = Number(numberOfPacks);
    if (isNaN(packsNum) || packsNum <= 0) {
      setError('Please enter a valid number of packs greater than 0');
      return;
    }

    const totalQuantity = packsNum * product.units_per_pack;

    setIsLoading(true);
    try {
      await onAddStock(product.id, totalQuantity);
      setNumberOfPacks('');
      toast.success('Stock Updated', {
        description: `Successfully added ${totalQuantity} units (${packsNum} packs) to ${product.name}`,
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
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Add Stock - {product.name}</h4>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="text-sm text-gray-500">
            Current stock: {product.quantity} units
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="numberOfPacks" className="text-sm font-medium">
                Number of Packs
              </label>
              <Input
                id="numberOfPacks"
                type="number"
                min="1"
                value={numberOfPacks}
                onChange={(e) => setNumberOfPacks(e.target.value)}
                placeholder="Enter number of packs"
                className="w-full"
                disabled={isLoading}
              />
              <div className="text-sm text-gray-500">
                Units per pack: {product.units_per_pack}
              </div>
              {numberOfPacks && !isNaN(Number(numberOfPacks)) && (
                <div className="text-sm font-medium text-[#0ABAB5]">
                  Total units to add: {Number(numberOfPacks) * product.units_per_pack}
                </div>
              )}
              {error && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isLoading}
                size="sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-[#0ABAB5] hover:bg-[#099C98] text-white"
                size="sm"
              >
                {isLoading ? 'Adding...' : 'Add Stock'}
              </Button>
            </div>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  );
} 