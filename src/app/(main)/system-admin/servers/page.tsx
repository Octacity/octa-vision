
'use client';

import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getAuth, onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { db } from '@/firebase/firebase';
import { collection, addDoc, serverTimestamp, query, getDocs, Timestamp, doc, updateDoc, writeBatch, where } from 'firebase/firestore';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Loader2, Edit3, Trash2, ServerIcon, CheckCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import RightDrawer from '@/components/RightDrawer';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePageLoading } from '@/contexts/LoadingContext';
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


interface ServerData {
  id: string;
  name: string;
  ipAddressWithPort: string;
  protocol: 'http' | 'https';
  remarks?: string;
  status: 'online' | 'offline' | 'maintenance';
  isSystemDefault?: boolean;
  createdAt: any;
  createdBy: string;
}

const serverFormSchema = z.object({
  name: z.string().min(1, "Server name is required."),
  ipAddressWithPort: z.string().min(1, "IP Address with Port is required.")
    .regex(/^(\d{1,3}\.){3}\d{1,3}:\d{1,5}$/, "Invalid IP:Port format (e.g., 192.168.1.1:8000)"),
  protocol: z.enum(['http', 'https']).default('http'),
  remarks: z.string().optional(),
  status: z.enum(['online', 'offline', 'maintenance']).default('online'),
  isSystemDefault: z.boolean().optional().default(false),
});
type ServerFormValues = z.infer<typeof serverFormSchema>;

