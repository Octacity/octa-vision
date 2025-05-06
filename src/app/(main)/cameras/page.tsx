
'use client';

import type { NextPage } from 'next';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, AlertTriangle, Bell, MessageSquare, Plus, Users, ListFilter, ArrowUpDown, MoreHorizontal } from 'lucide-react';

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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Cameras</h2>
        <div className="flex items-center space-x-2">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Add Camera
          </Button>
          <Button variant="outline">
            <Users className="mr-2 h-4 w-4" /> Group
          </Button>
          <Button variant="outline">
            <ListFilter className="mr-2 h-4 w-4" /> Filter
          </Button>
          <Button variant="outline">
            <ArrowUpDown className="mr-2 h-4 w-4" /> Sort
          </Button>
          <Button variant="outline" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {cameras.map((camera, index) => (
          <Card key={index} className="overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-0">
              <div className="relative">
                <Image
                  src={camera.imageUrl}
                  alt={camera.name}
                  width={200}
                  height={150}
                  className="rounded-t-md aspect-video w-full object-cover"
                  data-ai-hint={camera.dataAiHint}
                />
                <CheckCircle className="absolute top-2 right-2 h-5 w-5 text-green-500 bg-white rounded-full p-0.5" />
              </div>
              <div className="p-3">
                <h3 className="text-sm font-semibold mb-2 truncate">{camera.name}</h3>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  {/* Configuration Icons Group */}
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1 cursor-pointer hover:text-primary">
                      <Clock className="w-3 h-3" />
                      <span>15 min</span>
                    </div>
                    <div className="flex items-center space-x-1 cursor-pointer hover:text-destructive">
                      <AlertTriangle className="w-3 h-3 text-destructive" />
                       <span>2</span>
                    </div>
                  </div>
                  {/* Action Icons Group */}
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Bell className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </Button>
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
