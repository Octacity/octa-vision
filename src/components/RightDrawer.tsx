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
        <SheetHeader className="h-16 flex items-center justify-center px-6 border-b">
          <SheetTitle className="font-normal text-primary truncate">{title}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-grow">
            {/* Children are now fully responsible for their padding. 
                If noPadding is false, the consumer should add padding to the children.
                If noPadding is true, the consumer should ensure children have no padding or manage it.
            */}
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
