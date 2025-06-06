'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { exportProductsToCSV } from '@/lib/bulk-operations/utils';

interface BulkOperationsProps {
  storeId: string;
}

export function BulkOperations({ storeId }: BulkOperationsProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/products/bulk?store_id=${storeId}`);
      const { data, error } = await response.json();

      if (error) {
        throw new Error(error);
      }

      const csv = exportProductsToCSV(data);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `products_${new Date().toISOString()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Products exported successfully!');
    } catch (error) {
      toast.error('Export Failed: ' + (error instanceof Error ? error.message : 'Failed to export products'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const csvContent = e.target?.result as string;
        
        const response = await fetch('/api/products/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            csvContent,
            store_id: storeId,
          }),
        });

        const { error, message } = await response.json();

        if (error) {
          throw new Error(error);
        }

        toast.success('Import Successful: ' + message);
      };

      reader.readAsText(file);
    } catch (error) {
      toast.error('Import Failed: ' + (error instanceof Error ? error.message : 'Failed to import products'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button
          onClick={handleExport}
          disabled={isLoading}
          variant="outline"
        >
          Export Products
        </Button>
        
        <div className="relative">
          <Input
            type="file"
            accept=".csv"
            onChange={handleImport}
            disabled={isLoading}
            className="hidden"
            id="csv-import"
          />
          <Button
            onClick={() => document.getElementById('csv-import')?.click()}
            disabled={isLoading}
            variant="outline"
          >
            Import Products
          </Button>
        </div>
      </div>
    </div>
  );
} 