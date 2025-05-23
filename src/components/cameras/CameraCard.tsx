
'use client';

import type { Camera } from '@/app/(main)/cameras/types';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Camera as CameraIconLucide,
  Settings2,
  ShieldAlert,
  Bell,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertTriangle as AlertTriangleIcon,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CameraCardProps {
  camera: Camera;
  onChatClick: (camera: Camera) => void;
  onNotificationClick: (cameraId: string) => void;
}

const CameraCard: React.FC<CameraCardProps> = ({ camera, onChatClick, onNotificationClick }) => {
  const getStatusIcon = () => {
    switch (camera.processingStatus) {
      case 'running_normal':
        return <CheckCircle className="absolute top-2 right-2 h-5 w-5 text-green-500 bg-white rounded-full p-0.5" />;
      case 'waiting_for_approval':
      case 'pending_setup':
        return <Clock className="absolute top-2 right-2 h-5 w-5 text-orange-500 bg-white rounded-full p-0.5" />;
      case 'failed':
      case 'something_failed':
      default:
        return <AlertTriangleIcon className="absolute top-2 right-2 h-5 w-5 text-red-500 bg-white rounded-full p-0.5" />;
    }
  };

  return (
    <Card className="overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200 rounded-lg">
      <CardContent className="p-0">
        <div className="relative">
          {camera.imageUrl ? (
            <Image
              src={camera.imageUrl}
              alt={camera.cameraName}
              width={200}
              height={150}
              className="rounded-t-lg aspect-video w-full object-cover"
              data-ai-hint={camera.dataAiHint || 'camera footage'}
              unoptimized // If using GCS signed URLs, optimization might not be needed or could cause issues
            />
          ) : (
            <div className="rounded-t-lg aspect-video w-full object-cover bg-muted flex items-center justify-center">
              <CameraIconLucide className="w-12 h-12 text-muted-foreground" />
            </div>
          )}
          {getStatusIcon()}
        </div>
        <div className="p-3">
          <h3 className="text-sm font-semibold mb-2 truncate">{camera.cameraName}</h3>
          {camera.resolution && <p className="text-xs text-muted-foreground mb-1">Res: {camera.resolution}</p>}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center space-x-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center space-x-1 cursor-pointer hover:text-primary">
                      <Settings2 className="w-3 h-3" />
                      <span>Config</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View/Edit Configuration</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center space-x-1 cursor-pointer hover:text-destructive">
                      <ShieldAlert className="w-3 h-3 text-destructive" />
                      {/* Placeholder for alert count */}
                      <span>0</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Active Alerts</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center space-x-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onNotificationClick(camera.id)}>
                <Bell className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onChatClick(camera)}>
                <MessageSquare className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CameraCard;
