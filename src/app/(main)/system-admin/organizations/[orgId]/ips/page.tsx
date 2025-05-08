
'use client';

import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, Edit3, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CameraData {
  id: string;
  name: string;
  rtspUrl: string;
}

interface OrganizationData {
  name: string;
}

const ManageOrganizationIPsPage: NextPage = () => {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const orgId = params.orgId as string;

  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [cameras, setCameras] = useState<CameraData[]>([]);
  const [loading, setLoading] = useState(true);

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

        const camerasQuery = query(collection(db, 'cameras'), where('organizationId', '==', orgId));
        const camerasSnapshot = await getDocs(camerasQuery);
        const camerasData = camerasSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().cameraName, // Ensure field name matches Firestore
          rtspUrl: doc.data().rtspUrl, // Ensure field name matches Firestore
          ...doc.data(),
        })) as CameraData[];
        setCameras(camerasData);

      } catch (error) {
        console.error("Error fetching data: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch organization or camera data.' });
      }
      setLoading(false);
    };

    fetchData();
  }, [orgId, toast, router]);

  const handleEditIp = (cameraId: string) => {
    toast({ title: 'Edit IP', description: `Editing IP for camera ${cameraId} (not implemented).` });
  };

  const handleAddIp = () => {
    toast({ title: 'Add IP', description: 'Adding new camera IP (not implemented).' });
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
      <Button variant="outline" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Organizations
      </Button>
      <Card>
        <CardHeader className="flex flex-row justify-between items-center border-b">
          <div>
            <CardDescription className="text-xs">
              View and manage camera RTSP URLs for <strong className="text-foreground">{organization.name}</strong>.
            </CardDescription>
          </div>
          <Button onClick={handleAddIp}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add IP / Camera
          </Button>
        </CardHeader>
        <CardContent className="p-0"> {/* Removed sm:p-6 sm:pt-0 */}
          {cameras.length > 0 ? (
            <div className="overflow-x-auto">
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Camera Name</TableHead>
                      <TableHead>RTSP URL / IP Address</TableHead>
                      <TableHead className="sticky right-0 bg-muted z-10 text-right px-2 sm:px-4 w-[90px] min-w-[90px] border-l border-border">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cameras.map((camera) => (
                      <TableRow key={camera.id}>
                        <TableCell className="font-medium">{camera.name || 'Unnamed Camera'}</TableCell>
                        <TableCell>{camera.rtspUrl || 'N/A'}</TableCell>
                        <TableCell className="sticky right-0 bg-muted z-10 text-right px-2 sm:px-4 w-[90px] min-w-[90px] border-l border-border">
                           <div className="flex justify-end items-center space-x-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="outline" size="icon" onClick={() => handleEditIp(camera.id)} className="h-8 w-8">
                                    <Edit3 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Edit IP</p>
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
              <p className="text-sm text-muted-foreground">No cameras found for this organization.</p>
              <p className="text-xs text-muted-foreground mt-1">Ensure cameras are added and associated with this organization ID: {orgId}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ManageOrganizationIPsPage;

