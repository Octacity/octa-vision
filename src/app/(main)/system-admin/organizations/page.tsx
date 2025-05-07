
'use client';

import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/firebase/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Users, Camera, Edit } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

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

  const fetchOrganizations = async () => {
    setLoading(true);
    try {
      const orgsSnapshot = await getDocs(collection(db, 'organizations'));
      const orgsData = await Promise.all(orgsSnapshot.docs.map(async (orgDoc) => {
        const data = orgDoc.data();
        // Fetch user-admin email (assuming first user-admin found)
        // This is a simplified approach; a more robust solution might be needed
        let userAdminEmail = 'N/A';
        const usersQuery = query(collection(db, 'users'), where('organizationId', '==', orgDoc.id), where('role', '==', 'user-admin'));
        const usersSnapshot = await getDocs(usersQuery);
        if (!usersSnapshot.empty) {
          userAdminEmail = usersSnapshot.docs[0].data().email;
        }
        
        // Placeholder for user count and camera count
        const userCount = usersSnapshot.size; // Counts all users in org for now
        const cameraCount = 0; // Placeholder

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

  const handleReject = async (orgId: string) => {
    // For now, just shows a toast. Implement actual rejection logic if needed (e.g., mark as rejected, delete)
    console.log(`Rejecting organization: ${orgId}`);
    toast({ title: 'Action Required', description: 'Reject functionality to be implemented.' });
  };
  
  const handleManageIPs = (orgId: string) => {
    toast({ title: 'Feature Coming Soon', description: `Manage IPs for ${orgId} will be available soon.`});
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Manage Organizations</CardTitle>
          <CardDescription>Approve, view, and manage registered organizations.</CardDescription>
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
                      <Badge variant={org.approved ? 'default' : 'secondary'} className={org.approved ? 'bg-green-500 hover:bg-green-600' : 'bg-yellow-500 hover:bg-yellow-600'}>
                        {org.approved ? 'Approved' : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell>{org.userAdminEmail}</TableCell>
                    <TableCell className="text-center">{org.userCount}</TableCell>
                    <TableCell className="text-center">{org.cameraCount}</TableCell>
                    <TableCell>{org.createdAt}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {!org.approved && (
                        <Button variant="outline" size="sm" onClick={() => handleApprove(org.id)} className="text-green-600 border-green-600 hover:bg-green-50">
                          <CheckCircle className="mr-2 h-4 w-4" /> Approve
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleManageIPs(org.id)}>
                         <Edit className="mr-2 h-4 w-4" /> Manage IPs
                      </Button>
                      {/* Add Reject button or other actions if needed */}
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
