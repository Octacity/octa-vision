'use client';

import type { NextPage } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Archive } from 'lucide-react';

const VideosPage: NextPage = () => {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Recorded Videos</h2>
      <Card>
        <CardHeader>
          <CardTitle>Video Archive</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Access and manage your recorded video footage.</p>
          {/* Placeholder content for videos */}
           <div className="mt-4 p-8 border rounded-md bg-muted flex flex-col items-center justify-center">
            <Archive className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">Video recordings and archive will be accessible here.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VideosPage;
