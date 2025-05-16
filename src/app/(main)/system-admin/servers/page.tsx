
'use client';

import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getAuth, onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { db } from '@/firebase/firebase';
import { collection, addDoc, serverTimestamp, query, getDocs, Timestamp } from 'firebase/firestore';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Loader2, Edit3, Trash2, ServerIcon } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import RightDrawer from '@/components/RightDrawer';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useLanguage } from '@/contexts/LanguageContext';

interface ServerData {
  id: string;
  name: string;
  ipAddressWithPort: string;
  remarks?: string;
  status: 'online' | 'offline' | 'maintenance';
  createdAt: any; // Firestore Timestamp or string after formatting
  createdBy: string;
}

const serverFormSchema = z.object({
  name: z.string().min(1, "Server name is required."),
  ipAddressWithPort: z.string().min(1, "IP Address with Port is required.")
    .regex(/^(\d{1,3}\.){3}\d{1,3}:\d{1,5}$/, "Invalid IP:Port format (e.g., 192.168.1.1:8000)"),
  remarks: z.string().optional(),
  status: z.enum(['online', 'offline', 'maintenance']).default('online'),
});
type ServerFormValues = z.infer<typeof serverFormSchema>;

const AdminServersPage: NextPage = () => {
  const { toast } = useToast();
  const { translate } = useLanguage();
  const [servers, setServers] = useState<ServerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerData | null>(null); // For future edit functionality

  const form = useForm<ServerFormValues>({
    resolver: zodResolver(serverFormSchema),
    defaultValues: {
      name: '',
      ipAddressWithPort: '',
      remarks: '',
      status: 'online',
    },
  });

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        fetchServers();
      } else {
        setServers([]);
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchServers = async () => {
    setIsLoading(true);
    try {
      const serversQuery = query(collection(db, 'servers'));
      const querySnapshot = await getDocs(serversQuery);
      const serversData = querySnapshot.docs.map(docSnapshot => ({
        id: docSnapshot.id,
        ...docSnapshot.data(),
        createdAt: docSnapshot.data().createdAt?.toDate ? docSnapshot.data().createdAt.toDate().toLocaleDateString() : 'N/A',
      })) as ServerData[];
      setServers(serversData);
    } catch (error) {
      console.error("Error fetching servers: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch servers.' });
    }
    setIsLoading(false);
  };

  const handleAddServerClick = () => {
    setEditingServer(null);
    form.reset();
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setEditingServer(null);
  };

  const onSubmitServerForm: SubmitHandler<ServerFormValues> = async (data) => {
    if (!currentUser) {
      toast({ variant: 'destructive', title: 'Error', description: 'User not authenticated.' });
      return;
    }
    setIsSubmitting(true);

    try {
      if (editingServer) {
        // Update existing server (Future implementation)
        // const serverRef = doc(db, 'servers', editingServer.id);
        // await updateDoc(serverRef, { ...data, updatedAt: serverTimestamp() });
        // toast({ title: 'Server Updated', description: `${data.name} has been updated.` });
      } else {
        // Add new server
        await addDoc(collection(db, 'servers'), {
          ...data,
          createdBy: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        toast({ title: 'Server Added', description: `${data.name} has been added successfully.` });
      }
      fetchServers();
      handleDrawerClose();
    } catch (error) {
      console.error("Error processing server form: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save server data. Please try again.' });
    }
    setIsSubmitting(false);
  };

  const renderDrawerContent = () => (
    <div className="p-6">
      <Form {...form}>
        <form id="server-form" onSubmit={form.handleSubmit(onSubmitServerForm)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Server Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., VSS Processing Node 1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ipAddressWithPort"
            render={({ field }) => (
              <FormItem>
                <FormLabel>IP Address with Port</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 56.124.100.219:8100" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="remarks"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Remarks (Optional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Any notes about this server..." {...field} rows={3}/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select server status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
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
        form="server-form"
        disabled={isSubmitting || !form.formState.isValid}
      >
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {editingServer ? "Save Changes" : "Add Server"}
      </Button>
    </div>
  );

  if (!currentUser) { // Basic check, proper role check would be in layout or via rules
    return <p>Loading user data...</p>;
  }


  return (
    <div>
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-lg font-normal text-primary">Manage Servers</CardTitle>
              <CardDescription className="text-xs mt-1 text-muted-foreground">
                View, add, or modify system servers.
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleAddServerClick}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Server
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : servers.length > 0 ? (
            <div className="overflow-x-auto">
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>IP Address:Port</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead className="sticky right-0 bg-card z-10 text-right px-2 sm:px-4 w-[90px] min-w-[90px] border-l border-border">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {servers.map((server) => (
                      <TableRow key={server.id}>
                        <TableCell className="font-medium">{server.name}</TableCell>
                        <TableCell>{server.ipAddressWithPort}</TableCell>
                        <TableCell>
                          <Badge variant={
                            server.status === 'online' ? 'default' :
                            server.status === 'offline' ? 'destructive' : 'secondary'
                          } className={`${
                            server.status === 'online' ? 'bg-green-500 hover:bg-green-600' :
                            server.status === 'offline' ? '' : '' // Destructive badge has its own colors
                          } text-white`}>
                            {server.status.charAt(0).toUpperCase() + server.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{server.remarks || 'N/A'}</TableCell>
                        <TableCell>{server.createdAt}</TableCell>
                        <TableCell className="sticky right-0 bg-card z-10 text-right px-2 sm:px-4 w-[90px] min-w-[90px] border-l border-border">
                          <div className="flex justify-end items-center space-x-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" onClick={() => { /* handleEditServer(server.id) */ }} className="h-8 w-8" disabled>
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit Server (Not Implemented)</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" className="text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8" disabled>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete Server (Not Implemented)</p>
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
                <ServerIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-md font-semibold text-foreground mb-1">No Servers Configured Yet</h3>
                <p className="text-sm text-muted-foreground">System administrators can add and configure servers here.</p>
            </div>
          )}
        </CardContent>
      </Card>
      <RightDrawer
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        title={editingServer ? "Edit Server" : "Add New Server"}
        footerContent={drawerFooter()}
      >
        {renderDrawerContent()}
      </RightDrawer>
    </div>
  );
};

export default AdminServersPage;
