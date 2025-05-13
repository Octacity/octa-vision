
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <div className="text-center">
        <AlertTriangle className="mx-auto h-24 w-24 text-destructive mb-6" />
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-2">Page Not Found</h2>
        <p className="text-muted-foreground mb-8">
          Oops! The page you are looking for does not exist or has been moved.
        </p>
        <Button asChild>
          <Link href="/">Go back to Home</Link>
        </Button>
      </div>
    </div>
  );
}
