
'use client';

import { useNotificationDrawer } from '@/contexts/NotificationDrawerContext';
import RightDrawer from '@/components/RightDrawer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { Camera } from '@/app/(main)/cameras/page'; // Assuming Camera type is exported

interface Notification {
  id: string;
  cameraId: string;
  cameraName: string;
  message: string;
  timestamp: Date;
}

const mockNotifications: Notification[] = [
  { id: '1', cameraId: '1', cameraName: 'Camera 1', message: 'safety: worker not wearing helmet', timestamp: new Date(Date.now() - 1000 * 60 * 5) },
  { id: '2', cameraId: '2', cameraName: 'Camera 2', message: 'theft: suspicious individual detected near checkout', timestamp: new Date(Date.now() - 1000 * 60 * 15) },
  { id: '3', cameraId: '1', cameraName: 'Camera 1', message: 'safety: unlit work area', timestamp: new Date(Date.now() - 1000 * 60 * 30) },
  { id: '4', cameraId: '3', cameraName: 'Camera 3', message: 'alert: fire alarm triggered', timestamp: new Date(Date.now() - 1000 * 60 * 60) },
  { id: '5', cameraId: '2', cameraName: 'Camera 2', message: 'safety: worker not wearing ppe', timestamp: new Date(Date.now() - 1000 * 60 * 120) },
];


const NotificationDrawer = () => {
  const { isNotificationDrawerOpen, closeNotificationDrawer, notificationFilterId } = useNotificationDrawer();

  const filteredNotifications = notificationFilterId
    ? mockNotifications.filter(n => n.cameraId === notificationFilterId)
    : mockNotifications;

  const getTitle = () => {
    if (notificationFilterId) {
      const cameraName = mockNotifications.find(n => n.cameraId === notificationFilterId)?.cameraName || 'Camera';
      return `Notifications for ${cameraName}`;
    }
    return 'All Notifications';
  }

  return (
    <RightDrawer
      isOpen={isNotificationDrawerOpen}
      onClose={closeNotificationDrawer}
      title={getTitle()}
      noPadding // Using noPadding to allow full control of content styling
    >
      <div className="p-6 space-y-4">
        {filteredNotifications.length === 0 && (
          <p className="text-muted-foreground text-center">No notifications to display.</p>
        )}
        {filteredNotifications.map((notification) => (
          <Card key={notification.id} className="bg-destructive/10 border-destructive/30">
            <CardHeader className="p-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-destructive">{notification.cameraName}</CardTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/20" onClick={() => console.log("Dismiss notification", notification.id)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <p className="text-xs text-destructive/80">{notification.message}</p>
              <p className="text-xs text-destructive/60 mt-1">{notification.timestamp.toLocaleTimeString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </RightDrawer>
  );
};

export default NotificationDrawer;
