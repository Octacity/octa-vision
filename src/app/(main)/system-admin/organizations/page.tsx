
'use client';

import type { NextPage } from 'next';
import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/firebase/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Users as UsersIconLucide, Server as ServerIcon, Shield, PlusCircle, ArrowUpDown, Search, Camera as CameraIcon } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';


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

type SortField = 'name' | 'status' | 'createdAt';
type SortDirection = 'asc' | 'desc';

const AdminOrganizationsPage: NextPage = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();
  const { translate } = useLanguage();

  const [filterText, setFilterText] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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

        const camerasQuery = query(collection(db, 'cameras'), where('orgId', '==', orgDoc.id)); // Corrected field to orgId
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
      setOrganizations(orgsData.filter(org => !org.admin)); // Filter out admin organizations
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
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedOrganizations = useMemo(() => {
    let filtered = organizations.filter(org => 
      org.name.toLowerCase().includes(filterText.toLowerCase()) ||
      (org.userAdminEmail && org.userAdminEmail.toLowerCase().includes(filterText.toLowerCase()))
    );

    if (sortField) {
      filtered.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (sortField === 'status') {
          valA = a.approved;
          valB = b.approved;
        }
        
        if (sortField === 'createdAt') {
            const dateA = a.createdAt && a.createdAt !== 'N/A' ? new Date(a.createdAt) : new Date(0);
            const dateB = b.createdAt && b.createdAt !== 'N/A' ? new Date(b.createdAt) : new Date(0);
            valA = dateA.getTime();
            valB = dateB.getTime();
        }


        if (typeof valA === 'string' && typeof valB === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [organizations, filterText, sortField, sortDirection]);


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
        <CardHeader className="border-b p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>{translate('allOrganizationsTitle')}</CardTitle>
              <CardDescription>View all organizations, approve new ones, and manage their settings.</CardDescription>
            </div>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Filter by name or admin email..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="pl-8 pr-4 py-2 h-9 w-full sm:w-[250px] text-sm rounded-md border"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredAndSortedOrganizations.length > 0 ? (
            <div className="overflow-x-auto">
              <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                       <Button variant="ghost" onClick={() => handleSort('name')} className="px-1 py-0.5 h-auto hover:bg-muted/50">
                        Name <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" onClick={() => handleSort('status')} className="px-1 py-0.5 h-auto hover:bg-muted/50">
                        Status <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>User Admin</TableHead>
                    <TableHead className="text-center">Users</TableHead>
                    <TableHead className="text-center">Cameras</TableHead>
                    <TableHead>
                      <Button variant="ghost" onClick={() => handleSort('createdAt')} className="px-1 py-0.5 h-auto hover:bg-muted/50">
                        Requested <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="sticky right-0 bg-muted z-10 text-right px-2 sm:px-4 w-[130px] min-w-[130px] border-l border-border">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedOrganizations.map((org) => (
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
                      <TableCell className="sticky right-0 bg-muted z-10 text-right px-2 sm:px-4 w-[130px] min-w-[130px] border-l border-border">
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
                              <Button variant="outline" size="icon" onClick={() => router.push(`/system-admin/organizations/${org.id}/cameras`)} className="h-8 w-8">
                                <CameraIcon className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Manage Cameras</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="icon" onClick={() => router.push(`/system-admin/organizations/${org.id}/ips`)} className="h-8 w-8">
                                <ServerIcon className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Manage IPs</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="icon" onClick={() => router.push(`/system-admin/organizations/${org.id}/users`)} className="h-8 w-8">
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
              <p className="text-sm text-muted-foreground">No organizations found matching your criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOrganizationsPage;
