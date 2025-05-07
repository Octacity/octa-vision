
'use client';

import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ShieldAlert } from 'lucide-react';

const DashboardPage: NextPage = () => {
  const [isOrgApproved, setIsOrgApproved] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          const organizationId = userData?.organizationId;
          if (organizationId) {
            const orgDocRef = doc(db, 'organizations', organizationId);
            const orgDocSnap = await getDoc(orgDocRef);
            if (orgDocSnap.exists()) {
              setIsOrgApproved(orgDocSnap.data()?.approved || false);
            } else {
              setIsOrgApproved(false);
            }
          } else {
            setIsOrgApproved(false);
          }
        } else {
          setIsOrgApproved(false);
        }
      } else {
        setIsOrgApproved(false); // Should be handled by layout redirect
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

      {!isLoading && isOrgApproved === false && (
        <Alert variant="destructive" className="mb-6">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Organization Approval Pending</AlertTitle>
          <AlertDescription>
            Your organization's account is currently awaiting approval. 
            Camera processing and certain features will remain paused until your account is approved by an administrator.
          </AlertDescription>
        </Alert>
      )}

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
