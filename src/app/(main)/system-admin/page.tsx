
'use client';

import type { NextPage } from 'next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle } from 'lucide-react';

// Placeholder for organizations needing approval
const pendingOrganizations = [
  { id: 'org1', name: 'New Tech Solutions', email: 'contact@newtech.com', requestedAt: new Date(Date.now() - 86400000 * 2).toLocaleDateString() },
  { id: 'org2', name: 'Innovate Labs', email: 'admin@innovatelabs.io', requestedAt: new Date(Date.now() - 86400000 * 1).toLocaleDateString() },
];

const SystemAdminPage: NextPage = () => {
  const handleApprove = (orgId: string) => {
    console.log(`Approving organization: ${orgId}`);
    // Add logic to update organization status in Firestore
  };

  const handleReject = (orgId: string) => {
    console.log(`Rejecting organization: ${orgId}`);
    // Add logic to update organization status or remove it
  };

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>System Administration</CardTitle>
          <CardDescription>Manage organizations and system-wide settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <h3 className="text-xl font-semibold mb-4">Pending Organization Approvals</h3>
          {pendingOrganizations.length > 0 ? (
            <ul className="space-y-4">
              {pendingOrganizations.map((org) => (
                <li key={org.id} className="p-4 border rounded-md flex justify-between items-center shadow-sm">
                  <div>
                    <p className="font-semibold">{org.name}</p>
                    <p className="text-sm text-muted-foreground">{org.email}</p>
                    <p className="text-xs text-muted-foreground">Requested: {org.requestedAt}</p>
                  </div>
                  <div className="space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleApprove(org.id)} className="text-green-600 border-green-600 hover:bg-green-50">
                      <CheckCircle className="mr-2 h-4 w-4" /> Approve
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleReject(org.id)}>
                      <XCircle className="mr-2 h-4 w-4" /> Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 p-4 border rounded-md bg-muted text-center">
              <p className="text-sm text-muted-foreground">No organizations are currently pending approval.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemAdminPage;
