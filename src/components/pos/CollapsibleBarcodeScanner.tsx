import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { BarcodeInput } from '@/components/ui/BarcodeInput';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Scan, 
  Package, 
  AlertCircle, 
  X,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  barcode?: string;
  price: number;
  stock_quantity: number;
  image_url?: string;
}

interface CollapsibleBarcodeScannerProps {
  onAddToCart: (product: Product, quantity: number) => void;
  className?: string;
}

export function CollapsibleBarcodeScanner({
  onAddToCart,
  className
}: CollapsibleBarcodeScannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock function - replace with actual API call
  const lookupProductByBarcode = async (barcode: string): Promise<Product | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock product data - replace with actual API call
      const mockProduct: Product = {
        id: `prod_${barcode}`,
        name: `Product ${barcode}`,
        barcode: barcode,
        price: Math.floor(Math.random() * 100) + 1,
        stock_quantity: Math.floor(Math.random() * 50) + 1,
        image_url: `https://via.placeholder.com/100x100?text=${barcode}`
      };
      
      return mockProduct;
    } catch {
      setError('Failed to lookup product');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleBarcodeScan = async (barcode: string) => {
    const product = await lookupProductByBarcode(barcode);
    if (product) {
      setScannedProduct(product);
      setQuantity(1);
      // Auto-expand when product is found
      if (!isExpanded) {
        setIsExpanded(true);
      }
    }
  };

  const handleAddToCart = () => {
    if (scannedProduct) {
      onAddToCart(scannedProduct, quantity);
      // Reset for next scan
      setScannedProduct(null);
      setQuantity(1);
    }
  };

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity >= 1 && newQuantity <= (scannedProduct?.stock_quantity || 1)) {
      setQuantity(newQuantity);
    }
  };

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    if (isExpanded) {
      // Reset state when collapsing
      setScannedProduct(null);
      setQuantity(1);
      setError(null);
    }
  };

  return (
    <div className={cn("w-[300px] flex flex-col", className)}>
      {/* Collapsible Button */}
      <Button
        onClick={handleToggle}
        className={cn(
          "w-full h-12 bg-[#1A1F36] hover:bg-[#2D3748] text-white font-medium",
          "flex items-center justify-between px-4",
          isExpanded && "rounded-b-none"
        )}
      >
        <div className="flex items-center space-x-2">
          <Scan className="w-5 h-5" />
          <span>Barcode Scanner</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </Button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="bg-white border border-gray-200 border-t-0 rounded-b-lg shadow-lg">
          <div className="p-4 space-y-4">
            {/* Barcode Input */}
            <BarcodeInput
              onScan={handleBarcodeScan}
              placeholder="Scan product barcode..."
              autoFocus={true}
              showStatus={true}
              size="lg"
            />

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-sm text-gray-600">Looking up product...</span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-3">
                  <div className="flex items-center space-x-2 text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{error}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Product Information */}
            {scannedProduct && !isLoading && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-green-800">
                    Product Found
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Product Image */}
                  {scannedProduct.image_url && (
                    <div className="flex justify-center">
                      <img
                        src={scannedProduct.image_url}
                        alt={scannedProduct.name}
                        className="w-16 h-16 object-cover rounded-md border border-gray-200"
                      />
                    </div>
                  )}

                  {/* Product Details */}
                  <div className="space-y-1">
                    <h3 className="font-medium text-gray-900 text-sm">
                      {scannedProduct.name}
                    </h3>
                    
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Price:</span>
                      <span className="font-semibold text-green-600">
                        ${scannedProduct.price.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Stock:</span>
                      <span className={cn(
                        "font-semibold",
                        scannedProduct.stock_quantity > 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {scannedProduct.stock_quantity} units
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Barcode:</span>
                      <span className="font-mono text-xs text-gray-500">
                        {scannedProduct.barcode}
                      </span>
                    </div>
                  </div>

                  {/* Quantity Selector */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">
                      Quantity
                    </label>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuantityChange(quantity - 1)}
                        disabled={quantity <= 1}
                        className="w-6 h-6 p-0"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      
                      <span className="w-8 text-center text-xs font-medium">
                        {quantity}
                      </span>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuantityChange(quantity + 1)}
                        disabled={quantity >= scannedProduct.stock_quantity}
                        className="w-6 h-6 p-0"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Add to Cart Button */}
                  <Button
                    onClick={handleAddToCart}
                    disabled={scannedProduct.stock_quantity === 0}
                    className="w-full bg-green-600 hover:bg-green-700 text-white text-sm"
                  >
                    <Package className="w-3 h-3 mr-1" />
                    Add to Cart
                    <span className="ml-1 text-xs">
                      (${(scannedProduct.price * quantity).toFixed(2)})
                    </span>
                  </Button>

                  {/* Out of Stock Warning */}
                  {scannedProduct.stock_quantity === 0 && (
                    <div className="flex items-center space-x-2 text-red-600 text-xs">
                      <AlertCircle className="w-3 h-3" />
                      <span>Out of stock</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Instructions */}
            {!scannedProduct && !isLoading && !error && (
              <Card className="border-gray-200">
                <CardContent className="p-3">
                  <div className="text-center space-y-2">
                    <Scan className="w-6 h-6 text-gray-400 mx-auto" />
                    <p className="text-xs text-gray-600">
                      Scan a product barcode to add it to your cart
                    </p>
                    <p className="text-xs text-gray-500">
                      Make sure your barcode scanner is connected
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 