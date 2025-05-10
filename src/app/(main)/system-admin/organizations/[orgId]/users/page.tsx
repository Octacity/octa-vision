
'use client';

import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/firebase';
import { getAuth, type User as FirebaseUser } from 'firebase/auth';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, Edit3, Trash2, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import RightDrawer from '@/components/RightDrawer';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


interface UserData {
  id: string;
  email: string;
  role: 'system-admin' | 'user-admin' | 'user';
  createdAt: any; 
  name?: string;
}

interface OrganizationData {
  name: string;
}

const addUserSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }).min(1, "Email is required."),
  name: z.string().optional(),
  role: z.enum(['user', 'user-admin', 'system-admin']).default('user'), 
});
type AddUserFormValues = z.infer<typeof addUserSchema>;


const ManageOrganizationUsersPage: NextPage = () => {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const orgId = params.orgId as string;

  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      email: '',
      name: '',
      role: 'user',
    },
  });

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!orgId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const orgDocRef = doc(db, 'organizations', orgId);
        const orgDocSnap = await getDoc(orgDocRef);

        if (!orgDocSnap.exists()) {
          toast({ variant: 'destructive', title: 'Error', description: 'Organization not found.' });
          router.push('/system-admin/organizations');
          return;
        }
        setOrganization(orgDocSnap.data() as OrganizationData);

        const usersQuery = query(collection(db, 'users'), where('organizationId', '==', orgId));
        const usersSnapshot = await getDocs(usersQuery);
        const usersData = usersSnapshot.docs.map(docSnapshot => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
          createdAt: docSnapshot.data().createdAt?.toDate ? docSnapshot.data().createdAt.toDate().toLocaleDateString() : 'N/A',
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

  const fetchUsers = async () => { // Renamed to avoid conflict with outer scope fetchUsers
    if (!orgId) return;
    // Duplicates logic from useEffect for now, can be refactored
    try {
      const usersQuery = query(collection(db, 'users'), where('organizationId', '==', orgId));
      const usersSnapshot = await getDocs(usersQuery);
      const usersData = usersSnapshot.docs.map(docSnapshot => ({
        id: docSnapshot.id,
        ...docSnapshot.data(),
        createdAt: docSnapshot.data().createdAt?.toDate ? docSnapshot.data().createdAt.toDate().toLocaleDateString() : 'N/A',
      })) as UserData[];
      setUsers(usersData);
    } catch (error) {
      console.error("Error re-fetching users: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not refresh user list.' });
    }
  };


  const handleEditUser = (userId: string) => {
    toast({ title: 'Edit User', description: `Editing user ${userId} (not implemented).` });
  };

  const handleDeleteUser = (userId: string) => {
    toast({ variant: 'destructive', title: 'Delete User', description: `Deleting user ${userId} (not implemented).` });
  };
  
  const handleAddUserClick = () => {
    form.reset();
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
  };

  const onSubmitAddUser: SubmitHandler<AddUserFormValues> = async (data) => {
    if (!orgId || !currentUser) {
      toast({ variant: 'destructive', title: 'Error', description: 'Organization context or current user not found.' });
      return;
    }
    setIsSubmitting(true);
    const emailToCheck = data.email.toLowerCase().trim();

    try {
       // Check if user with this email already exists in the organization
       const emailQuery = query(
        collection(db, 'users'),
        where('organizationId', '==', orgId), // Use the current orgId from params
        where('email', '==', emailToCheck)
      );
      const emailQuerySnapshot = await getDocs(emailQuery);

      if (!emailQuerySnapshot.empty) {
        toast({
          variant: 'destructive',
          title: 'User Exists',
          description: 'A user with this email already exists in this organization.',
        });
        setIsSubmitting(false);
        return;
      }

      // Note: Actual Firebase Auth user creation (invite, password setup) is typically a backend/function task.
      // This example focuses on Firestore record creation.
      await addDoc(collection(db, 'users'), {
        email: emailToCheck,
        name: data.name || null,
        role: data.role,
        organizationId: orgId, // Assign to the current organization being managed
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
      });

      toast({ title: 'User Added', description: `${data.email} has been added to ${organization?.name}.` });
      fetchUsers(); // Refresh the list
      handleDrawerClose();
    } catch (error) {
      console.error("Error adding user: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not add user. Please try again.' });
    }
    setIsSubmitting(false);
  };

  const renderDrawerContent = () => (
    <div className="p-6">
      <Form {...form}>
        <form id="add-user-form-system-admin" onSubmit={form.handleSubmit(onSubmitAddUser)} className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address</FormLabel>
                <FormControl>
                  <Input placeholder="user@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="user-admin">Organization Admin</SelectItem>
                     {/* System admin might be able to assign system-admin role,
                         but typically this is done via a more secure, direct DB modification
                         or a dedicated super-admin interface. For safety, keeping it simpler here.
                         If needed, add: <SelectItem value="system-admin">System Admin</SelectItem>
                     */}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  );

  const drawerFooter = () => (
    <div className="flex justify-between p-4 border-t">
      <Button variant="outline" onClick={handleDrawerClose} disabled={isSubmitting}>Cancel</Button>
      <Button
        type="submit"
        form="add-user-form-system-admin"
        disabled={isSubmitting || !form.formState.isValid}
      >
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Add User
      </Button>
    </div>
  );


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
        <CardHeader className="border-b">
          <div className="flex flex-row justify-between items-center">
            <div>
                <CardTitle className="text-lg font-normal text-primary">Manage Users for <strong className="text-foreground">{organization.name}</strong></CardTitle>
                <CardDescription className="text-xs mt-1 text-muted-foreground">View, add, or modify users for this organization.</CardDescription>
            </div>
           <Button onClick={handleAddUserClick}>
            <UserPlus className="mr-2 h-4 w-4" /> Add User
          </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0"> 
          {users.length > 0 ? (
            <div className="overflow-x-auto">
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="sticky right-0 bg-card z-10 text-right px-2 sm:px-4 w-[90px] min-w-[90px] border-l border-border">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name || 'N/A'}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={
                            user.role === 'system-admin' ? 'destructive' :
                            user.role === 'user-admin' ? 'default' : 'secondary'
                          }>
                            {user.role === 'system-admin' ? 'System Admin' :
                             user.role === 'user-admin' ? 'Org Admin' : 'User'}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.createdAt}</TableCell>
                        <TableCell className="sticky right-0 bg-card z-10 text-right px-2 sm:px-4 w-[90px] min-w-[90px] border-l border-border">
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
              <p className="text-sm text-muted-foreground">No users found for this organization.</p>
            </div>
          )}
        </CardContent>
      </Card>
       <RightDrawer
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        title={`Add New User to ${organization.name}`}
        footerContent={drawerFooter()}
      >
        {renderDrawerContent()}
      </RightDrawer>
    </div>
  );
};

export default ManageOrganizationUsersPage;

