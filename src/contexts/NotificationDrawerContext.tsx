
'use client';

import type { ReactNode} from 'react';
import { createContext, useCallback, useContext, useState } from 'react';

interface NotificationDrawerContextType {
  isNotificationDrawerOpen: boolean;
  openNotificationDrawer: (filterCameraId?: string) => void;
  closeNotificationDrawer: () => void;
  notificationFilterId: string | null;
}

const NotificationDrawerContext = createContext<NotificationDrawerContextType | undefined>(undefined);

export const useNotificationDrawer = () => {
  const context = useContext(NotificationDrawerContext);
  if (!context) {
    throw new Error('useNotificationDrawer must be used within a NotificationDrawerProvider');
  }
  return context;
};

interface NotificationDrawerProviderProps {
  children: ReactNode;
}

export const NotificationDrawerProvider = ({ children }: NotificationDrawerProviderProps) => {
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [notificationFilterId, setNotificationFilterId] = useState<string | null>(null);

  const openNotificationDrawer = useCallback((filterCameraId?: string) => {
    setIsNotificationDrawerOpen(true);
    setNotificationFilterId(filterCameraId || null);
  }, []);

  const closeNotificationDrawer = useCallback(() => {
    setIsNotificationDrawerOpen(false);
    setNotificationFilterId(null);
  }, []);

  return (
    <NotificationDrawerContext.Provider
      value={{
        isNotificationDrawerOpen,
        openNotificationDrawer,
        closeNotificationDrawer,
        notificationFilterId,
      }}
    >
      {children}
    </NotificationDrawerContext.Provider>
  );
};
