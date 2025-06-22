import { createClient } from '@/lib/supabase-clients/client';
import { 
  getProductByBarcode as getOfflineProductByBarcode,
  validateBarcodeUniqueness as validateOfflineBarcodeUniqueness,
  updateProductBarcode as updateOfflineProductBarcode,
  getProductsByBarcodePattern as getOfflineProductsByBarcodePattern
} from '@/lib/db';
import type { Database } from '@/types/supabase';

export type Product = Database['public']['Tables']['products']['Row'];

export interface BarcodeServiceOptions {
  mode: 'online' | 'offline';
  storeId: string;
}

export class BarcodeService {
  private mode: 'online' | 'offline';
  private storeId: string;
  private supabase = createClient();

  constructor(options: BarcodeServiceOptions) {
    this.mode = options.mode;
    this.storeId = options.storeId;
  }

  /**
   * Look up a product by its barcode
   */
  async getProductByBarcode(barcode: string): Promise<Product | null> {
    console.log('🔍 BarcodeService: Looking up product by barcode:', { 
      barcode, 
      mode: this.mode, 
      storeId: this.storeId 
    });

    try {
      if (this.mode === 'online') {
        return await this.getOnlineProductByBarcode(barcode);
      } else {
        return await this.getOfflineProductByBarcode(barcode);
      }
    } catch (error) {
      console.error('❌ BarcodeService: Error looking up product:', error);
      return null;
    }
  }

  /**
   * Validate if a barcode is unique within the store
   */
  async validateBarcodeUniqueness(barcode: string, excludeProductId?: string): Promise<boolean> {
    console.log('🔍 BarcodeService: Validating barcode uniqueness:', { 
      barcode, 
      mode: this.mode, 
      excludeProductId 
    });

    try {
      if (this.mode === 'online') {
        return await this.validateOnlineBarcodeUniqueness(barcode, excludeProductId);
      } else {
        return await validateOfflineBarcodeUniqueness(barcode, this.storeId, excludeProductId);
      }
    } catch (error) {
      console.error('❌ BarcodeService: Error validating barcode uniqueness:', error);
      return false;
    }
  }

  /**
   * Update a product's barcode
   */
  async updateProductBarcode(productId: string, barcode: string | null): Promise<Product | null> {
    console.log('🔄 BarcodeService: Updating product barcode:', { 
      productId, 
      barcode, 
      mode: this.mode 
    });

    try {
      if (this.mode === 'online') {
        return await this.updateOnlineProductBarcode(productId, barcode);
      } else {
        return await updateOfflineProductBarcode(productId, barcode);
      }
    } catch (error) {
      console.error('❌ BarcodeService: Error updating product barcode:', error);
      return null;
    }
  }

  /**
   * Search products by barcode pattern
   */
  async searchProductsByBarcodePattern(pattern: string): Promise<Product[]> {
    console.log('🔍 BarcodeService: Searching products by barcode pattern:', { 
      pattern, 
      mode: this.mode 
    });

    try {
      if (this.mode === 'online') {
        return await this.searchOnlineProductsByBarcodePattern(pattern);
      } else {
        return await getOfflineProductsByBarcodePattern(pattern, this.storeId);
      }
    } catch (error) {
      console.error('❌ BarcodeService: Error searching products by barcode pattern:', error);
      return [];
    }
  }

  /**
   * Generate a unique barcode suggestion
   */
  async generateUniqueBarcode(baseBarcode?: string): Promise<string> {
    console.log('🔄 BarcodeService: Generating unique barcode:', { baseBarcode, mode: this.mode });

    try {
      let candidateBarcode = baseBarcode || this.generateRandomBarcode();
      let attempts = 0;
      const maxAttempts = 100;

      while (attempts < maxAttempts) {
        const isUnique = await this.validateBarcodeUniqueness(candidateBarcode);
        if (isUnique) {
          console.log('✅ BarcodeService: Generated unique barcode:', candidateBarcode);
          return candidateBarcode;
        }
        
        candidateBarcode = this.generateRandomBarcode();
        attempts++;
      }

      throw new Error('Unable to generate unique barcode after maximum attempts');
    } catch (error) {
      console.error('❌ BarcodeService: Error generating unique barcode:', error);
      throw error;
    }
  }

