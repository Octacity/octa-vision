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
}

const RightDrawer = ({
  isOpen,
  onClose,
  title,
  children,
  footerContent,
}: RightDrawerProps) => {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-lg w-[90vw] p-0 flex flex-col">
        <SheetHeader className="p-6 border-b">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-grow p-6">
            {children}
        </ScrollArea>
        {footerContent && (
          <SheetFooter className="p-6 border-t">
            {footerContent}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default RightDrawer;