// src/components/RightDrawer.tsx
'use client';

import type { ReactNode } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RightDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footerContent?: ReactNode;
  noPadding?: boolean; // Added noPadding prop
}

const RightDrawer = ({
  isOpen,
  onClose,
  title,
  children,
  footerContent,
  noPadding = false, // Default to false
}: RightDrawerProps) => {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="h-16 flex items-center justify-center px-6 border-b"> {/* Added justify-center */}
          <SheetTitle className="font-normal text-primary">{title}</SheetTitle>
        </SheetHeader>
        <ScrollArea className={`flex-grow ${noPadding ? '' : 'p-6'}`}>
            {children}
        </ScrollArea>
        {footerContent && (
          // Ensure footer still has padding if it's a separate component from the chat input
          <div className={`p-0 ${noPadding && footerContent ? '' : 'border-t'}`}> 
            {footerContent}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default RightDrawer;
