
'use client';

import type { NextPage } from 'next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const SystemAdminLandingPage: NextPage = () => {
  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>System Administration</CardTitle>
          <CardDescription>
            Welcome to the System Administration area. Please select an option from the sidebar to manage organizations (including their users) or system servers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Use the sidebar navigation to access different admin functionalities.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemAdminLandingPage;
