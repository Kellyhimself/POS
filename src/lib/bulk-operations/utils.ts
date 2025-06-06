import { Database } from '@/types/supabase';
import Papa from 'papaparse';

type Product = Database['public']['Tables']['products']['Row'];

export interface BulkProductUpdate {
  id: string;
  name?: string;
  sku?: string;
  quantity?: number;
  unit_of_measure?: string;
  units_per_pack?: number;
  retail_price?: number;
  wholesale_price?: number;
  wholesale_threshold?: number;
  cost_price?: number;
  vat_status?: boolean;
  category?: string;
}

export const exportProductsToCSV = (products: Product[]): string => {
  const csvData = products.map(product => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    quantity: product.quantity,
    unit_of_measure: product.unit_of_measure,
    units_per_pack: product.units_per_pack,
    retail_price: product.retail_price,
    wholesale_price: product.wholesale_price,
    wholesale_threshold: product.wholesale_threshold,
    cost_price: product.cost_price,
    vat_status: product.vat_status,
    category: product.category
  }));

  return Papa.unparse(csvData);
};

export const importProductsFromCSV = (csvContent: string): BulkProductUpdate[] => {
  const { data, errors } = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.toLowerCase().trim()
  });

  if (errors.length > 0) {
    throw new Error(`CSV parsing errors: ${errors.map(e => e.message).join(', ')}`);
  }

  return data.map((row: any) => ({
    id: row.id,
    name: row.name,
    sku: row.sku,
    quantity: row.quantity ? Number(row.quantity) : undefined,
    unit_of_measure: row.unit_of_measure,
    units_per_pack: row.units_per_pack ? Number(row.units_per_pack) : undefined,
    retail_price: row.retail_price ? Number(row.retail_price) : undefined,
    wholesale_price: row.wholesale_price ? Number(row.wholesale_price) : undefined,
    wholesale_threshold: row.wholesale_threshold ? Number(row.wholesale_threshold) : undefined,
    cost_price: row.cost_price ? Number(row.cost_price) : undefined,
    vat_status: row.vat_status ? row.vat_status.toLowerCase() === 'true' : undefined,
    category: row.category
  }));
};

export const validateBulkUpdate = (updates: BulkProductUpdate[]): string[] => {
  const errors: string[] = [];

  updates.forEach((update, index) => {
    if (!update.id) {
      errors.push(`Row ${index + 1}: Product ID is required`);
    }
    if (update.quantity !== undefined && update.quantity < 0) {
      errors.push(`Row ${index + 1}: Quantity cannot be negative`);
    }
    if (update.retail_price !== undefined && update.retail_price < 0) {
      errors.push(`Row ${index + 1}: Retail price cannot be negative`);
    }
    if (update.wholesale_price !== undefined && update.wholesale_price < 0) {
      errors.push(`Row ${index + 1}: Wholesale price cannot be negative`);
    }
    if (update.cost_price !== undefined && update.cost_price < 0) {
      errors.push(`Row ${index + 1}: Cost price cannot be negative`);
    }
    if (update.wholesale_threshold !== undefined && update.wholesale_threshold < 1) {
      errors.push(`Row ${index + 1}: Wholesale threshold must be at least 1`);
    }
  });

  return errors;
};

export const generateBulkUpdateSQL = (updates: BulkProductUpdate[]): string => {
  const updateStatements = updates.map(update => {
    const setClauses = Object.entries(update)
      .filter(([key, value]) => key !== 'id' && value !== undefined)
      .map(([key, value]) => {
        if (typeof value === 'boolean') {
          return `${key} = ${value}`;
        }
        if (typeof value === 'string') {
          return `${key} = '${value.replace(/'/g, "''")}'`;
        }
        return `${key} = ${value}`;
      })
      .join(', ');

    return `UPDATE products SET ${setClauses} WHERE id = '${update.id}';`;
  });

  return updateStatements.join('\n');
}; 