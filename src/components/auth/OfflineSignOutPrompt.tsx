"use client";

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface OfflineSignOutPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
}

export function OfflineSignOutPrompt({ isOpen, onClose, onConfirm }: OfflineSignOutPromptProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) {
      onConfirm(password);
      setPassword('');
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="top" 
        className={cn(
          "sm:max-w-md mx-auto bg-[#1A1F36] border-none",
          "flex flex-col items-center justify-center min-h-[200px]",
          "rounded-b-xl mt-2"
        )}
      >
        <SheetHeader className="text-center mb-6">
          <SheetTitle className="text-white text-xl font-bold">
            Confirm Offline Sign Out
          </SheetTitle>
          <SheetDescription className="text-gray-300 mt-2">
            Please enter your password to sign out while offline. This will allow you to sign in again later.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="w-full max-w-[280px] space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-gray-300">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              className="bg-[#2D3748] border-[#4A5568] text-white placeholder:text-gray-400 focus:border-[#0ABAB5] focus:ring-[#0ABAB5]"
            />
          </div>
          <div className="flex justify-center space-x-3 pt-2">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="border-[#4A5568] text-gray-300 hover:bg-[#2D3748] hover:text-white"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!password}
              className="bg-[#0ABAB5] text-white hover:bg-[#0ABAB5]/90 disabled:opacity-50"
            >
              Sign Out
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
} 