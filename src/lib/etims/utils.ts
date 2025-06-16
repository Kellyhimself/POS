import { Database } from '@/types/supabase';
import { db } from '@/lib/db';

type EtimsSubmission = Database['public']['Tables']['etims_submissions']['Row'];

export interface EtimsInvoice {
  invoice_number: string;
  date: string;
  customer_name: string;
  customer_tax_pin: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    vat_amount: number;
  }>;
  total_amount: number;
  vat_total: number;
  store_id: string;
}

interface SaleProduct {
  id: string;
  name: string;
  quantity: number;
  price: number;
  displayPrice?: number;
  vat_amount: number;
}

interface SaleTransaction {
  id: string;
  store_id: string;
  total_amount: number;
  vat_total: number;
  timestamp: string;
}

export const generateInvoiceNumber = (storeId: string, timestamp: string): string => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INV-${storeId.slice(0, 4)}-${year}${month}${day}-${random}`;
};

export const formatEtimsInvoice = (
  transaction: SaleTransaction,
  products: SaleProduct[],
  storeId: string
): EtimsInvoice => {
  const invoiceNumber = generateInvoiceNumber(storeId, transaction.timestamp || new Date().toISOString());
  
  return {
    invoice_number: invoiceNumber,
    date: transaction.timestamp || new Date().toISOString(),
    customer_name: 'Walk-in Customer',
    customer_tax_pin: '000000000',
    items: products.map(product => ({
      description: product.name,
      quantity: product.quantity,
      unit_price: product.displayPrice || product.price,
      vat_amount: product.vat_amount
    })),
    total_amount: transaction.total_amount,
    vat_total: transaction.vat_total,
    store_id: storeId
  };
};

export const calculateVATAmount = (amount: number, vatStatus: boolean): number => {
  if (!vatStatus) return 0;
  return amount * 0.16; // 16% VAT rate
};

export const validateEtimsInvoice = (invoice: EtimsInvoice): string[] => {
  const errors: string[] = [];

  if (!invoice.invoice_number) errors.push('Invoice number is required');
  if (!invoice.date) errors.push('Date is required');
  if (!invoice.customer_name) errors.push('Customer name is required');
  if (!invoice.customer_tax_pin) errors.push('Customer tax PIN is required');
  if (!invoice.items.length) errors.push('At least one item is required');
  if (invoice.total_amount <= 0) errors.push('Total amount must be greater than 0');
  if (invoice.vat_total < 0) errors.push('VAT total cannot be negative');
  if (!invoice.store_id) errors.push('Store ID is required');

  return errors;
};

// Add new interfaces and functions for offline-first eTIMS
export interface OfflineEtimsSubmission {
  id?: string;
  invoice_number: string;
  date: string;
  customer_name: string;
  customer_tax_pin: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    vat_amount: number;
  }>;
  total_amount: number;
  vat_total: number;
  store_id: string;
  status: 'pending' | 'success' | 'failed';
  error_message?: string;
  submitted_at: string;
  synced: boolean;
}

export const saveOfflineEtimsSubmission = async (submission: Omit<EtimsSubmission, 'id' | 'created_at' | 'updated_at' | 'response_data' | 'error_message'>): Promise<EtimsSubmission> => {
  const submissionWithDefaults = {
    ...submission,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    response_data: null,
    error_message: null
  };

  const id = await db.etims_submissions.add(submissionWithDefaults);
  return { ...submissionWithDefaults, id: id.toString() };
};

export const getPendingEtimsSubmissions = async (): Promise<EtimsSubmission[]> => {
  console.log('🔍 Fetching pending eTIMS submissions from IndexedDB');
  
  try {
    const submissions = await db.etims_submissions
      .where('status')
      .equals('pending')
      .toArray();

    console.log('📊 Retrieved pending eTIMS submissions:', {
      count: submissions.length,
      submissions: submissions.map(s => ({
        id: s.id,
        invoice_number: s.invoice_number,
        store_id: s.store_id,
        status: s.status,
        submitted_at: s.submitted_at
      }))
    });

    return submissions;
  } catch (error) {
    console.error('❌ Error fetching pending eTIMS submissions:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
};

export const markEtimsSubmissionAsSynced = async (id: string): Promise<void> => {
  await db.etims_submissions.update(id, { 
    status: 'success',
    updated_at: new Date().toISOString()
  });
};

// Single function to handle eTIMS submissions
export const submitEtimsInvoice = async (invoiceData: EtimsInvoice): Promise<{ data: EtimsSubmission | null; error: Error | null }> => {
  console.log('📝 Starting eTIMS invoice local save:', {
    invoice_number: invoiceData.invoice_number,
    store_id: invoiceData.store_id,
    total_amount: invoiceData.total_amount,
    items_count: invoiceData.items.length
  });

  try {
    const timestamp = new Date().toISOString();
    const submission: EtimsSubmission = {
      id: crypto.randomUUID(),
      invoice_number: invoiceData.invoice_number,
      store_id: invoiceData.store_id,
      response_data: invoiceData,
      status: 'pending',
      submitted_at: timestamp,
      created_at: timestamp,
      updated_at: timestamp,
      error_message: null
    };

    // Save to IndexedDB
    const offlineSubmission = await db.etims_submissions.add(submission);

    console.log('✅ eTIMS invoice saved to IndexedDB:', {
      id: offlineSubmission,
      invoice_number: invoiceData.invoice_number,
      status: 'pending',
      submitted_at: timestamp
    });

    return { 
      data: { ...submission, id: offlineSubmission.toString() },
      error: null 
    };
  } catch (error) {
    console.error('❌ Error saving eTIMS invoice to IndexedDB:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      invoice_number: invoiceData.invoice_number
    });
    return { data: null, error: error instanceof Error ? error : new Error('Unknown error') };
  }
};

// Add new interfaces for file-based sync
export interface SyncFileData {
  session_id: string;
  store_id: string;
  timestamp: string;
  submissions: Array<{
    id: string;
    invoice_number: string;
    submitted_at: string;
    response_data: EtimsInvoice;
  }>;
  data_hash: string;
}

export interface SyncResults {
  session_id: string;
  store_id: string;
  timestamp: string;
  processed_submissions: Array<{
    id: string;
    invoice_number: string;
    status: 'success' | 'error';
    response_data?: {
      success: boolean;
      message: string;
      data?: Record<string, unknown>;
    };
    error_message?: string;
  }>;
  data_hash: string;
}

// Add new functions for file-based sync
export const generateSyncFile = async (submissions: EtimsSubmission[]): Promise<SyncFileData> => {
  const sessionId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  // Generate data hash for verification
  const dataHash = await generateDataHash(submissions);
  
  return {
    session_id: sessionId,
    store_id: submissions[0]?.store_id || '',
    timestamp,
    submissions: submissions.map(sub => ({
      id: sub.id,
      invoice_number: sub.invoice_number,
      submitted_at: sub.submitted_at,
      response_data: sub.response_data as EtimsInvoice
    })),
    data_hash: dataHash
  };
};

export const validateSyncResults = async (results: SyncResults, originalSubmissions: EtimsSubmission[]): Promise<boolean> => {
  try {
    // Validate basic structure
    if (!results || typeof results !== 'object') {
      console.error('Invalid results format: not an object');
      return false;
    }

    // Verify required fields
    if (!results.session_id) {
      console.error('Invalid results: missing session_id');
      return false;
    }

    if (!results.store_id) {
      console.error('Invalid results: missing store_id');
      return false;
    }

    if (!Array.isArray(results.processed_submissions)) {
      console.error('Invalid results: processed_submissions is not an array');
      return false;
    }

    // Verify store ID matches
    if (results.store_id !== originalSubmissions[0]?.store_id) {
      console.error('Store ID mismatch:', {
        results_store_id: results.store_id,
        original_store_id: originalSubmissions[0]?.store_id
      });
      return false;
    }

    // Verify data hash
    const originalHash = await generateDataHash(originalSubmissions);
    if (results.data_hash !== originalHash) {
      console.error('Data hash mismatch:', {
        results_hash: results.data_hash,
        original_hash: originalHash
      });
      return false;
    }

    // Verify all submissions were processed
    const processedIds = new Set(results.processed_submissions.map(p => p.id));
    const allProcessed = originalSubmissions.every(sub => processedIds.has(sub.id));

    if (!allProcessed) {
      console.error('Not all submissions were processed');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating sync results:', error);
    return false;
  }
};

export const processSyncResults = async (results: SyncResults): Promise<void> => {
  console.log('🔄 Processing sync results:', {
    session_id: results.session_id,
    store_id: results.store_id,
    submissions_count: results.processed_submissions.length
  });

  try {
    // Process each submission result
    for (const submission of results.processed_submissions) {
      if (submission.status === 'success') {
        // Update submission status to success
        await db.etims_submissions.update(submission.id, {
          status: 'success',
          response_data: submission.response_data,
          updated_at: new Date().toISOString()
        });

        console.log('✅ Updated submission status to success:', {
          id: submission.id,
          invoice_number: submission.invoice_number
        });
      } else {
        // Update submission status to failed
        await db.etims_submissions.update(submission.id, {
          status: 'failed',
          error_message: submission.error_message,
          updated_at: new Date().toISOString()
        });

        console.log('❌ Updated submission status to failed:', {
          id: submission.id,
          invoice_number: submission.invoice_number,
          error: submission.error_message
        });
      }
    }

    console.log('✅ Successfully processed all sync results');
  } catch (error) {
    console.error('❌ Error processing sync results:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
};

/**
 * Generates a hash of the submissions data for verification
 */
export const generateDataHash = async (submissions: EtimsSubmission[]): Promise<string> => {
  try {
    // Sort submissions by ID to ensure consistent hashing
    const sortedSubmissions = [...submissions].sort((a, b) => a.id.localeCompare(b.id));
    
    // Create a string representation of the data
    const dataString = sortedSubmissions.map(sub => 
      `${sub.id}:${sub.invoice_number}:${sub.submitted_at}:${JSON.stringify(sub.response_data)}`
    ).join('|');

    // Generate SHA-256 hash
    const encoder = new TextEncoder();
    const data = encoder.encode(dataString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  } catch (error) {
    console.error('Error generating data hash:', error);
    throw new Error('Failed to generate data hash');
  }
}; 