const AdminServersPage: NextPage = () => {
  const { toast } = useToast();
  const { translate } = useLanguage();
  const { setIsPageLoading } = usePageLoading();
  const [servers, setServers] = useState<ServerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerData | null>(null);

  const form = useForm<ServerFormValues>({
    resolver: zodResolver(serverFormSchema),
    defaultValues: {
      name: '',
      ipAddressWithPort: '',
      protocol: 'http',
      remarks: '',
      status: 'online',
      isSystemDefault: false,
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
    form.reset({
      name: '',
      ipAddressWithPort: '',
      protocol: 'http',
      remarks: '',
      status: 'online',
      isSystemDefault: false,
    });
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setEditingServer(null);
  };

  const handleSetSystemDefaultServer = async (serverIdToSetAsDefault: string) => {
    setIsSubmitting(true);
    const batch = writeBatch(db);
    let currentSystemDefaultServerExists = false;

    servers.forEach(server => {
      const serverRef = doc(db, 'servers', server.id);
      if (server.id === serverIdToSetAsDefault) {
        batch.update(serverRef, { isSystemDefault: true });
      } else if (server.isSystemDefault) {
        currentSystemDefaultServerExists = true;
        batch.update(serverRef, { isSystemDefault: false });
      }
    });

    try {
      await batch.commit();
      toast({ title: 'System Default Server Updated', description: 'The system default server has been successfully set.' });
      fetchServers();
    } catch (error) {
      console.error("Error setting system default server: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not set system default server.' });
    }
    setIsSubmitting(false);
  };


  const onSubmitServerForm: SubmitHandler<ServerFormValues> = async (data) => {
    if (!currentUser) {
      toast({ variant: 'destructive', title: 'Error', description: 'User not authenticated.' });
      return;
    }
    setIsSubmitting(true);

    try {
      if (editingServer) {
        const serverRef = doc(db, 'servers', editingServer.id);
        if (data.isSystemDefault) {
          const batch = writeBatch(db);
          servers.forEach(s => {
            if (s.id !== editingServer.id && s.isSystemDefault) {
              const otherServerRef = doc(db, 'servers', s.id);
              batch.update(otherServerRef, { isSystemDefault: false });
            }
          });
          await batch.commit();
        } else {
          const otherDefaultServers = servers.filter(s => s.id !== editingServer.id && s.isSystemDefault);
          if (editingServer.isSystemDefault && !otherDefaultServers.length && servers.length > 1) {
             toast({ variant: 'destructive', title: 'Action Denied', description: 'Cannot unset the only system default server. Set another server as system default first.' });
             setIsSubmitting(false);
             return;
          }
        }
        await updateDoc(serverRef, { ...data, updatedAt: serverTimestamp() });
        toast({ title: 'Server Updated', description: `${data.name} has been updated.` });

      } else {
        const newServerData: Omit<ServerData, 'id' | 'createdAt' | 'createdBy'> & { createdAt: Timestamp, createdBy: string, updatedAt: Timestamp} = {
          ...data,
          createdBy: currentUser.uid,
          createdAt: serverTimestamp() as Timestamp,
          updatedAt: serverTimestamp() as Timestamp,
        };

        if (data.isSystemDefault) {
            const batch = writeBatch(db);
            servers.forEach(s => {
                if (s.isSystemDefault) {
                const otherServerRef = doc(db, 'servers', s.id);
                batch.update(otherServerRef, { isSystemDefault: false });
                }
            });
            await batch.commit();
        } else if (!data.isSystemDefault && servers.length === 0) {
            newServerData.isSystemDefault = true;
        }

        await addDoc(collection(db, 'servers'), newServerData);
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

  const handleEditServer = (server: ServerData) => {
    setEditingServer(server);
    form.reset({
        name: server.name,
        ipAddressWithPort: server.ipAddressWithPort,
        protocol: server.protocol || 'http',
        remarks: server.remarks || '',
        status: server.status,
        isSystemDefault: server.isSystemDefault || false,
    });
    setIsDrawerOpen(true);
  };

  const handleDeleteServer = async (serverId: string) => {
    const serverToDelete = servers.find(s => s.id === serverId);
    if (serverToDelete?.isSystemDefault && servers.filter(s => s.isSystemDefault).length <= 1) {
        toast({ variant: 'destructive', title: 'Action Denied', description: 'Cannot delete the only system default server. Set another server as system default first.' });
        return;
    }
    // Implement actual delete logic here
    toast({title: "Delete Server", description: "Delete functionality not fully implemented yet."});
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
            name="protocol"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Protocol</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select protocol" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="https">HTTPS</SelectItem>
                  </SelectContent>
                </Select>
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
          <FormField
            control={form.control}
            name="isSystemDefault"
            render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
                    <FormControl>
                        <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={editingServer?.isSystemDefault && servers.filter(s => s.isSystemDefault && s.id !== editingServer.id).length === 0 && servers.length > 1 && !field.value}
                        />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                        <FormLabel>
                        Set as System Default Server
                        </FormLabel>
                        <FormDescription>
                        Only one server can be the system default. If checked, any other system default server will be unset.
                        {editingServer?.isSystemDefault && servers.filter(s => s.isSystemDefault && s.id !== editingServer.id).length === 0 && servers.length > 1 && !field.value && " Cannot unset the only system default server." }
                        </FormDescription>
                    </div>
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

  if (!currentUser) {
    return <div className="flex justify-center items-center p-8 h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }


  return (
    <div>
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-lg font-normal text-primary">Manage Servers</CardTitle>
              <CardDescription className="text-xs mt-1 text-muted-foreground">
                View, add, or modify system servers for VSS processing.
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
                      <TableHead>Protocol</TableHead>
                      <TableHead>IP Address:Port</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>System Default</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead className="sticky right-0 bg-card z-10 text-right px-2 sm:px-4 w-[120px] min-w-[120px] border-l border-border">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {servers.map((server) => (
                      <TableRow key={server.id}>
                        <TableCell className="font-medium">{server.name}</TableCell>
                        <TableCell>{server.protocol?.toUpperCase()}</TableCell>
                        <TableCell>{server.ipAddressWithPort}</TableCell>
                        <TableCell>
                          <Badge variant={
                            server.status === 'online' ? 'default' :
                            server.status === 'offline' ? 'destructive' : 'secondary'
                          } className={`${
                            server.status === 'online' ? 'bg-green-500 hover:bg-green-600' :
                            server.status === 'offline' ? '' : ''
                          } text-white`}>
                            {server.status.charAt(0).toUpperCase() + server.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                            {server.isSystemDefault && <CheckCircle className="h-5 w-5 text-green-500" />}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{server.remarks || 'N/A'}</TableCell>
                        <TableCell>{server.createdAt}</TableCell>
                        <TableCell className="sticky right-0 bg-card z-10 text-right px-2 sm:px-4 w-[120px] min-w-[120px] border-l border-border">
                          <div className="flex justify-end items-center space-x-1">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="sm" onClick={() => handleSetSystemDefaultServer(server.id)} disabled={server.isSystemDefault || isSubmitting} className="h-8 text-xs">
                                        {isSubmitting && server.id === editingServer?.id ? <Loader2 className="h-3 w-3 animate-spin"/> : "Set Default"}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Set as System Default Server</p>
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" onClick={() => handleEditServer(server) } className="h-8 w-8">
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit Server</p>
                              </TooltipContent>
                            </Tooltip>
                             <AlertDialog>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="outline" size="icon" className="text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                                     disabled={server.isSystemDefault && servers.filter(s => s.isSystemDefault).length <= 1}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{(server.isSystemDefault && servers.filter(s => s.isSystemDefault).length <= 1) ? "Cannot delete default server" : "Delete Server"}</p>
                                  </TooltipContent>
                                </Tooltip>
                                {!(server.isSystemDefault && servers.filter(s => s.isSystemDefault).length <= 1) && (
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the server: <strong>{server.name}</strong>.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => handleDeleteServer(server.id)}
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

