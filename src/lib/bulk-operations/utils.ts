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
  const headers = [
    'id',
    'name',
    'sku',
    'category',
    'unit_of_measure',
    'quantity',
    'retail_price',
    'wholesale_price',
    'wholesale_threshold',
    'cost_price',
    'vat_status',
    'selling_price',
    'units_per_pack'
  ].join(',');

  const rows = products.map(product => [
    product.id,
    escapeCSV(product.name || ''),
    escapeCSV(product.sku || ''),
    escapeCSV(product.category || ''),
    escapeCSV(product.unit_of_measure || ''),
    product.quantity,
    product.retail_price || '',
    product.wholesale_price || '',
    product.wholesale_threshold || '',
    product.cost_price,
    product.vat_status ? 'true' : 'false',
    product.selling_price,
    product.units_per_pack
  ].join(','));

  return [headers, ...rows].join('\n');
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

export function generateStockUpdateTemplate() {
  const headers = [
    'identifier',
    'quantity_change'
  ].join(',');

  const exampleRows = [
    'SHIRT-BLUE-M,10',
    'PROD-001,-5',
    '123e4567-e89b-12d3-a456-426614174000,20'
  ].join('\n');

  const instructions = [
    '# Stock Update Template',
    '# Instructions:',
    '# 1. identifier: Use either your product SKU or the product ID (UUID)',
    '# 2. quantity_change: The amount to add (positive) or subtract (negative) from current stock',
    '# Examples:',
    '# - A value of 10 will add 10 units',
    '# - A value of -5 will remove 5 units',
    '# - You can use either SKU (e.g., SHIRT-BLUE-M) or product ID (UUID)',
    '',
    headers,
    exampleRows
  ].join('\n');

  return instructions;
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function validateStockUpdateCSV(csvContent: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const rows = csvContent.split('\n').filter(row => row.trim() && !row.startsWith('#'));
  
  if (rows.length < 2) {
    errors.push('CSV must contain at least a header row and one data row');
    return { isValid: false, errors };
  }

  const headers = rows[0].split(',');
  if (headers.length !== 2 || headers[0] !== 'identifier' || headers[1] !== 'quantity_change') {
    errors.push('Invalid headers. Expected: identifier,quantity_change');
    return { isValid: false, errors };
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const [identifier, quantity_change] = row.split(',');

    if (!identifier?.trim()) {
      errors.push(`Row ${i + 1}: Missing identifier (SKU or product ID)`);
    }

    const quantity = parseInt(quantity_change?.trim() || '', 10);
    if (isNaN(quantity)) {
      errors.push(`Row ${i + 1}: Invalid quantity_change value`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateProductCSV(csvContent: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const rows = csvContent.split('\n').filter(row => row.trim());
  
  if (rows.length < 2) {
    errors.push('CSV must contain at least a header row and one data row');
    return { isValid: false, errors };
  }

  const headers = rows[0].split(',');
  const requiredHeaders = [
    'name',
    'unit_of_measure',
    'quantity',
    'cost_price',
    'selling_price',
    'units_per_pack'
  ];

  const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
  if (missingHeaders.length > 0) {
    errors.push(`Missing required headers: ${missingHeaders.join(', ')}`);
    return { isValid: false, errors };
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const values = row.split(',');
    const rowData = Object.fromEntries(headers.map((header, index) => [header, values[index]]));

    if (!rowData.name?.trim()) {
      errors.push(`Row ${i + 1}: Missing product name`);
    }

    if (!rowData.unit_of_measure?.trim()) {
      errors.push(`Row ${i + 1}: Missing unit of measure`);
    }

    const quantity = parseInt(rowData.quantity?.trim() || '', 10);
    if (isNaN(quantity) || quantity < 0) {
      errors.push(`Row ${i + 1}: Invalid quantity value`);
    }

    const costPrice = parseFloat(rowData.cost_price?.trim() || '');
    if (isNaN(costPrice) || costPrice < 0) {
      errors.push(`Row ${i + 1}: Invalid cost price value`);
    }

    const sellingPrice = parseFloat(rowData.selling_price?.trim() || '');
    if (isNaN(sellingPrice) || sellingPrice < 0) {
      errors.push(`Row ${i + 1}: Invalid selling price value`);
    }

    const unitsPerPack = parseInt(rowData.units_per_pack?.trim() || '', 10);
    if (isNaN(unitsPerPack) || unitsPerPack < 1) {
      errors.push(`Row ${i + 1}: Invalid units per pack value (must be at least 1)`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
} 