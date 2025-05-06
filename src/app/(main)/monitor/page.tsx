'use client';

import type { NextPage } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Video } from 'lucide-react';


const MonitorPage: NextPage = () => {
  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Real-time Camera Feeds</CardTitle>
        </CardHeader>
        <CardContent>
          <p>View live feeds from your cameras and active alerts.</p>
          {/* Placeholder content for monitoring */}
          <div className="mt-4 p-8 border rounded-md bg-muted flex flex-col items-center justify-center aspect-video">
            <Video className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">Live monitoring dashboard will be displayed here.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonitorPage;
