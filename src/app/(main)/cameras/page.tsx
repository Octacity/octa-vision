
'use client';

import type { NextPage } from 'next';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Clock, AlertTriangle, Bell, MessageSquare } from 'lucide-react';

const cameras = [
  {
    name: 'Camera 1',
    imageUrl: 'https://picsum.photos/id/237/200/150',
    dataAiHint: 'security camera',
  },
  {
    name: 'Camera 2',
    imageUrl: 'https://picsum.photos/id/238/200/150',
    dataAiHint: 'office surveillance',
  },
  {
    name: 'Camera 3',
    imageUrl: 'https://picsum.photos/id/239/200/150',
    dataAiHint: 'street view',
  },
  {
    name: 'Camera 4',
    imageUrl: 'https://picsum.photos/id/240/200/150',
    dataAiHint: 'parking lot',
  },
  {
    name: 'Camera 5',
    imageUrl: 'https://picsum.photos/id/241/200/150',
    dataAiHint: 'indoor retail',
  },
  {
    name: 'Camera 6',
    imageUrl: 'https://picsum.photos/id/242/200/150',
    dataAiHint: 'warehouse aisle',
  },
  {
    name: 'Camera 7',
    imageUrl: 'https://picsum.photos/id/243/200/150',
    dataAiHint: 'lobby entrance',
  },
  {
    name: 'Camera 8',
    imageUrl: 'https://picsum.photos/id/244/200/150',
    dataAiHint: 'exterior building',
  },
  {
    name: 'Camera 9',
    imageUrl: 'https://picsum.photos/id/245/200/150',
    dataAiHint: 'rooftop view',
  },
];

const CamerasPage: NextPage = () => {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Cameras</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {cameras.map((camera, index) => (
          <Card key={index}>
            <CardContent className="p-3">
              <div className="relative">
                <Image
                  src={camera.imageUrl}
                  alt={camera.name}
                  width={200}
                  height={150}
                  className="rounded-md aspect-video w-full"
                  data-ai-hint={camera.dataAiHint}
                />
                <CheckCircle className="absolute top-2 right-2 h-5 w-5 text-green-500" />
              </div>
              <h3 className="text-sm font-semibold mt-2">{camera.name}</h3>
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                {/* Configuration Icons Group */}
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1">
                    <span>15 min</span>
                    <Clock className="w-3 h-3" />
                  </div>
                  <div className="flex items-center space-x-1">
                    <span>2</span>
                    <AlertTriangle className="w-3 h-3 text-destructive" />
                  </div>
                </div>
                {/* Action Icons Group */}
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1">
                    <span>5</span>
                    <Bell className="w-3 h-3" />
                  </div>
                  <div className="flex items-center space-x-1">
                    <span>5</span>
                    <MessageSquare className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default CamerasPage;
