import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Scan, 
  Package, 
  Search, 
  Save, 
  RotateCcw,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { BarcodeInput } from '@/components/ui/BarcodeInput';
import { toast } from 'sonner';

interface ProductData {
  name: string;
  barcode: string;
  sku?: string;
  category?: string;
  retail_price?: number;
  wholesale_price?: number;
  cost_price?: number;
  unit_of_measure?: string;
  units_per_pack?: number;
  vat_status?: boolean;
}

interface BarcodeProductCreatorProps {
  storeId: string;
  onProductCreated: (product: ProductData) => void;
  className?: string;
}

export function BarcodeProductCreator({
  storeId,
  onProductCreated,
  className
}: BarcodeProductCreatorProps) {
  const [productData, setProductData] = useState<ProductData>({
    name: '',
    barcode: '',
    sku: '',
    category: '',
    retail_price: 0,
    wholesale_price: 0,
    cost_price: 0,
    unit_of_measure: 'PCS',
    units_per_pack: 1,
    vat_status: true
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  const handleBarcodeScan = async (barcode: string) => {
    setLastScanned(barcode);
    setProductData(prev => ({ ...prev, barcode }));
    
    // Check if product already exists
    try {
      const response = await fetch(`/api/products/barcode/${encodeURIComponent(barcode)}?store_id=${storeId}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        toast.error('Product with this barcode already exists');
        return;
      }
    } catch (error) {
      console.error('Error checking existing product:', error);
    }

    // Search for product information online
    await searchProductInfo(barcode);
  };

  const searchProductInfo = async (barcode: string) => {
    setIsSearching(true);
    setSuggestions([]);
    
    try {
      // Try multiple product databases
      const searches = [
        searchOpenFoodFacts(barcode),
        searchBarcodeDatabase(barcode),
        searchProductAPI(barcode)
      ];
      
      const results = await Promise.allSettled(searches);
      const validResults = results
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => (result as PromiseFulfilledResult<any>).value);
      
      if (validResults.length > 0) {
        setSuggestions(validResults);
        toast.success(`Found ${validResults.length} product suggestions`);
      } else {
        toast.info('No product information found online');
      }
    } catch (error) {
      console.error('Error searching product info:', error);
      toast.error('Error searching product information');
    } finally {
      setIsSearching(false);
    }
  };

  const searchOpenFoodFacts = async (barcode: string) => {
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await response.json();
      
      if (data.status === 1 && data.product) {
        return {
          source: 'Open Food Facts',
          name: data.product.product_name || data.product.product_name_en,
          category: data.product.categories_tags?.[0]?.replace('en:', ''),
          image: data.product.image_front_url,
          nutrition: data.product.nutriments
        };
      }
    } catch (error) {
      console.error('OpenFoodFacts search error:', error);
    }
    return null;
  };

  const searchBarcodeDatabase = async (barcode: string) => {
    try {
      const response = await fetch(`https://api.barcodelookup.com/v3/products?barcode=${barcode}&formatted=y&key=demo`);
      const data = await response.json();
      
      if (data.products && data.products.length > 0) {
        const product = data.products[0];
        return {
          source: 'Barcode Database',
          name: product.title,
          category: product.category,
          image: product.images?.[0],
          description: product.description
        };
      }
    } catch (error) {
      console.error('Barcode Database search error:', error);
    }
    return null;
  };

  const searchProductAPI = async (barcode: string) => {
    try {
      const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const item = data.items[0];
        return {
          source: 'UPC Item DB',
          name: item.title,
          category: item.category,
          image: item.images?.[0],
          brand: item.brand
        };
      }
    } catch (error) {
      console.error('UPC Item DB search error:', error);
    }
    return null;
  };

  const applySuggestion = (suggestion: any) => {
    setProductData(prev => ({
      ...prev,
      name: suggestion.name || prev.name,
      category: suggestion.category || prev.category,
      sku: prev.sku || generateSKU(suggestion.name || prev.name)
    }));
    
    toast.success(`Applied suggestion from ${suggestion.source}`);
  };

  const generateSKU = (name: string) => {
    if (!name) return '';
    return name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 8)
      .padEnd(8, '0');
  };

  const handleInputChange = (field: keyof ProductData, value: any) => {
    setProductData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!productData.name || !productData.barcode) {
      toast.error('Name and barcode are required');
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...productData,
          store_id: storeId,
          quantity: 0 // Start with 0 quantity
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('Product created successfully');
        onProductCreated(productData);
        handleReset();
      } else {
        toast.error(result.message || 'Error creating product');
      }
    } catch (error) {
      console.error('Error creating product:', error);
      toast.error('Error creating product');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setProductData({
      name: '',
      barcode: '',
      sku: '',
      category: '',
      retail_price: 0,
      wholesale_price: 0,
      cost_price: 0,
      unit_of_measure: 'PCS',
      units_per_pack: 1,
      vat_status: true
    });
    setSuggestions([]);
    setLastScanned(null);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-600" />
          Create Product with Barcode
        </CardTitle>
        <p className="text-sm text-gray-600">
          Scan a barcode to auto-fill product information
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Barcode Scanner */}
        <div className="space-y-2">
          <BarcodeInput
            onScan={handleBarcodeScan}
            placeholder="Scan product barcode..."
            label="Product Barcode"
            size="lg"
            showStatus={true}
            autoFocus={true}
            enableSound={true}
          />
          
          {lastScanned && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              Scanned: <span className="font-mono">{lastScanned}</span>
            </div>
          )}
        </div>

        {/* Product Suggestions */}
        {isSearching && (
          <div className="flex items-center gap-2 text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            Searching product information...
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Product Suggestions</h4>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => applySuggestion(suggestion)}
                >
                  <div className="flex items-start gap-3">
                    {suggestion.image && (
                      <img
                        src={suggestion.image}
                        alt={suggestion.name}
                        className="w-12 h-12 object-cover rounded border"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{suggestion.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {suggestion.source}
                        </Badge>
                      </div>
                      {suggestion.category && (
                        <div className="text-sm text-gray-600">
                          Category: {suggestion.category}
                        </div>
                      )}
                      {suggestion.brand && (
                        <div className="text-sm text-gray-600">
                          Brand: {suggestion.brand}
                        </div>
                      )}
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Product Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              value={productData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter product name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sku">SKU</Label>
            <Input
              id="sku"
              value={productData.sku}
              onChange={(e) => handleInputChange('sku', e.target.value)}
              placeholder="Auto-generated or manual"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={productData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              placeholder="Product category"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit">Unit of Measure</Label>
            <Input
              id="unit"
              value={productData.unit_of_measure}
              onChange={(e) => handleInputChange('unit_of_measure', e.target.value)}
              placeholder="PCS, KG, L, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="retail_price">Retail Price (KES)</Label>
            <Input
              id="retail_price"
              type="number"
              step="0.01"
              value={productData.retail_price}
              onChange={(e) => handleInputChange('retail_price', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wholesale_price">Wholesale Price (KES)</Label>
            <Input
              id="wholesale_price"
              type="number"
              step="0.01"
              value={productData.wholesale_price}
              onChange={(e) => handleInputChange('wholesale_price', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost_price">Cost Price (KES)</Label>
            <Input
              id="cost_price"
              type="number"
              step="0.01"
              value={productData.cost_price}
              onChange={(e) => handleInputChange('cost_price', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="units_per_pack">Units per Pack</Label>
            <Input
              id="units_per_pack"
              type="number"
              value={productData.units_per_pack}
              onChange={(e) => handleInputChange('units_per_pack', parseInt(e.target.value) || 1)}
              placeholder="1"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !productData.name || !productData.barcode}
            className="flex-1"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Create Product
          </Button>
          
          <Button onClick={handleReset} variant="outline">
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        {/* Instructions */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Scan barcode to auto-fill product information</p>
          <p>• System searches multiple databases for product details</p>
          <p>• Click suggestions to apply them to the form</p>
          <p>• Fill in pricing and other details manually</p>
        </div>
      </CardContent>
    </Card>
  );
} 