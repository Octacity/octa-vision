
'use client';

import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getAuth, onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { db } from '@/firebase/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, deleteDoc } from 'firebase/firestore';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Edit3, Trash2, Loader2, UserPlus } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import RightDrawer from '@/components/RightDrawer';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


interface UserData {
  id: string;
  email: string;
  role: 'system-admin' | 'user-admin' | 'user';
  createdAt: any; // Firestore Timestamp or string after formatting
  name?: string; // Optional name field
}

const addUserSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }).min(1, "Email is required."),
  name: z.string().optional(), // Name is optional for now
  role: z.enum(['user', 'user-admin']).default('user'), // user-admin can only add 'user' or another 'user-admin' for their org
});
type AddUserFormValues = z.infer<typeof addUserSchema>;

const OrganizationUsersPage: NextPage = () => {
  const { toast } = useToast();
  const { translate } = useLanguage();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [currentUserOrgId, setCurrentUserOrgId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          setCurrentUserRole(userData.role);
          if (userData.organizationId && userData.role === 'user-admin') {
            setCurrentUserOrgId(userData.organizationId);
            fetchUsers(userData.organizationId);
          } else {
            // Handle case where user is not a user-admin or has no orgId
            setUsers([]);
            setIsLoading(false);
          }
        } else {
          setUsers([]);
          setIsLoading(false);
        }
      } else {
        setUsers([]);
        setIsLoading(false);
        setCurrentUserOrgId(null);
        setCurrentUserRole(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchUsers = async (organizationId: string) => {
    setIsLoading(true);
    try {
      const usersQuery = query(collection(db, 'users'), where('organizationId', '==', organizationId));
      const querySnapshot = await getDocs(usersQuery);
      const usersData = querySnapshot.docs.map(docSnapshot => ({
        id: docSnapshot.id,
        ...docSnapshot.data(),
        createdAt: docSnapshot.data().createdAt?.toDate ? docSnapshot.data().createdAt.toDate().toLocaleDateString() : 'N/A',
      })) as UserData[];
      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch users.' });
    }
    setIsLoading(false);
  };


  const handleEditUser = (userId: string) => {
    // Placeholder for edit functionality
    // You might want to open the drawer with the user's data pre-filled
    // or navigate to a separate edit page
    const userToEdit = users.find(u => u.id === userId);
    if (userToEdit) {
        form.reset({ email: userToEdit.email, name: userToEdit.name || '', role: userToEdit.role as 'user' | 'user-admin' });
        // Set a state to indicate editing mode if needed, or handle update logic differently
        setIsDrawerOpen(true);
        toast({ title: 'Edit User', description: `Editing ${userToEdit.email}. (Save functionality not fully implemented).`});
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
    if (userToDelete && userToDelete.role === 'user-admin' && currentUserOrgId) {
      const adminUsersQuery = query(
        collection(db, 'users'),
        where('organizationId', '==', currentUserOrgId),
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


    try {
      await deleteDoc(doc(db, "users", userId));
      toast({ title: 'User Deleted', description: `User has been removed from the organization.` });
      if(currentUserOrgId) fetchUsers(currentUserOrgId); 
    } catch (error) {
      console.error("Error deleting user: ", error);
      toast({ variant: 'destructive', title: 'Delete Failed', description: 'Could not delete user. Please try again.' });
    }
  };

  const handleAddUserClick = () => {
    form.reset();
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
  };

  const onSubmitAddUser: SubmitHandler<AddUserFormValues> = async (data) => {
    if (!currentUserOrgId || !currentUser) {
      toast({ variant: 'destructive', title: 'Error', description: 'Organization context not found.' });
      return;
    }
    setIsSubmitting(true);
    const emailToCheck = data.email.toLowerCase().trim();

    try {
      // Check if user with this email already exists in the organization
      const emailQuery = query(
        collection(db, 'users'),
        where('organizationId', '==', currentUserOrgId),
        where('email', '==', emailToCheck)
      );
      const emailQuerySnapshot = await getDocs(emailQuery);

      if (!emailQuerySnapshot.empty) {
        toast({
          variant: 'destructive',
          title: 'User Exists',
          description: 'A user with this email already exists in your organization.',
        });
        setIsSubmitting(false);
        return;
      }


      await addDoc(collection(db, 'users'), {
        email: emailToCheck, 
        name: data.name || null, 
        role: data.role,
        organizationId: currentUserOrgId,
        createdBy: currentUser.uid, 
        createdAt: serverTimestamp(),
      });

      toast({ title: 'User Added', description: `${data.email} has been added to your organization.` });
      fetchUsers(currentUserOrgId); 
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
        <form id="add-user-form" onSubmit={form.handleSubmit(onSubmitAddUser)} className="space-y-6">
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
                  </SelectContent>
                </Select>
                <FormDescription>
                  Users can access features, Organization Admins can also manage users.
                </FormDescription>
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
        form="add-user-form" 
        disabled={isSubmitting || !form.formState.isValid}
      >
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Add User
      </Button>
    </div>
  );


  if (isLoading && !currentUserOrgId) {
    return (
      <div className="flex justify-center items-center p-8 h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  
  if (!currentUserOrgId || currentUserRole !== 'user-admin') {
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
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-lg font-normal text-primary">Manage Users</CardTitle>
              <CardDescription className="text-xs mt-1 text-muted-foreground">
                Add, remove, or update users within your organization.
              </CardDescription>
            </div>
             {currentUserRole === 'user-admin' && (
              <Button onClick={handleAddUserClick}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add User
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
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
                      {currentUserRole === 'user-admin' && (
                        <TableHead className="sticky right-0 bg-card z-10 text-right px-2 sm:px-4 w-[90px] min-w-[90px] border-l border-border">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name || 'N/A'}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'user-admin' ? 'default' : user.role === 'system-admin' ? 'destructive' : 'secondary'}>
                            {user.role === 'user-admin' ? 'Org Admin' : user.role === 'system-admin' ? 'System Admin': 'User'}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.createdAt}</TableCell>
                        {currentUserRole === 'user-admin' && (
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
                        )}
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
      <RightDrawer
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        title="Add New User"
        footerContent={drawerFooter()}
      >
        {renderDrawerContent()}
      </RightDrawer>
    </div>
  );
};

export default OrganizationUsersPage;

