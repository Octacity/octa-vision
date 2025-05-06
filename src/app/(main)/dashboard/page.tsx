'use client';

import type { NextPage } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const DashboardPage: NextPage = () => {
  return (
    <div>
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
