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
  noPadding?: boolean;
}

const RightDrawer = ({
  isOpen,
  onClose,
  title,
  children,
  footerContent,
  noPadding = false,
}: RightDrawerProps) => {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="h-16 flex flex-shrink-0 items-center justify-center px-4 border-b"> {/* Changed px-6 to px-4 and added flex-shrink-0 */}
          <SheetTitle className="font-normal text-primary truncate">{title}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-grow">
            {children}
        </ScrollArea>
        {footerContent && (
          <div className={`p-0 ${noPadding && footerContent ? '' : 'border-t'}`}>
            {footerContent}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default RightDrawer;
