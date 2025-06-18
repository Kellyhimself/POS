'use client';

import { ModeSettings } from '@/components/settings/ModeSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-gray-600">
          Configure your application preferences and operation mode
        </p>
      </div>

      <Tabs defaultValue="mode" className="space-y-6">
        <TabsList>
          <TabsTrigger value="mode">Operation Mode</TabsTrigger>
          <TabsTrigger value="sync">Sync Settings</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="mode">
          <Card>
            <CardHeader>
              <CardTitle>Operation Mode</CardTitle>
              <CardDescription>
                Choose how the system handles online and offline operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ModeSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync">
          <Card>
            <CardHeader>
              <CardTitle>Sync Settings</CardTitle>
              <CardDescription>
                Configure data synchronization preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Offline Data Management</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Manage data stored locally on your device
                  </p>
                  
                  <div className="space-y-2">
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                      View Offline Data Size
                    </button>
                    <button className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">
                      Clear Offline Data
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Sync Status</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm">All data synced</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>
                Advanced configuration options for power users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Debug Information</h4>
                  <div className="bg-gray-50 p-4 rounded-lg text-sm">
                    <div className="space-y-1">
                      <div>Current Mode: <span className="font-mono">online</span></div>
                      <div>Network Status: <span className="font-mono">connected</span></div>
                      <div>Last Sync: <span className="font-mono">2 minutes ago</span></div>
                      <div>Pending Items: <span className="font-mono">0</span></div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Performance</h4>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Enable real-time subscriptions</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Enable optimistic updates</span>
                    </label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 