'use client';

import type { NextPage } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const GroupsPage: NextPage = () => {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Manage Groups</h2>
      <Card>
        <CardHeader>
          <CardTitle>Camera Groups</CardTitle>
        </CardHeader>
        <CardContent>
          <p>This is where you can create, edit, and manage groups of cameras for easier monitoring and alert configuration.</p>
          {/* Placeholder content for groups */}
          <div className="mt-4 p-4 border rounded-md bg-muted">
            <p className="text-sm text-muted-foreground">Group management features will be available here.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GroupsPage;
