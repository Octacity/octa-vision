
'use client';

import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

const DashboardPage: NextPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  // Removed isOrgApproved state as it's handled by the layout

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Basic loading state management, detailed approval check is in layout
      if (user) {
        // User is authenticated, proceed to load dashboard data or rely on layout for approval status
      } else {
        // No user, handled by layout redirect
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div>
      {isLoading && (
        <div className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* The 'Organization Approval Pending' alert is now handled by MainLayout.tsx */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Active Cameras</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">12</p>
            <p className="text-sm text-muted-foreground">Currently online</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Alerts Today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">5</p>
            <p className="text-sm text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-green-500 font-semibold">All Systems Operational</p>
            <p className="text-sm text-muted-foreground">Last check: Just now</p>
          </CardContent>
        </Card>
      </div>
      {/* Add more dashboard specific widgets here */}
    </div>
  );
};

export default DashboardPage;
