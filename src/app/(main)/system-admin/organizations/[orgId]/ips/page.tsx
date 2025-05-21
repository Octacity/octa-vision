
'use client';

import type { NextPage } from 'next';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, Save, Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePageLoading } from '@/contexts/LoadingContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
import { Label } from '@/components/ui/label';


interface CameraData {
  id: string;
  cameraName: string;
  url: string;
  currentConfigId?: string;
}

interface OrganizationData {
  name: string;
  orgDefaultServerId?: string | null; // Added to hold the ID of the org default server
}

interface ServerInfo {
    id: string;
    name: string;
    ipAddressWithPort: string;
    protocol: 'http' | 'https';
    isSystemDefault?: boolean;
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
  const [selectedServers, setSelectedServers] = useState<Record<string, string | undefined>>({});
  const [selectedBulkAssignServerIp, setSelectedBulkAssignServerIp] = useState<string | undefined>(undefined);
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const [selectedOrgDefaultServerId, setSelectedOrgDefaultServerId] = useState<string | null | undefined>(undefined);
  const [isSettingOrgDefault, setIsSettingOrgDefault] = useState(false);


  const fetchCameraConfig = useCallback(async (cameraId: string, configId?: string): Promise<CameraConfig | null> => {
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

  const fetchAllData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const orgDocRef = doc(db, 'organizations', orgId);
      const orgDocSnap = await getDoc(orgDocRef);
      if (!orgDocSnap.exists()) {
        toast({ variant: 'destructive', title: 'Error', description: 'Organization not found.' });
        setIsPageLoading(true);
        router.push('/system-admin/organizations');
        return;
      }
      const orgData = orgDocSnap.data() as OrganizationData;
      setOrganization(orgData);
      setSelectedOrgDefaultServerId(orgData.orgDefaultServerId || null);


      const serversQuery = query(collection(db, 'servers'));
      const serversSnapshot = await getDocs(serversQuery);
      const fetchedServers = serversSnapshot.docs.map(docSnapshot => ({
        id: docSnapshot.id,
        name: docSnapshot.data().name || 'Unnamed Server',
        ipAddressWithPort: docSnapshot.data().ipAddressWithPort,
        protocol: docSnapshot.data().protocol || 'http',
        isSystemDefault: docSnapshot.data().isSystemDefault || false,
      } as ServerInfo));
      setServers(fetchedServers);

      const camerasQuery = query(collection(db, 'cameras'), where('orgId', '==', orgId));
      const camerasSnapshot = await getDocs(camerasQuery);
      const fetchedCameras = camerasSnapshot.docs.map(docSnapshot => ({
        id: docSnapshot.id,
        cameraName: docSnapshot.data().cameraName || 'Unnamed Camera',
        url: docSnapshot.data().url || 'N/A',
        currentConfigId: docSnapshot.data().currentConfigId,
      } as CameraData));
      setCameras(fetchedCameras);

      const configs: Record<string, CameraConfig> = {};
      const initialSelected: Record<string, string | undefined> = {};
      for (const cam of fetchedCameras) {
        if (cam.currentConfigId) {
          const config = await fetchCameraConfig(cam.id, cam.currentConfigId);
          if (config) {
            configs[cam.id] = config;
            initialSelected[cam.id] = config.serverIpAddress || undefined;
          } else {
            initialSelected[cam.id] = undefined;
          }
        } else {
          initialSelected[cam.id] = undefined;
        }
      }
      setCameraConfigs(configs);
      setSelectedServers(initialSelected);

    } catch (error) {
      console.error("Error fetching data: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch organization, camera, or server data.' });
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, toast, router, fetchCameraConfig]);


  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);


  const handleAssignServer = async (cameraId: string) => {
    const camera = cameras.find(c => c.id === cameraId);
    const selectedServerIpOrNone = selectedServers[cameraId];

    if (!camera) {
      toast({ variant: 'destructive', title: 'Error', description: 'Camera not found.' });
      return;
    }
    if (!camera.currentConfigId) {
      toast({
        variant: 'destructive',
        title: 'Configuration Missing',
        description: `Camera ${camera.cameraName} does not have an active configuration ID. Please check camera setup.`
      });
      return;
    }
    
    const serverInfo = servers.find(s => s.id === selectedServerIpOrNone); // Assuming selectedServerIpOrNone is serverId for this logic
    const serverIpToSave = serverInfo ? `${serverInfo.protocol}://${serverInfo.ipAddressWithPort}` : (selectedServerIpOrNone === "__SELECT_NONE__" ? null : selectedServerIpOrNone);


    setIsPageLoading(true);
    try {
      const configDocRef = doc(db, 'configurations', camera.currentConfigId);
      await updateDoc(configDocRef, { serverIpAddress: serverIpToSave }); // Save full URL or null
      toast({ title: 'Server Assigned', description: `Server assignment updated for ${camera.cameraName}.` });

      const updatedConfig = await fetchCameraConfig(cameraId, camera.currentConfigId);
      if(updatedConfig) {
        setCameraConfigs(prev => ({ ...prev, [cameraId]: updatedConfig }));
        setSelectedServers(prev => ({...prev, [cameraId]: serverInfo?.id || (selectedServerIpOrNone === "__SELECT_NONE__" ? "__SELECT_NONE__" : undefined)}));
      }
    } catch (error) {
      console.error("Error assigning server: ", error);
      toast({ variant: 'destructive', title: 'Error assigning server', description: (error as Error).message });
    }
    setIsPageLoading(false);
  };

