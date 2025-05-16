
'use client';

import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, updateDoc } from 'firebase/firestore';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePageLoading } from '@/contexts/LoadingContext';


interface UserData {
  id: string;
  email: string;
  role: 'system-admin' | 'user-admin' | 'user';
  createdAt: any;
  name?: string;
  organizationId?: string;
}

interface OrganizationData {
  name: string;
}

const userFormSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }).min(1, "Email is required."),
  name: z.string().optional(),
  role: z.enum(['user', 'user-admin', 'system-admin']).default('user'),
});
type UserFormValues = z.infer<typeof userFormSchema>;


const ManageOrganizationUsersPage: NextPage = () => {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const orgId = params.orgId as string;
  const { setIsPageLoading } = usePageLoading();

  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: '',
      name: '',
      role: 'user',
    },
  });

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged(async user => {
      setCurrentUser(user);
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setCurrentUserRole(userDocSnap.data().role);
        }
      } else {
        setCurrentUserRole(null);
      }
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
          setIsPageLoading(true);
          router.push('/system-admin/organizations');
          return;
        }
        setOrganization(orgDocSnap.data() as OrganizationData);

        fetchOrgUsers();

      } catch (error) {
        console.error("Error fetching organization data: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch organization data.' });
      }
      setLoading(false);
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, toast, router]);

  const fetchOrgUsers = async () => {
    if (!orgId) return;
    setLoading(true);
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
    setLoading(false);
  };


  const handleEditUser = (userId: string) => {
    const userToEdit = users.find(u => u.id === userId);
    if (userToEdit) {
        setEditingUser(userToEdit);
        form.reset({
            email: userToEdit.email,
            name: userToEdit.name || '',
            role: userToEdit.role as 'user' | 'user-admin' | 'system-admin'
        });
        setIsDrawerOpen(true);
    } else {
        toast({ variant: 'destructive', title: 'Error', description: 'User not found.'});
    }
  };

  const handleDeleteUser = async (userId: string) => {
     if (currentUser && currentUser.uid === userId) {
      toast({
        variant: "destructive",
        title: "Cannot Delete Self",
        description: "You cannot delete your own user account.",
      });
      return;
    }

    const userToDelete = users.find(u => u.id === userId);
    if (userToDelete && userToDelete.role === 'user-admin' && orgId) {
        const adminUsersQuery = query(
            collection(db, 'users'),
            where('organizationId', '==', orgId),
            where('role', '==', 'user-admin')
        );
        const adminUsersSnapshot = await getDocs(adminUsersQuery);
        if (adminUsersSnapshot.size <= 1) {
            toast({
            variant: "destructive",
            title: "Cannot Delete Last Admin",
            description: "The organization must have at least one user-admin.",
            });
            return;
        }
    }
    if (userToDelete && userToDelete.role === 'system-admin') {
        
        const systemAdminQuery = query(collection(db, 'users'), where('role', '==', 'system-admin'));
        const systemAdminSnapshot = await getDocs(systemAdminQuery);
        if (systemAdminSnapshot.size <= 1) {
            toast({
                variant: "destructive",
                title: "Cannot Delete Last System Admin",
                description: "The system must have at least one system-admin.",
            });
            return;
        }
    }

    try {
      await deleteDoc(doc(db, "users", userId));
      toast({ title: 'User Deleted', description: `User has been removed from the organization.` });
      fetchOrgUsers();
    } catch (error) {
      console.error("Error deleting user: ", error);
      toast({ variant: 'destructive', title: 'Delete Failed', description: 'Could not delete user. Please try again.' });
    }
  };

  const handleAddUserClick = () => {
    setEditingUser(null);
    form.reset();
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setEditingUser(null);
  };

  const onSubmitUserForm: SubmitHandler<UserFormValues> = async (data) => {
    if (!orgId || !currentUser) {
      toast({ variant: 'destructive', title: 'Error', description: 'Organization context or current user not found.' });
      return;
    }
    setIsSubmitting(true);
    const emailToCheck = data.email.toLowerCase().trim();

    try {
       if (editingUser) {
        // Edit existing user
        const userToUpdateRef = doc(db, 'users', editingUser.id);
        const userToUpdateSnap = await getDoc(userToUpdateRef);

        if (!userToUpdateSnap.exists()) {
          toast({ variant: 'destructive', title: 'Error', description: 'User not found for update.' });
          setIsSubmitting(false);
          return;
        }
        const currentData = userToUpdateSnap.data();

        // System admin specific checks
        if (editingUser.role === 'system-admin' && data.role !== 'system-admin') {
            const systemAdminQuery = query(collection(db, 'users'), where('role', '==', 'system-admin'));
            const systemAdminSnapshot = await getDocs(systemAdminQuery);
            if (systemAdminSnapshot.docs.filter(d => d.id !== editingUser.id).length === 0) {
                 toast({
                    variant: 'destructive',
                    title: 'Action Denied',
                    description: 'Cannot change the role of the last system admin.',
                });
                setIsSubmitting(false);
                return;
            }
        }
         if (editingUser.role === 'user-admin' && data.role === 'user') {
            const adminUsersQuery = query(
                collection(db, 'users'),
                where('organizationId', '==', editingUser.organizationId),
                where('role', '==', 'user-admin')
            );
            const adminUsersSnapshot = await getDocs(adminUsersQuery);
            if (adminUsersSnapshot.docs.filter(d => d.id !== editingUser.id).length === 0) {
                 toast({
                    variant: 'destructive',
                    title: 'Action Denied',
                    description: 'This is the last organization admin. Cannot change their role to user.',
                });
                setIsSubmitting(false);
                return;
            }
        }


        await updateDoc(userToUpdateRef, {
          email: emailToCheck,
          name: data.name || currentData?.name || null,
          role: data.role,
          updatedAt: serverTimestamp(),
        });
        toast({ title: 'User Updated', description: `${emailToCheck} has been updated.` });

      } else {
        // Add new user
        const emailQuery = query(
          collection(db, 'users'),
          where('organizationId', '==', orgId),
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

        await addDoc(collection(db, 'users'), {
          email: emailToCheck,
          name: data.name || null,
          role: data.role,
          organizationId: orgId,
          createdBy: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        toast({ title: 'User Added', description: `${data.email} has been added to ${organization?.name}.` });
      }
      fetchOrgUsers();
      handleDrawerClose();
    } catch (error) {
      console.error("Error processing user form: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not process user. Please try again.' });
    }
    setIsSubmitting(false);
  };

  const renderDrawerContent = () => (
    <div className="p-6">
      <Form {...form}>
        <form id="add-user-form-system-admin" onSubmit={form.handleSubmit(onSubmitUserForm)} className="space-y-6">
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
                <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    // System admin cannot change their own role to non-system-admin if they are the only one
                    disabled={editingUser?.id === currentUser?.uid && editingUser?.role === 'system-admin'}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="user-admin">Admin</SelectItem>
                     {currentUserRole === 'system-admin' && ( 
                        <SelectItem value="system-admin">System Admin</SelectItem>
                     )}
                  </SelectContent>
                </Select>
                 {editingUser?.id === currentUser?.uid && editingUser?.role === 'system-admin' &&
                    <FormDescription>You cannot change your own role as a system admin.</FormDescription>
                 }
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
        {editingUser ? "Save Changes" : "Add User"}
      </Button>
    </div>
  );


  if (loading && !organization) {
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

  // Access control for the page itself
  if (currentUserRole !== 'system-admin') {
     return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center text-center py-12">
            <UserPlus className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Access Denied</h3>
            <p className="text-muted-foreground">You do not have permission to manage users for this organization.</p>
          </div>
        </CardContent>
      </Card>
    );
  }


  return (
    <div>
      <Button variant="outline" onClick={() => {setIsPageLoading(true); router.push('/system-admin/organizations');}} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Organizations
      </Button>
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-row justify-between items-center">
            <div>
                <CardTitle className="text-lg font-normal text-primary">View, add, or modify users for <strong className="text-foreground">{organization.name}</strong></CardTitle>
            </div>
           <Button size="sm" onClick={handleAddUserClick}>
            <UserPlus className="mr-2 h-4 w-4" /> Add User
          </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && users.length === 0 ? (
             <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : users.length > 0 ? (
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
                             user.role === 'user-admin' ? 'Admin' : 'User'}
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
                            <AlertDialog>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                   <Button
                                    variant="outline"
                                    size="icon"
                                    className="text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                                    disabled={currentUser?.uid === user.id}
                                     onClick={(e) => {
                                      if (currentUser?.uid === user.id) {
                                        e.preventDefault();
                                        toast({
                                          variant: "destructive",
                                          title: "Cannot Delete Self",
                                          description: "You cannot delete your own user account.",
                                        });
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                 <p>{currentUser?.uid === user.id ? "Cannot delete self" : "Delete User"}</p>
                                </TooltipContent>
                              </Tooltip>
                              {currentUser?.uid !== user.id && (
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone. This will permanently delete the user account
                                      for {user.email}.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteUser(user.id)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              )}
                            </AlertDialog>
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
        title={editingUser ? `Edit User in ${organization.name}` : `Add New User to ${organization.name}`}
        footerContent={drawerFooter()}
      >
        {renderDrawerContent()}
      </RightDrawer>
    </div>
  );
};

export default ManageOrganizationUsersPage;
