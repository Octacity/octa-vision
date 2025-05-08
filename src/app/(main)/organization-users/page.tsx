
'use client';

import type { NextPage } from 'next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Edit3, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

const OrganizationUsersPage: NextPage = () => {
  const { toast } = useToast();
  // Placeholder for users in the organization
  const users = [
    { id: '1', name: 'Alice Wonderland', email: 'alice@example.com', role: 'user' },
    { id: '2', name: 'Bob The Builder', email: 'bob@example.com', role: 'user' },
    { id: '3', name: 'Charlie Chaplin', email: 'charlie@example.com', role: 'user-admin' },
  ];

  const handleEditUser = (userId: string) => {
    toast({ title: 'Edit User', description: `Editing user ${userId} (not implemented).` });
  };

  const handleDeleteUser = (userId: string) => {
    toast({ variant: 'destructive', title: 'Delete User', description: `Deleting user ${userId} (not implemented).` });
  };

  const handleAddUser = () => {
    toast({ title: 'Add User', description: 'Adding new user (not implemented).' });
  };

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row justify-between items-center border-b">
          <div>
            {/* <CardTitle>Manage Users</CardTitle> Removed for consistency, appbar has title */}
            <CardDescription className="text-xs">Add, remove, or update users within your organization.</CardDescription>
          </div>
          <Button onClick={handleAddUser}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add User
          </Button>
        </CardHeader>
        <CardContent className="p-0"> {/* Removed sm:p-6 sm:pt-0 */}
          {users.length > 0 ? (
            <div className="overflow-x-auto">
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="sticky right-0 bg-muted z-10 text-right px-2 sm:px-4 w-[90px] min-w-[90px] border-l border-border">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'user-admin' ? 'default' : 'secondary'}>
                            {user.role === 'user-admin' ? 'Org Admin' : 'User'}
                          </Badge>
                        </TableCell>
                        <TableCell className="sticky right-0 bg-muted z-10 text-right px-2 sm:px-4 w-[90px] min-w-[90px] border-l border-border">
                          <div className="flex justify-end items-center space-x-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" onClick={() => handleEditUser(user.id)} className="h-8 w-8">
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit User</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" onClick={() => handleDeleteUser(user.id)} className="text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete User</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TooltipProvider>
            </div>
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
