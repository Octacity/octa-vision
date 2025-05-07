
'use client';

import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/firebase/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Users as UsersIconLucide, Server as ServerIcon, Shield, PlusCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Organization {
  id: string;
  name: string;
  phone?: string;
  description?: string;
  needForOctaVision?: string;
  approved: boolean;
  createdAt: any; // Firestore Timestamp
  userAdminEmail?: string; // To be populated
  userCount?: number; // To be populated
  cameraCount?: number; // To be populated
  admin?: boolean; // Field to indicate if org has admin privileges
}

const AdminOrganizationsPage: NextPage = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  const fetchOrganizations = async () => {
    setLoading(true);
    try {
      const orgsSnapshot = await getDocs(collection(db, 'organizations'));
      const orgsData = await Promise.all(orgsSnapshot.docs.map(async (orgDoc) => {
        const data = orgDoc.data();
        let userAdminEmail = 'N/A';
        const usersAdminQuery = query(collection(db, 'users'), where('organizationId', '==', orgDoc.id), where('role', '==', 'user-admin'));
        const usersAdminSnapshot = await getDocs(usersAdminQuery);
        if (!usersAdminSnapshot.empty) {
          userAdminEmail = usersAdminSnapshot.docs[0].data().email;
        }
        
        const allUsersQuery = query(collection(db, 'users'), where('organizationId', '==', orgDoc.id));
        const allUsersSnapshot = await getDocs(allUsersQuery);
        const userCount = allUsersSnapshot.size; 

        const camerasQuery = query(collection(db, 'cameras'), where('organizationId', '==', orgDoc.id));
        const camerasSnapshot = await getDocs(camerasQuery);
        const cameraCount = camerasSnapshot.size;

        return {
          id: orgDoc.id,
          name: data.name,
          approved: data.approved,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : 'N/A',
          phone: data.phone || 'N/A',
          userAdminEmail,
          userCount,
          cameraCount,
          admin: data.admin === true,
        } as Organization;
      }));
      // Filter out admin organization if not needed to be listed for management
      // setOrganizations(orgsData.filter(org => !org.admin)); 
      setOrganizations(orgsData); // Show all orgs, admin tag will differentiate
    } catch (error) {
      console.error("Error fetching organizations: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch organizations.' });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrganizations();
  }, []); 

  const handleApprove = async (orgId: string) => {
    try {
      await updateDoc(doc(db, 'organizations', orgId), { approved: true });
      toast({ title: 'Success', description: 'Organization approved.' });
      fetchOrganizations(); 
    } catch (error) {
      console.error("Error approving organization: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not approve organization.' });
    }
  };
  
  const handleManageIPs = (orgId: string) => {
    router.push(`/system-admin/organizations/${orgId}/ips`);
  };

  const handleManageUsers = (orgId: string) => {
    router.push(`/system-admin/organizations/${orgId}/users`);
  };

  // Placeholder for adding a new organization - might not be typical from this page
  const handleAddOrganization = () => {
    toast({ title: 'Add Organization', description: 'Functionality to add organization (not typically done here, usually via signup).' });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8 h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row justify-between items-center border-b">
          <div>
            <CardDescription>View all organizations, approve new ones, and manage their settings.</CardDescription>
          </div>
           {/* Example "Add" button, if needed for this context 
           <Button onClick={handleAddOrganization}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Organization
          </Button>
          */}
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {organizations.length > 0 ? (
            <div className="overflow-x-auto">
              <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>User Admin</TableHead>
                    <TableHead className="text-center">Users</TableHead>
                    <TableHead className="text-center">Cameras</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="sticky right-0 bg-muted z-10 text-right px-2 sm:px-4 w-[120px] min-w-[120px] border-l border-border">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2 overflow-x-auto whitespace-nowrap py-1 pr-1 scrollbar-thin">
                          <span>{org.name}</span>
                          {org.admin && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                 <Badge variant="outline" className="ml-2 border-primary text-primary cursor-default">
                                  <Shield className="h-3 w-3 mr-1"/> Admin
                                 </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>This is an administrative organization.</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={org.approved ? 'default' : 'secondary'} className={`${org.approved ? 'bg-green-500 hover:bg-green-600' : 'bg-yellow-500 hover:bg-yellow-600'} text-white`}>
                          {org.approved ? 'Approved' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{org.userAdminEmail}</TableCell>
                      <TableCell className="text-center">
                        <Button variant="link" asChild className="p-0 h-auto">
                          <Link href={`/system-admin/organizations/${org.id}/users`} className="text-primary hover:underline">
                            {org.userCount}
                          </Link>
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">{org.cameraCount}</TableCell>
                      <TableCell className="whitespace-nowrap">{org.createdAt}</TableCell>
                      <TableCell className="sticky right-0 bg-muted z-10 text-right px-2 sm:px-4 w-[120px] min-w-[120px] border-l border-border">
                        <div className="flex justify-end items-center space-x-1">
                          {!org.approved && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" onClick={() => handleApprove(org.id)} className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700 h-8 w-8">
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Approve Organization</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="icon" onClick={() => handleManageIPs(org.id)} className="h-8 w-8">
                                <ServerIcon className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Manage IPs</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="icon" onClick={() => handleManageUsers(org.id)} className="h-8 w-8">
                                <UsersIconLucide className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Manage Users</p>
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
              <p className="text-sm text-muted-foreground">No organizations found.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOrganizationsPage;
