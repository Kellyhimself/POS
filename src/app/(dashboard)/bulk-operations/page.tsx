'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { syncService } from '@/lib/sync';
import { Database } from '@/types/supabase';
import { exportProductsToCSV, generateStockUpdateTemplate, validateProductCSV, validateStockUpdateCSV, importProductsFromCSV } from '@/lib/bulk-operations/utils';
import { submitStockUpdateEtimsInvoice } from '@/lib/etims/utils';
import { Search, Download, Upload, Package, FileText, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Product = Database['public']['Tables']['products']['Row'];

interface ImportProgress {
  total: number;
  processed: number;
  success: number;
  failed: number;
  errors: string[];
}

export default function BulkOperationsPage() {
  const { storeId } = useAuth();
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [activeTab, setActiveTab] = useState('products');

  // Fetch products
  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['products', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      try {
        const data = await syncService.getProducts(storeId);
        return data;
      } catch (error) {
        console.error('Error fetching products:', error);
        throw error;
      }
    },
    enabled: !!storeId,
  });

  // Filter products by search
  const filteredProducts = products?.filter((product) =>
    product.name.toLowerCase().includes(search.toLowerCase()) ||
    (product.sku && product.sku.toLowerCase().includes(search.toLowerCase()))
  );

  const handleExport = async () => {
    if (!products) return;
    
    try {
      setIsLoading(true);
      const csv = exportProductsToCSV(products);
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

  const handleDownloadTemplate = async (type: 'products' | 'stock') => {
    try {
      setIsLoading(true);
      let csv: string;
      let filename: string;

      if (type === 'products') {
        csv = exportProductsToCSV([]); // Empty template with headers
        filename = 'products_template.csv';
      } else {
        csv = generateStockUpdateTemplate();
        filename = 'stock_update_template.csv';
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Template downloaded successfully!');
    } catch (error) {
      toast.error('Template download failed: ' + (error instanceof Error ? error.message : 'Failed to download template'));
    } finally {
      setIsLoading(false);
    }
  };

  const parseStockUpdateCSV = (csvContent: string) => {
    const rows = csvContent.split('\n').slice(1); // Skip header row
    return rows
      .filter(row => row.trim())
      .map(row => {
        const [identifier, quantity_change] = row.split(',');
        return {
          identifier: identifier.trim(),
          quantity_change: parseInt(quantity_change.trim(), 10)
        };
      });
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>, type: 'products' | 'stock') => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      setImportProgress({
        total: 0,
        processed: 0,
        success: 0,
        failed: 0,
        errors: []
      });

      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const csvContent = e.target?.result as string;
        const rows = csvContent.split('\n').filter(row => row.trim());
        setImportProgress(prev => ({ ...prev!, total: rows.length - 1 })); // Subtract header row

        // Validate CSV content
        const validation = type === 'products' 
          ? validateProductCSV(csvContent)
          : validateStockUpdateCSV(csvContent);

        if (!validation.isValid) {
          setImportProgress(prev => ({
            ...prev!,
            failed: validation.errors.length,
            errors: validation.errors
          }));
          throw new Error('CSV validation failed. Please check the errors below.');
        }

        if (type === 'products') {
          // Handle product import
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

          setImportProgress(prev => ({
            ...prev!,
            processed: rows.length - 1,
            success: rows.length - 1
          }));

          toast.success('Import Successful: ' + message);

          // --- eTIMS submission for new products with quantity > 0 ---
          try {
            // Dynamically import to avoid SSR issues
            const parsedProducts = importProductsFromCSV(csvContent);
            for (const product of parsedProducts) {
              if (
                typeof product.quantity === 'number' &&
                product.quantity > 0 &&
                product.cost_price !== undefined &&
                product.name &&
                product.id
              ) {
                const vatAmount = product.cost_price * product.quantity * 0.16;
                await submitStockUpdateEtimsInvoice(
                  storeId!,
                  {
                    id: product.id,
                    name: product.name,
                    cost_price: product.cost_price,
                    quantity: product.quantity,
                    vat_status: product.vat_status || false
                  },
                  product.quantity,
                  vatAmount
                );
              }
            }
          } catch (etimsError) {
            console.error('eTIMS submission for new products failed:', etimsError);
            // Do not block import, just log
          }
        } else {
          // Handle stock update import
          const updates = parseStockUpdateCSV(csvContent);
          
          // Convert identifiers to product IDs and get product details
          const productUpdates = await Promise.all(
            updates.map(async ({ identifier, quantity_change }) => {
              // Try to find product by SKU first
              const product = products?.find(p => p.sku === identifier);
              if (product) {
                return { 
                  product_id: product.id, 
                  quantity_change,
                  product: product
                };
              }
              
              // If not found by SKU, assume it's a product ID
              const productById = products?.find(p => p.id === identifier);
              if (productById) {
                return { 
                  product_id: identifier, 
                  quantity_change,
                  product: productById
                };
              }
              
              throw new Error(`Product not found: ${identifier}`);
            })
          );

          // Process stock updates and eTIMS invoicing
          let successCount = 0;
          let failedCount = 0;
          const errors: string[] = [];

          for (const update of productUpdates) {
            try {
              // Update stock
              const { error } = await syncService.updateStockBatch([{
                product_id: update.product_id,
                quantity_change: update.quantity_change
              }]);

              if (error) {
                throw error;
              }

              // If quantity change is positive (adding stock), create eTIMS invoice
              if (update.quantity_change > 0 && update.product) {
                try {
                  // Calculate VAT amount (16% of cost)
                  const vatAmount = (update.product.cost_price * update.quantity_change) * 0.16;
                  
                  const { error: etimsError } = await submitStockUpdateEtimsInvoice(
                    storeId!,
                    {
                      id: update.product.id,
                      name: update.product.name,
                      cost_price: update.product.cost_price,
                      quantity: update.quantity_change,
                      vat_status: update.product.vat_status || false
                    },
                    update.quantity_change,
                    vatAmount
                  );

                  if (etimsError) {
                    console.error('eTIMS invoice creation failed:', etimsError);
                    // Don't fail the entire operation, just log the error
                  } else {
                    console.log('eTIMS invoice created successfully for stock update');
                  }
                } catch (etimsError) {
                  console.error('Error creating eTIMS invoice:', etimsError);
                  // Don't fail the entire operation, just log the error
                }
              }

              successCount++;
            } catch (error) {
              failedCount++;
              errors.push(`Failed to update ${update.product?.name || update.product_id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }

          setImportProgress(prev => ({
            ...prev!,
            processed: productUpdates.length,
            success: successCount,
            failed: failedCount,
            errors
          }));

          if (failedCount === 0) {
            toast.success(`Successfully updated ${successCount} products`);
          } else {
            toast.error(`Updated ${successCount} products, failed to update ${failedCount} products`);
          }
        }
      };

      reader.readAsText(file);
    } catch (error) {
      toast.error('Import Failed: ' + (error instanceof Error ? error.message : 'Failed to import data'));
    } finally {
      setIsLoading(false);
      // Keep the progress visible for a few seconds after completion
      setTimeout(() => setImportProgress(null), 5000);
    }
  };

  if (!storeId) return <div>No store assigned. Please contact your administrator.</div>;
  if (productsLoading) return <div>Loading products...</div>;

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Bulk Operations</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="stock">Stock Updates</TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Product Management</CardTitle>
                <CardDescription>Import or export product data in bulk</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative">
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={(e) => handleImport(e, 'products')}
                      disabled={isLoading}
                      className="hidden"
                      id="products-import"
                    />
                    <Button
                      onClick={() => document.getElementById('products-import')?.click()}
                      disabled={isLoading}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Import Products
                    </Button>
                  </div>
                  <Button
                    onClick={() => handleDownloadTemplate('products')}
                    disabled={isLoading}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Download Template
                  </Button>
                  <Button
                    onClick={handleExport}
                    disabled={isLoading}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export Products
                  </Button>
                </div>

                {importProgress && (
                  <div className="space-y-2 mb-4">
                    <Progress value={(importProgress.processed / importProgress.total) * 100} />
                    <p className="text-sm text-gray-500">
                      Processing {importProgress.processed} of {importProgress.total} items
                      ({importProgress.success} successful, {importProgress.failed} failed)
                    </p>
                    {importProgress.errors.length > 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Errors</AlertTitle>
                        <AlertDescription>
                          <ul className="list-disc list-inside">
                            {importProgress.errors.map((error, index) => (
                              <li key={index}>{error}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search products by name or SKU..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <ScrollArea className="h-[600px] mt-4">
                  <div className="grid grid-cols-1 gap-4">
                    {filteredProducts?.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <h3 className="font-medium">{product.name}</h3>
                          <p className="text-sm text-gray-500">
                            SKU: {product.sku || 'N/A'} | Stock: {product.quantity} {product.unit_of_measure}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            ${product.retail_price?.toFixed(2) || '0.00'}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1"
                          >
                            <Package className="h-4 w-4" />
                            Update Stock
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stock">
            <Card>
              <CardHeader>
                <CardTitle>Bulk Stock Updates</CardTitle>
                <CardDescription>Update multiple product quantities at once. Positive quantities will trigger eTIMS invoicing.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative">
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={(e) => handleImport(e, 'stock')}
                      disabled={isLoading}
                      className="hidden"
                      id="stock-import"
                    />
                    <Button
                      onClick={() => document.getElementById('stock-import')?.click()}
                      disabled={isLoading}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Import Stock Updates
                    </Button>
                  </div>
                  <Button
                    onClick={() => handleDownloadTemplate('stock')}
                    disabled={isLoading}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Download Template
                  </Button>
                </div>

                {importProgress && (
                  <div className="space-y-2 mb-4">
                    <Progress value={(importProgress.processed / importProgress.total) * 100} />
                    <p className="text-sm text-gray-500">
                      Processing {importProgress.processed} of {importProgress.total} items
                      ({importProgress.success} successful, {importProgress.failed} failed)
                    </p>
                    {importProgress.errors.length > 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Errors</AlertTitle>
                        <AlertDescription>
                          <ul className="list-disc list-inside">
                            {importProgress.errors.map((error, index) => (
                              <li key={index}>{error}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 