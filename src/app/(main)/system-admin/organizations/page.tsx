
'use client';

import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/firebase/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Users as UsersIconLucide, Edit, Server } from 'lucide-react'; // Renamed Users to UsersIconLucide
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
        // Fetch user-admin email (assuming first user-admin found)
        let userAdminEmail = 'N/A';
        const usersAdminQuery = query(collection(db, 'users'), where('organizationId', '==', orgDoc.id), where('role', '==', 'user-admin'));
        const usersAdminSnapshot = await getDocs(usersAdminQuery);
        if (!usersAdminSnapshot.empty) {
          userAdminEmail = usersAdminSnapshot.docs[0].data().email;
        }
        
        // Fetch total user count for the organization
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
        } as Organization;
      }));
      setOrganizations(orgsData);
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
      fetchOrganizations(); // Refresh list
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
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
          <CardDescription>View all organizations, approve new ones, and manage their settings.</CardDescription>
        </CardHeader>
        <CardContent>
          {organizations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>User Admin</TableHead>
                  <TableHead className="text-center">Users</TableHead>
                  <TableHead className="text-center">Cameras</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>
                      <Badge variant={org.approved ? 'default' : 'secondary'} className={org.approved ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-yellow-500 hover:bg-yellow-600 text-white'}>
                        {org.approved ? 'Approved' : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell>{org.userAdminEmail}</TableCell>
                    <TableCell className="text-center">
                       <Link href={`/system-admin/organizations/${org.id}/users`} className="text-primary hover:underline">
                        {org.userCount}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">{org.cameraCount}</TableCell>
                    <TableCell>{org.createdAt}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {!org.approved && (
                        <Button variant="outline" size="sm" onClick={() => handleApprove(org.id)} className="text-green-600 border-green-600 hover:bg-green-50">
                          <CheckCircle className="mr-2 h-4 w-4" /> Approve
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleManageIPs(org.id)}>
                         <Server className="mr-2 h-4 w-4" /> Manage IPs
                      </Button>
                       <Button variant="ghost" size="sm" onClick={() => handleManageUsers(org.id)}>
                         <UsersIconLucide className="mr-2 h-4 w-4" /> Manage Users
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
