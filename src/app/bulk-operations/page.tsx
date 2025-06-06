import { BulkOperations } from '@/components/products/BulkOperations';

// TODO: Replace with actual store ID logic
const currentStoreId = 'REPLACE_WITH_STORE_ID';

export default function BulkOperationsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Bulk Operations</h1>
      <BulkOperations storeId={currentStoreId} />
    </div>
  );
} 