
'use client';

import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, Edit3, Trash2, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface UserData {
  id: string;
  email: string;
  role: 'user-admin' | 'user';
  createdAt: any; // Firestore Timestamp
  // Add other relevant user fields if needed, e.g., name
}

interface OrganizationData {
  name: string;
}

const ManageOrganizationUsersPage: NextPage = () => {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const orgId = params.orgId as string;

  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch organization details
        const orgDocRef = doc(db, 'organizations', orgId);
        const orgDocSnap = await getDoc(orgDocRef);

        if (!orgDocSnap.exists()) {
          toast({ variant: 'destructive', title: 'Error', description: 'Organization not found.' });
          router.push('/system-admin/organizations');
          return;
        }
        setOrganization(orgDocSnap.data() as OrganizationData);

        // Fetch users for this organization
        const usersQuery = query(collection(db, 'users'), where('organizationId', '==', orgId));
        const usersSnapshot = await getDocs(usersQuery);
        const usersData = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toLocaleDateString() : 'N/A',
        })) as UserData[];
        setUsers(usersData);

      } catch (error) {
        console.error("Error fetching data: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch organization or user data.' });
      }
      setLoading(false);
    };

    fetchData();
  }, [orgId, toast, router]);

  const handleEditUser = (userId: string) => {
    toast({ title: 'Edit User', description: `Editing user ${userId} (not implemented).` });
  };

  const handleDeleteUser = (userId: string) => {
    toast({ variant: 'destructive', title: 'Delete User', description: `Deleting user ${userId} (not implemented).` });
  };
  
  const handleAddUser = () => {
    toast({ title: 'Add User', description: 'Adding new user (not implemented).' });
  };


  if (loading) {
    return (
      <div className="flex justify-center items-center p-8 h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex justify-center items-center p-8 h-full">
        <p>Organization data could not be loaded.</p>
      </div>
    );
  }

  return (
    <div>
      <Button variant="outline" onClick={() => router.push('/system-admin/organizations')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Organizations
      </Button>
      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <div>
            <CardTitle>Manage Users for {organization.name}</CardTitle>
            <CardDescription>View, add, or modify users within this organization.</CardDescription>
          </div>
           <Button onClick={handleAddUser}>
            <UserPlus className="mr-2 h-4 w-4" /> Add User
          </Button>
        </CardHeader>
        <CardContent>
          {users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'user-admin' ? 'default' : 'secondary'}>
                        {user.role === 'user-admin' ? 'Admin' : 'User'}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.createdAt}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditUser(user.id)}>
                        <Edit3 className="mr-2 h-3 w-3" /> Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(user.id)}>
                        <Trash2 className="mr-2 h-3 w-3" /> Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="mt-4 p-4 border rounded-md bg-muted text-center">
              <p className="text-sm text-muted-foreground">No users found for this organization.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ManageOrganizationUsersPage;