  const handleServerSelectionChange = (cameraId: string, serverIdOrNone: string) => {
    setSelectedServers(prev => ({
      ...prev,
      [cameraId]: serverIdOrNone
    }));
  };

  const handleBulkAssignServerToOrgCameras = async () => {
    if (!selectedBulkAssignServerIp || selectedBulkAssignServerIp === "__SELECT_NONE__") {
        toast({ variant: "destructive", title: "No Server Selected", description: "Please select a server to assign to all cameras." });
        return;
    }
    if (cameras.length === 0) {
        toast({ variant: "default", title: "No Cameras", description: "There are no cameras in this organization to assign." });
        return;
    }

    setIsBulkAssigning(true);
    const batch = writeBatch(db);
    let updatesMade = 0;
    
    const serverToBulkAssign = servers.find(s => s.id === selectedBulkAssignServerIp);
    if (!serverToBulkAssign) {
        toast({ variant: "destructive", title: "Server Not Found", description: "Selected server for bulk assignment not found." });
        setIsBulkAssigning(false);
        return;
    }
    const serverUrlToBulkSave = `${serverToBulkAssign.protocol}://${serverToBulkAssign.ipAddressWithPort}`;


    cameras.forEach(camera => {
        if (camera.currentConfigId) {
            const configDocRef = doc(db, 'configurations', camera.currentConfigId);
            batch.update(configDocRef, { serverIpAddress: serverUrlToBulkSave });
            updatesMade++;
        }
    });

    if (updatesMade === 0) {
        toast({ variant: "default", title: "No Configurations", description: "No cameras with valid configurations to update." });
        setIsBulkAssigning(false);
        return;
    }

    try {
        await batch.commit();
        toast({ title: "Bulk Assignment Successful", description: `Assigned server to ${updatesMade} camera(s). Refreshing data...`});
        await fetchAllData(); 
    } catch (error) {
        console.error("Error during bulk server assignment: ", error);
        toast({ variant: "destructive", title: "Bulk Assignment Failed", description: "Could not assign server to all cameras." });
    }
    setIsBulkAssigning(false);
    setSelectedBulkAssignServerIp(undefined); 
  };

