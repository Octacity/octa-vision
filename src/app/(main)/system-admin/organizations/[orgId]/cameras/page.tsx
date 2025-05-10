
'use client';

import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'; 
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, Edit3, PlusCircle, Settings, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';


interface CameraData {
  id: string;
  cameraName: string;
  url: string;
  processingStatus: string;
  // Add other relevant camera fields you want to display
}

interface OrganizationData {
  name: string;
}

const ManageOrganizationCamerasPage: NextPage = () => {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const orgId = params.orgId as string;
  const { translate } = useLanguage();

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

        const camerasQuery = query(collection(db, 'cameras'), where('orgId', '==', orgId));
        const camerasSnapshot = await getDocs(camerasQuery);
        const camerasData = camerasSnapshot.docs.map(docSnapshot => ({ 
          id: docSnapshot.id, 
          cameraName: docSnapshot.data().cameraName,
          url: docSnapshot.data().url,
          processingStatus: docSnapshot.data().processingStatus || 'unknown',
          ...docSnapshot.data(),
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

  const handleEditCamera = (cameraId: string) => {
    // Navigate to a camera edit page or open a modal
    toast({ title: 'Edit Camera', description: `Editing camera ${cameraId} (not implemented).` });
  };

  const handleAddCamera = () => {
    // Navigate to an add camera page or open a modal, pre-filling orgId
    toast({ title: 'Add Camera', description: `Adding new camera for this organization (not implemented).` });
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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'running_normal':
        return 'default'; // Or a success-like variant
      case 'waiting_for_approval':
      case 'pending_setup':
        return 'secondary'; // Or a warning-like variant
      case 'failed':
      case 'something_failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };


  return (
    <div>
      <Button variant="outline" onClick={() => router.push('/system-admin/organizations')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Organizations
      </Button>
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-row justify-between items-center">
            <div>
              <CardTitle className="text-base">Manage Cameras</CardTitle>
              <CardDescription className="text-xs mt-1">
                {translate('manageOrgCameras.description', { orgName: organization.name })}
              </CardDescription>
            </div>
            <Button onClick={handleAddCamera} disabled>
              <PlusCircle className="mr-2 h-4 w-4" /> {translate('manageOrgCameras.addCamera')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {cameras.length > 0 ? (
            <div className="overflow-x-auto">
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{translate('manageOrgCameras.cameraName')}</TableHead>
                      <TableHead>{translate('manageOrgCameras.rtspUrl')}</TableHead>
                      <TableHead>{translate('manageOrgCameras.status')}</TableHead>
                      <TableHead className="sticky right-0 bg-muted z-10 text-right px-2 sm:px-4 w-[90px] min-w-[90px] border-l border-border">{translate('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cameras.map((camera) => (
                      <TableRow key={camera.id}>
                        <TableCell className="font-medium">{camera.cameraName || 'Unnamed Camera'}</TableCell>
                        <TableCell>{camera.url || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(camera.processingStatus)}>
                            {translate(`cameraStatus.${camera.processingStatus}`, {}, camera.processingStatus)}
                          </Badge>
                        </TableCell>
                        <TableCell className="sticky right-0 bg-muted z-10 text-right px-2 sm:px-4 w-[90px] min-w-[90px] border-l border-border">
                           <div className="flex justify-end items-center space-x-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="outline" size="icon" onClick={() => handleEditCamera(camera.id)} className="h-8 w-8" disabled>
                                    <Settings className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{translate('manageOrgCameras.editConfig')}</p>
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
              <p className="text-sm text-muted-foreground">{translate('manageOrgCameras.noCameras')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ManageOrganizationCamerasPage;
