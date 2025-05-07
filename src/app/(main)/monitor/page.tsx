
'use client';

import type { NextPage } from 'next';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Video as VideoIcon } from 'lucide-react'; // Renamed to avoid conflict with HTMLVideoElement

const MonitorPage: NextPage = () => {
  const rtspUrl = "rtsp://user:User@12144@201.76.191.250:8055/cam/realmonitor?channel=1&subtype=0";

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Live Camera Monitor</CardTitle>
          <CardDescription>
            Attempting to display camera feed. Direct RTSP streaming in web browsers has limitations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-black rounded-md overflow-hidden shadow-lg">
            <div className="w-full aspect-video relative">
              <Image
                src="https://picsum.photos/seed/livefeedmonitoring/1280/720" 
                alt="Live camera feed placeholder"
                layout="fill"
                objectFit="cover"
                className="bg-muted"
                data-ai-hint="surveillance feed"
                priority
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <VideoIcon className="w-20 h-20 text-white/60" />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-1">Monitoring Feed URL:</h3>
            <p className="text-xs break-all text-foreground bg-muted p-2 rounded-md">{rtspUrl}</p>
          </div>

          <Alert variant="default" className="border-primary/20 bg-primary/5">
            <VideoIcon className="h-4 w-4 text-primary/80" />
            <AlertTitle className="text-primary/90">RTSP Streaming Information</AlertTitle>
            <AlertDescription className="text-foreground/80">
              Directly streaming RTSP feeds in web browsers is not natively supported. This typically requires a backend transcoding service (e.g., to HLS/DASH) or a specialized WebRTC player setup. The above is a visual placeholder for the feed.
            </AlertDescription>
          </Alert>
          
        </CardContent>
      </Card>
    </div>
  );
};

export default MonitorPage;