  const handleSetOrgDefaultServer = async () => {
    if (!orgId) return;
    setIsSettingOrgDefault(true);
    try {
        const orgDocRef = doc(db, 'organizations', orgId);
        await updateDoc(orgDocRef, {
            orgDefaultServerId: selectedOrgDefaultServerId === "__SELECT_NONE__" ? null : selectedOrgDefaultServerId
        });
        setOrganization(prev => prev ? {...prev, orgDefaultServerId: selectedOrgDefaultServerId === "__SELECT_NONE__" ? null : selectedOrgDefaultServerId} : null);
        toast({ title: "Organization Default Server Updated", description: `Successfully set the default server for ${organization?.name}.`});
    } catch (error) {
        console.error("Error setting organization default server: ", error);
        toast({ variant: "destructive", title: "Update Failed", description: "Could not update the organization's default server."});
    }
    setIsSettingOrgDefault(false);
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
  
  const currentOrgDefaultServerName = servers.find(s => s.id === organization.orgDefaultServerId)?.name || "None";

  return (
    <div>
      <Button variant="outline" onClick={() => {setIsPageLoading(true); router.push('/system-admin/organizations');}} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Organizations
      </Button>

      <Card className="mb-6">
        <CardHeader>
            <CardTitle className="text-base font-normal text-primary">Set Organization Default Server</CardTitle>
            <CardDescription className="text-xs">
                Choose a default server for <strong>{organization.name}</strong>. New cameras added to this organization will attempt to use this server first.
                <br />
                Current Organization Default: <strong className="text-foreground">{currentOrgDefaultServerName}</strong>
            </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-grow w-full sm:w-auto">
                <Label htmlFor="org-default-server-select" className="text-xs font-medium text-muted-foreground mb-1 block">Select Server</Label>
                <Select
                    value={selectedOrgDefaultServerId ?? "__SELECT_NONE__"}
                    onValueChange={(value) => setSelectedOrgDefaultServerId(value)}
                >
                    <SelectTrigger id="org-default-server-select" className="w-full">
                        <SelectValue placeholder="Select a server..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__SELECT_NONE__">None (Use System Default)</SelectItem>
                        {servers
                        .filter(server => server.ipAddressWithPort && server.ipAddressWithPort.trim() !== "")
                        .map((server) => (
                        <SelectItem key={`org-default-${server.id}`} value={server.id}>
                            {server.name} ({server.protocol}://{server.ipAddressWithPort})
                            {server.isSystemDefault && <Badge variant="outline" className="ml-2 text-xs">System Default</Badge>}
                        </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <Button 
                onClick={handleSetOrgDefaultServer}
                disabled={isSettingOrgDefault || selectedOrgDefaultServerId === (organization.orgDefaultServerId || null) || selectedOrgDefaultServerId === undefined}
                className="w-full sm:w-auto"
            >
                {isSettingOrgDefault ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings2 className="mr-2 h-4 w-4" />}
                Set as Organization Default
            </Button>
        </CardContent>
      </Card>


      <Card className="mb-6">
        <CardHeader>
            <CardTitle className="text-base font-normal text-primary">Bulk Assign Server to All Cameras</CardTitle>
            <CardDescription className="text-xs">
                Assign a single server to all cameras within <strong>{organization.name}</strong>. This will override individual assignments.
            </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-end gap-4">
             <div className="flex-grow w-full sm:w-auto">
                <Label htmlFor="bulk-assign-server-select" className="text-xs font-medium text-muted-foreground mb-1 block">Select Server</Label>
                <Select
                    value={selectedBulkAssignServerIp ?? "__SELECT_NONE__"}
                    onValueChange={(value) => setSelectedBulkAssignServerIp(value)}
                >
                    <SelectTrigger id="bulk-assign-server-select" className="w-full">
                        <SelectValue placeholder="Select a server for bulk assignment" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__SELECT_NONE__">Select a server...</SelectItem>
                        {servers
                        .filter(server => server.ipAddressWithPort && server.ipAddressWithPort.trim() !== "")
                        .map((server) => (
                        <SelectItem key={`bulk-${server.id}`} value={server.id}>
                            {server.name} ({server.protocol}://{server.ipAddressWithPort})
                            {server.isSystemDefault && <Badge variant="outline" className="ml-2 text-xs">System Default</Badge>}
                        </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
             <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button 
                        disabled={isBulkAssigning || !selectedBulkAssignServerIp || selectedBulkAssignServerIp === "__SELECT_NONE__"}
                        className="w-full sm:w-auto"
                    >
                        {isBulkAssigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Assign to All Cameras
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Bulk Assignment</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to assign server "{servers.find(s => s.id === selectedBulkAssignServerIp)?.name || selectedBulkAssignServerIp}" to all cameras in {organization.name}? This will overwrite existing individual assignments.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel disabled={isBulkAssigning}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkAssignServerToOrgCameras} disabled={isBulkAssigning}>
                        {isBulkAssigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Confirm Assignment
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </CardContent>
      </Card>


      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-lg font-normal text-primary">Individual Camera Server Assignments</CardTitle>
          <CardDescription className="text-xs mt-1 text-muted-foreground">
            Manage server assignments for individual cameras in <strong className="text-foreground">{organization.name}</strong>.
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
                    {cameras.map((camera) => {
                      const currentServerIp = cameraConfigs[camera.id]?.serverIpAddress;
                      const assignedServerInfo = servers.find(s => `${s.protocol}://${s.ipAddressWithPort}` === currentServerIp);
                      const selectedValueForDropdown = assignedServerInfo?.id || (currentServerIp === null ? "__SELECT_NONE__" : undefined);
                      
                      return (
                      <TableRow key={camera.id}>
                        <TableCell className="font-medium">{camera.cameraName}</TableCell>
                        <TableCell className="truncate max-w-xs">{camera.url}</TableCell>
                        <TableCell>
                          {servers.length > 0 ? (
                            <Select
                              value={selectedServers[camera.id] ?? selectedValueForDropdown ?? "__SELECT_NONE__"}
                              onValueChange={(value) => handleServerSelectionChange(camera.id, value)}
                            >
                              <SelectTrigger className="w-[280px]">
                                <SelectValue placeholder="Select a server" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__SELECT_NONE__">None</SelectItem>
                                {servers
                                  .filter(server => server.ipAddressWithPort && server.ipAddressWithPort.trim() !== "")
                                  .map((server) => (
                                  <SelectItem key={server.id} value={server.id}>
                                    {server.name} ({server.protocol}://{server.ipAddressWithPort})
                                    {server.isSystemDefault && <Badge variant="outline" className="ml-2 text-xs">System Default</Badge>}
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
                                disabled={
                                  selectedServers[camera.id] === undefined || // Nothing selected yet in this session for this camera
                                  selectedServers[camera.id] === selectedValueForDropdown || // Selection matches current assignment
                                  (selectedServers[camera.id] === "__SELECT_NONE__" && selectedValueForDropdown === "__SELECT_NONE__") // Both are 'None'
                                }
                                className="h-8 text-xs"
                              >
                                Update
                              </Button>
                           </div>
                        </TableCell>
                      </TableRow>
                    )})}
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

    