  // Private methods for online operations

  private async getOnlineProductByBarcode(barcode: string): Promise<Product | null> {
    const { data, error } = await this.supabase
      .from('products')
      .select('*')
      .eq('barcode', barcode)
      .eq('store_id', this.storeId)
      .single();

    if (error) {
      console.error('❌ BarcodeService: Online lookup error:', error);
      return null;
    }

    return data;
  }

  private async validateOnlineBarcodeUniqueness(barcode: string, excludeProductId?: string): Promise<boolean> {
    let query = this.supabase
      .from('products')
      .select('id')
      .eq('barcode', barcode)
      .eq('store_id', this.storeId);

    if (excludeProductId) {
      query = query.neq('id', excludeProductId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ BarcodeService: Online uniqueness check error:', error);
      return false;
    }

    return !data || data.length === 0;
  }

  private async updateOnlineProductBarcode(productId: string, barcode: string | null): Promise<Product | null> {
    const { data, error } = await this.supabase
      .from('products')
      .update({ barcode })
      .eq('id', productId)
      .eq('store_id', this.storeId)
      .select()
      .single();

    if (error) {
      console.error('❌ BarcodeService: Online update error:', error);
      return null;
    }

    return data;
  }

  private async searchOnlineProductsByBarcodePattern(pattern: string): Promise<Product[]> {
    const { data, error } = await this.supabase
      .from('products')
      .select('*')
      .eq('store_id', this.storeId)
      .ilike('barcode', `%${pattern}%`);

    if (error) {
      console.error('❌ BarcodeService: Online search error:', error);
      return [];
    }

    return data || [];
  }

  // Utility methods

  private generateRandomBarcode(): string {
    // Generate a random 13-digit EAN-13 barcode
    const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
    
    // Calculate check digit (simplified EAN-13 algorithm)
    const sum = digits.reduce((acc, digit, index) => {
      return acc + digit * (index % 2 === 0 ? 1 : 3);
    }, 0);
    
    const checkDigit = (10 - (sum % 10)) % 10;
    digits.push(checkDigit);
    
    return digits.join('');
  }

  /**
   * Validate barcode format
   */
  static validateBarcodeFormat(barcode: string): boolean {
    if (!barcode || barcode.trim().length === 0) {
      return false;
    }

    const cleanBarcode = barcode.trim();

    // EAN-13: 13 digits
    if (/^\d{13}$/.test(cleanBarcode)) {
      return true;
    }

    // UPC-A: 12 digits
    if (/^\d{12}$/.test(cleanBarcode)) {
      return true;
    }

    // Code 128: 1-48 alphanumeric characters
    if (/^[A-Za-z0-9\-\.\/\+\s]{1,48}$/.test(cleanBarcode)) {
      return true;
    }

    // Code 39: 1-43 alphanumeric characters
    if (/^[A-Z0-9\-\.\/\+\s]{1,43}$/.test(cleanBarcode)) {
      return true;
    }

    // QR Code: variable length (more permissive)
    if (cleanBarcode.length <= 100) {
      return true;
    }

    return false;
  }

  /**
   * Get barcode format type
   */
  static getBarcodeFormat(barcode: string): string {
    if (!barcode) return 'UNKNOWN';

    const cleanBarcode = barcode.trim();

    if (/^\d{13}$/.test(cleanBarcode)) {
      return 'EAN-13';
    }

    if (/^\d{12}$/.test(cleanBarcode)) {
      return 'UPC-A';
    }

    if (/^[A-Za-z0-9\-\.\/\+\s]{1,48}$/.test(cleanBarcode)) {
      return 'CODE-128';
    }

    if (/^[A-Z0-9\-\.\/\+\s]{1,43}$/.test(cleanBarcode)) {
      return 'CODE-39';
    }

    if (cleanBarcode.length <= 100) {
      return 'QR-CODE';
    }

    return 'UNKNOWN';
  }
} 