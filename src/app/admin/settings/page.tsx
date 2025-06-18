import { VatSettings } from '@/components/admin/VatSettings';

export default function AdminSettingsPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">System Settings</h1>
      
      <div className="space-y-8">
        <VatSettings />
        {/* Add other settings components here */}
      </div>
    </div>
  );
} 