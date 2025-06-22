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
  Minus
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  barcode?: string;
  price: number;
  stock_quantity: number;
  image_url?: string;
}

interface BarcodeScannerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
  className?: string;
}

export function BarcodeScannerPanel({
  isOpen,
  onClose,
  onAddToCart,
  className
}: BarcodeScannerPanelProps) {
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

  const handleClose = () => {
    setScannedProduct(null);
    setQuantity(1);
    setError(null);
    onClose();
  };

  return (
    <div
      className={cn(
        "fixed top-0 right-0 h-full w-80 bg-white border-l border-gray-200 shadow-xl",
        "transform transition-transform duration-300 ease-in-out z-50",
        isOpen ? "translate-x-0" : "translate-x-full",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Scan className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Barcode Scanner</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
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
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Looking up product...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 text-red-600">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Product Information */}
        {scannedProduct && !isLoading && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-green-800">
                Product Found
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Product Image */}
              {scannedProduct.image_url && (
                <div className="flex justify-center">
                  <img
                    src={scannedProduct.image_url}
                    alt={scannedProduct.name}
                    className="w-20 h-20 object-cover rounded-md border border-gray-200"
                  />
                </div>
              )}

              {/* Product Details */}
              <div className="space-y-2">
                <h3 className="font-medium text-gray-900 text-sm">
                  {scannedProduct.name}
                </h3>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Price:</span>
                  <span className="font-semibold text-green-600">
                    ${scannedProduct.price.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Stock:</span>
                  <span className={cn(
                    "font-semibold",
                    scannedProduct.stock_quantity > 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {scannedProduct.stock_quantity} units
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Barcode:</span>
                  <span className="font-mono text-xs text-gray-500">
                    {scannedProduct.barcode}
                  </span>
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Quantity
                </label>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuantityChange(quantity - 1)}
                    disabled={quantity <= 1}
                    className="w-8 h-8 p-0"
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  
                  <span className="w-12 text-center font-medium">
                    {quantity}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuantityChange(quantity + 1)}
                    disabled={quantity >= scannedProduct.stock_quantity}
                    className="w-8 h-8 p-0"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Add to Cart Button */}
              <Button
                onClick={handleAddToCart}
                disabled={scannedProduct.stock_quantity === 0}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                <Package className="w-4 h-4 mr-2" />
                Add to Cart
                <span className="ml-2 text-xs">
                  (${(scannedProduct.price * quantity).toFixed(2)})
                </span>
              </Button>

              {/* Out of Stock Warning */}
              {scannedProduct.stock_quantity === 0 && (
                <div className="flex items-center space-x-2 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>Out of stock</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        {!scannedProduct && !isLoading && !error && (
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="text-center space-y-2">
                <Scan className="w-8 h-8 text-gray-400 mx-auto" />
                <p className="text-sm text-gray-600">
                  Scan a product barcode to add it to your cart
                </p>
                <p className="text-xs text-gray-500">
                  Make sure your barcode scanner is connected and ready
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
} 