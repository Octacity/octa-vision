
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useCallback } from 'react';

interface LoadingContextType {
  isPageLoading: boolean;
  setIsPageLoading: (isLoading: boolean) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const usePageLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('usePageLoading must be used within a PageLoadingProvider');
  }
  return context;
};

export const PageLoadingProvider = ({ children }: { children: ReactNode }) => {
  const [isPageLoading, setIsPageLoadingState] = useState(false);
  
  const setIsPageLoading = useCallback((isLoading: boolean) => {
    setIsPageLoadingState(isLoading);
  }, []);

  return (
    <LoadingContext.Provider value={{ isPageLoading, setIsPageLoading }}>
      {children}
    </LoadingContext.Provider>
  );
};
