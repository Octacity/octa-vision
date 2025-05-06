
'use client';

import type { NextPage } from 'next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle } from 'lucide-react';

const OrganizationUsersPage: NextPage = () => {
  // Placeholder for users in the organization
  const users = [
    { id: '1', name: 'Alice Wonderland', email: 'alice@example.com', role: 'user' },
    { id: '2', name: 'Bob The Builder', email: 'bob@example.com', role: 'user' },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        {/* Content moved to CardHeader below */}
      </div>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Manage Organization Users</CardTitle>
              <CardDescription>Add, remove, or update users within your organization.</CardDescription>
            </div>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {users.length > 0 ? (
            <ul className="space-y-4">
              {users.map((user) => (
                <li key={user.id} className="p-4 border rounded-md flex justify-between items-center shadow-sm">
                  <div>
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email} - ({user.role})</p>
                  </div>
                  <div className="space-x-2">
                    <Button variant="outline" size="sm">Edit</Button>
                    <Button variant="destructive" size="sm">Remove</Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 p-4 border rounded-md bg-muted text-center">
              <p className="text-sm text-muted-foreground">No users found in your organization yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OrganizationUsersPage;
