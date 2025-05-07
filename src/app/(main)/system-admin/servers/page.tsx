
'use client';

import type { NextPage } from 'next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const AdminServersPage: NextPage = () => {
  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Manage Servers</CardTitle>
          <CardDescription>
            View and manage system server configurations and status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mt-4 p-4 border rounded-md bg-muted text-center">
            <p className="text-sm text-muted-foreground">
              Server management features will be available here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminServersPage;
