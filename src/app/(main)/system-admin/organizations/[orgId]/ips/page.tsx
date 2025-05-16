
'use client';

import type { NextPage } from 'next';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePageLoading } from '@/contexts/LoadingContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CameraData {
  id: string;
  cameraName: string;
  url: string;
  currentConfigId?: string;
}

interface OrganizationData {
  name: string;
}

interface ServerInfo {
    id: string;
    name: string;
    ipAddressWithPort: string;
}

interface CameraConfig {
    serverIpAddress?: string | null;
}

const AssignServersToCamerasPage: NextPage = () => {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const orgId = params.orgId as string;
  const { setIsPageLoading } = usePageLoading();

  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [cameras, setCameras] = useState<CameraData[]>([]);
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [cameraConfigs, setCameraConfigs] = useState<Record<string, CameraConfig>>({});
  const [loading, setLoading] = useState(true);
  const [selectedServers, setSelectedServers] = useState<Record<string, string>>({});


  const fetchCameraConfig = useCallback(async (cameraId: string, configId?: string) => {
    if (!configId) return null;
    try {
      const configDocRef = doc(db, 'configurations', configId);
      const configDocSnap = await getDoc(configDocRef);
      if (configDocSnap.exists()) {
        return configDocSnap.data() as CameraConfig;
      }
    } catch (error) {
      console.error(`Error fetching config for camera ${cameraId}:`, error);
    }
    return null;
  }, []);

  useEffect(() => {
    if (!orgId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch Organization
        const orgDocRef = doc(db, 'organizations', orgId);
        const orgDocSnap = await getDoc(orgDocRef);
        if (!orgDocSnap.exists()) {
          toast({ variant: 'destructive', title: 'Error', description: 'Organization not found.' });
          setIsPageLoading(true);
          router.push('/system-admin/organizations');
          return;
        }
        setOrganization(orgDocSnap.data() as OrganizationData);

        // Fetch Servers
        const serversQuery = query(collection(db, 'servers'));
        const serversSnapshot = await getDocs(serversQuery);
        const fetchedServers = serversSnapshot.docs.map(docSnapshot => ({
          id: docSnapshot.id,
          name: docSnapshot.data().name,
          ipAddressWithPort: docSnapshot.data().ipAddressWithPort,
        } as ServerInfo));
        setServers(fetchedServers);

        // Fetch Cameras
        const camerasQuery = query(collection(db, 'cameras'), where('orgId', '==', orgId));
        const camerasSnapshot = await getDocs(camerasQuery);
        const fetchedCameras = camerasSnapshot.docs.map(docSnapshot => ({
          id: docSnapshot.id,
          cameraName: docSnapshot.data().cameraName || 'Unnamed Camera',
          url: docSnapshot.data().url || 'N/A',
          currentConfigId: docSnapshot.data().currentConfigId,
        } as CameraData));
        setCameras(fetchedCameras);

        // Fetch configurations for these cameras
        const configs: Record<string, CameraConfig> = {};
        const initialSelectedServers: Record<string, string> = {};
        for (const cam of fetchedCameras) {
          if (cam.currentConfigId) {
            const config = await fetchCameraConfig(cam.id, cam.currentConfigId);
            if (config) {
              configs[cam.id] = config;
              if (config.serverIpAddress) {
                initialSelectedServers[cam.id] = config.serverIpAddress;
              }
            }
          }
        }
        setCameraConfigs(configs);
        setSelectedServers(initialSelectedServers);

      } catch (error) {
        console.error("Error fetching data: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch organization, camera, or server data.' });
      }
      setLoading(false);
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, toast, router, fetchCameraConfig]);

  const handleAssignServer = async (cameraId: string) => {
    const camera = cameras.find(c => c.id === cameraId);
    const selectedServerIp = selectedServers[cameraId];

    if (!camera || !camera.currentConfigId || selectedServerIp === undefined) {
      toast({ variant: 'destructive', title: 'Error', description: 'Missing camera configuration or server selection.' });
      return;
    }

    setIsPageLoading(true);
    try {
      const configDocRef = doc(db, 'configurations', camera.currentConfigId);
      await updateDoc(configDocRef, { serverIpAddress: selectedServerIp || null }); // Store null if "None" is selected
      toast({ title: 'Server Assigned', description: `Server assignment updated for ${camera.cameraName}.` });
      // Refresh local config state
      const updatedConfig = await fetchCameraConfig(cameraId, camera.currentConfigId);
      if(updatedConfig) {
        setCameraConfigs(prev => ({ ...prev, [cameraId]: updatedConfig }));
      }
    } catch (error) {
      console.error("Error assigning server: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update server assignment.' });
    }
    setIsPageLoading(false);
  };
  
  const handleServerSelectionChange = (cameraId: string, serverIp: string) => {
    setSelectedServers(prev => ({ ...prev, [cameraId]: serverIp }));
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
      <Button variant="outline" onClick={() => {setIsPageLoading(true); router.push('/system-admin/organizations');}} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Organizations
      </Button>
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-lg font-normal text-primary">Assign Servers to Cameras</CardTitle>
          <CardDescription className="text-xs mt-1 text-muted-foreground">
            Manage server assignments for cameras in <strong className="text-foreground">{organization.name}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0"> 
          {cameras.length > 0 ? (
            <div className="overflow-x-auto">
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Camera Name</TableHead>
                      <TableHead>RTSP URL</TableHead>
                      <TableHead>Assigned Server</TableHead>
                      <TableHead className="sticky right-0 bg-card z-10 text-right px-2 sm:px-4 w-[90px] min-w-[90px] border-l border-border">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cameras.map((camera) => (
                      <TableRow key={camera.id}>
                        <TableCell className="font-medium">{camera.cameraName}</TableCell>
                        <TableCell className="truncate max-w-xs">{camera.url}</TableCell>
                        <TableCell>
                          {servers.length > 0 ? (
                            <Select
                              value={selectedServers[camera.id] || ""}
                              onValueChange={(value) => handleServerSelectionChange(camera.id, value)}
                            >
                              <SelectTrigger className="w-[280px]">
                                <SelectValue placeholder="Select a server" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">None</SelectItem>
                                {servers.map((server) => (
                                  <SelectItem key={server.id} value={server.ipAddressWithPort}>
                                    {server.name} ({server.ipAddressWithPort})
                                    {server.isDefault && <Badge variant="outline" className="ml-2 text-xs">Default</Badge>}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-xs text-muted-foreground">No servers available. Add servers first.</p>
                          )}
                        </TableCell>
                        <TableCell className="sticky right-0 bg-card z-10 text-right px-2 sm:px-4 w-[90px] min-w-[90px] border-l border-border">
                           <div className="flex justify-end items-center space-x-1">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleAssignServer(camera.id)}
                                disabled={selectedServers[camera.id] === undefined || selectedServers[camera.id] === (cameraConfigs[camera.id]?.serverIpAddress || "")}
                                className="h-8 text-xs"
                              >
                                Update
                              </Button>
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AssignServersToCamerasPage;

