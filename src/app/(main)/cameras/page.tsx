
'use client';

import type { NextPage } from 'next';
import Image from 'next/image';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, addDoc, collection, serverTimestamp, writeBatch, arrayUnion, updateDoc, Timestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/firebase/firebase';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, Clock, AlertTriangle, Bell, MessageSquare, Plus, Users, ListFilter, ArrowUpDown, MoreHorizontal, Video, Edit3, Folder, HelpCircle, ShieldAlert, Settings2, ArrowDown, Wand2, Mic, Loader2, Film, BarChart, CalendarDays, AlertCircle as AlertCircleIconLucide, Diamond, Bot, Send, Camera as CameraIconLucide, Server, Sparkles } from 'lucide-react';
import RightDrawer from '@/components/RightDrawer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useNotificationDrawer } from '@/contexts/NotificationDrawerContext';
import { useToast } from '@/hooks/use-toast';
import { generateGroupAlertEvents } from '@/ai/flows/generate-group-alert-events';
import { useLanguage } from '@/contexts/LanguageContext';


export interface Camera {
  id: string;
  cameraName: string;
  imageUrl: string; 
  dataAiHint: string;
  processingStatus?: string;
  resolution?: string; 
}

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: Date;
  avatar?: string;
}

export interface Group {
  id: string;
  name: string;
  cameras?: string[];
  videos?: string[];
  defaultCameraSceneContext?: string | null;
  defaultAiDetectionTarget?: string | null;
  defaultAlertEvents?: string[] | null;
  defaultVideoChunks?: { value: number; unit: 'seconds' | 'minutes' } | null;
  defaultNumFrames?: number | null;
  defaultVideoOverlap?: { value: number; unit: 'seconds' | 'minutes' } | null;
  orgId?: string;
  userId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}


const addCameraStep1Schema = z.object({
  rtspUrl: z.string().url({ message: "Invalid RTSP URL format." }).min(1, "RTSP URL is required."),
  cameraName: z.string().min(1, "Camera name is required."),
  group: z.string().optional(),
  newGroupName: z.string().optional(),
  groupDefaultCameraSceneContext: z.string().optional(),
  groupDefaultAiDetectionTarget: z.string().optional(),
  groupDefaultAlertEvents: z.string().optional(),
  groupDefaultVideoChunksValue: z.string().optional().refine(val => val === undefined || val === '' || !isNaN(parseFloat(val)), {message: "Must be a number"}),
  groupDefaultVideoChunksUnit: z.enum(['seconds', 'minutes']).optional(),
  groupDefaultNumFrames: z.string().optional().refine(val => val === undefined || val === '' || !isNaN(parseFloat(val)), {message: "Must be a number"}),
  groupDefaultVideoOverlapValue: z.string().optional().refine(val => val === undefined || val === '' || !isNaN(parseFloat(val)), {message: "Must be a number"}),
  groupDefaultVideoOverlapUnit: z.enum(['seconds', 'minutes']).optional(),
}).refine(data => {
  if (data.group === 'add_new_group' && !data.newGroupName) {
    return false;
  }
  return true;
}, {
  message: "New group name is required when adding a new group.",
  path: ["newGroupName"],
});

type AddCameraStep1Values = z.infer<typeof addCameraStep1Schema>;

const addCameraStep2Schema = z.object({
    sceneDescription: z.string().min(1, "Scene description is required."),
});
type AddCameraStep2Values = z.infer<typeof addCameraStep2Schema>;

const addCameraStep3Schema = z.object({
    cameraSceneContext: z.string().min(1, "This field is required."),
    aiDetectionTarget: z.string().min(1, "AI detection target is required."),
    alertEvents: z.string().min(1, "Alert events are required."),
    videoChunksValue: z.string().min(1, "Video chunks value is required.").refine(val => !isNaN(parseFloat(val)), {message: "Must be a number"}),
    videoChunksUnit: z.enum(['seconds', 'minutes']).default('seconds'),
    numFrames: z.string().min(1, "Number of frames is required.").refine(val => !isNaN(parseFloat(val)), {message: "Must be a number"}),
    videoOverlapValue: z.string().min(1, "Video overlap value is required.").refine(val => !isNaN(parseFloat(val)), {message: "Must be a number"}),
    videoOverlapUnit: z.enum(['seconds', 'minutes']).default('seconds'),
});
type AddCameraStep3Values = z.infer<typeof addCameraStep3Schema>;


const CamerasPage: NextPage = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<'addCamera' | 'chatCamera' | null>(null);
  const [drawerStep, setDrawerStep] = useState(1);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);
  const [showNewGroupForm, setShowNewGroupForm] = useState(false);
  const [isProcessingStep2, setIsProcessingStep2] = useState(false);
  
  const [snapshotGcsUrl, setSnapshotGcsUrl] = useState<string | null>(null); 
  const [snapshotResolution, setSnapshotResolution] = useState<string | null>(null); 

  const [selectedCameraForChat, setSelectedCameraForChat] = useState<Camera | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentChatMessage, setCurrentChatMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const chatScrollAreaRef = useRef<HTMLDivElement>(null);
  const { openNotificationDrawer } = useNotificationDrawer();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isLoadingCameras, setIsLoadingCameras] = useState(true);

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const { toast } = useToast();
  const [isGeneratingAlerts, setIsGeneratingAlerts] = useState(false);
  const { language, translate } = useLanguage();


  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          const organizationId = userData?.organizationId;
          setOrgId(organizationId);
          if (organizationId) {
             fetchGroupsForOrg(organizationId);
             fetchCamerasForOrg(organizationId);
          } else {
            setIsLoadingCameras(false);
          }
        } else {
           setOrgId(null);
           setIsLoadingCameras(false);
        }
      } else {
        setOrgId(null);
        setIsLoadingCameras(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchCamerasForOrg = async (currentOrgId: string) => {
    setIsLoadingCameras(true);
    try {
      const q = query(collection(db, "cameras"), where("orgId", "==", currentOrgId));
      const querySnapshot = await getDocs(q);
      const fetchedCameras = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          cameraName: data.cameraName,
          imageUrl: data.snapshotUrl || 'https://placehold.co/600x400.png', 
          dataAiHint: data.aiDetectionTarget || 'camera security',
          processingStatus: data.processingStatus,
          resolution: data.resolution, 
        } as Camera;
      });
      setCameras(fetchedCameras);
    } catch (error) {
      console.error("Error fetching cameras for org:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch cameras." });
    }
    setIsLoadingCameras(false);
  };

  const fetchGroupsForOrg = async (currentOrgId: string) => {
    try {
      const q = query(collection(db, "groups"), where("orgId", "==", currentOrgId));
      const querySnapshot = await getDocs(q);
      const fetchedGroups = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
      setGroups(fetchedGroups);
    } catch (error) {
      console.error("Error fetching groups for org:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch camera groups." });
    }
  };


  const formStep1 = useForm<AddCameraStep1Values>({
    resolver: zodResolver(addCameraStep1Schema),
    mode: "onChange",
    defaultValues: {
      rtspUrl: '',
      cameraName: '',
      group: undefined,
      newGroupName: '',
      groupDefaultCameraSceneContext: '',
      groupDefaultAiDetectionTarget: '',
      groupDefaultAlertEvents: '',
      groupDefaultVideoChunksValue: '10',
      groupDefaultVideoChunksUnit: 'seconds',
      groupDefaultNumFrames: '5',
      groupDefaultVideoOverlapValue: '2',
      groupDefaultVideoOverlapUnit: 'seconds',
    },
  });

  const formStep2 = useForm<AddCameraStep2Values>({
    resolver: zodResolver(addCameraStep2Schema),
    mode: "onChange",
    defaultValues: {
        sceneDescription: '',
    },
  });

  const formStep3 = useForm<AddCameraStep3Values>({
    resolver: zodResolver(addCameraStep3Schema),
    mode: "onChange",
    defaultValues: {
        cameraSceneContext: '',
        aiDetectionTarget: '',
        alertEvents: '',
        videoChunksValue: '10',
        videoChunksUnit: 'seconds',
        numFrames: '5',
        videoOverlapValue: '2',
        videoOverlapUnit: 'seconds',
    }
  });


  const handleAddCameraClick = () => {
    formStep1.reset();
    formStep2.reset();
    formStep3.reset();
    setDrawerType('addCamera');
    setDrawerStep(1);
    setIsDrawerOpen(true);
    setShowNewGroupForm(false);
    setSelectedGroup(undefined);
    setSnapshotGcsUrl(null);
    setSnapshotResolution(null);
  };

  const handleChatIconClick = (camera: Camera) => {
    setSelectedCameraForChat(camera);
    setDrawerType('chatCamera');
    setChatMessages([
      {
        id: 'ai-initial-' + camera.id,
        sender: 'ai',
        text: translate('chat.initialMessage', { cameraName: camera.cameraName }),
        timestamp: new Date(),
        avatar: undefined,
      }
    ]);
    setCurrentChatMessage('');
    setIsDrawerOpen(true);
  };

  const handleNotificationIconClick = (cameraId: string) => {
    openNotificationDrawer(cameraId);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setDrawerType(null);
    setShowNewGroupForm(false);
    setDrawerStep(1);
    formStep1.reset();
    formStep2.reset();
    formStep3.reset();
    setSelectedCameraForChat(null);
    setChatMessages([]);
    setSnapshotGcsUrl(null);
    setSnapshotResolution(null);
  };

  const handleGroupChange = (value: string) => {
    setSelectedGroup(value);
    formStep1.setValue('group', value);
    formStep2.resetField('sceneDescription'); // Reset scene description when group changes
    formStep3.reset(); // Reset step 3 when group changes

    if (value === 'add_new_group') {
      setShowNewGroupForm(true);
      // Set defaults for new group form
      formStep1.setValue('groupDefaultVideoChunksValue', '10');
      formStep1.setValue('groupDefaultVideoChunksUnit', 'seconds');
      formStep1.setValue('groupDefaultNumFrames', '5');
      formStep1.setValue('groupDefaultVideoOverlapValue', '2');
      formStep1.setValue('groupDefaultVideoOverlapUnit', 'seconds');
      formStep1.setValue('groupDefaultCameraSceneContext','');
      formStep1.setValue('groupDefaultAiDetectionTarget','');
      formStep1.setValue('groupDefaultAlertEvents','');

    } else {
      setShowNewGroupForm(false);
      formStep1.setValue('newGroupName', ''); // Clear new group name if existing group is selected
      const selectedGroupData = groups.find(g => g.id === value);
      if (selectedGroupData) {
        // Populate formStep1 with existing group defaults
        formStep1.setValue('groupDefaultCameraSceneContext', selectedGroupData.defaultCameraSceneContext || '');
        formStep1.setValue('groupDefaultAiDetectionTarget', selectedGroupData.defaultAiDetectionTarget || '');
        formStep1.setValue('groupDefaultAlertEvents', (selectedGroupData.defaultAlertEvents || []).join(', '));
        formStep1.setValue('groupDefaultVideoChunksValue', selectedGroupData.defaultVideoChunks?.value?.toString() || '10');
        formStep1.setValue('groupDefaultVideoChunksUnit', selectedGroupData.defaultVideoChunks?.unit || 'seconds');
        formStep1.setValue('groupDefaultNumFrames', selectedGroupData.defaultNumFrames?.toString() || '5');
        formStep1.setValue('groupDefaultVideoOverlapValue', selectedGroupData.defaultVideoOverlap?.value?.toString() || '2');
        formStep1.setValue('groupDefaultVideoOverlapUnit', selectedGroupData.defaultVideoOverlap?.unit || 'seconds');

        // Pre-populate formStep2's sceneDescription if group has default context
        formStep2.setValue('sceneDescription', selectedGroupData.defaultCameraSceneContext || '');
        
        // Pre-populate formStep3 with group defaults
        formStep3.setValue('cameraSceneContext', selectedGroupData.defaultCameraSceneContext || '');
        formStep3.setValue('aiDetectionTarget', selectedGroupData.defaultAiDetectionTarget || '');
        formStep3.setValue('alertEvents', (selectedGroupData.defaultAlertEvents || []).join(', '));
        formStep3.setValue('videoChunksValue', selectedGroupData.defaultVideoChunks?.value?.toString() || '10');
        formStep3.setValue('videoChunksUnit', selectedGroupData.defaultVideoChunks?.unit || 'seconds');
        formStep3.setValue('numFrames', selectedGroupData.defaultNumFrames?.toString() || '5');
        formStep3.setValue('videoOverlapValue', selectedGroupData.defaultVideoOverlap?.value?.toString() || '2');
        formStep3.setValue('videoOverlapUnit', selectedGroupData.defaultVideoOverlap?.unit || 'seconds');
      } else {
        // Clear defaults if no group selected or group data not found
        formStep1.resetField('groupDefaultCameraSceneContext');
        formStep1.resetField('groupDefaultAiDetectionTarget');
        formStep1.resetField('groupDefaultAlertEvents');
        formStep1.resetField('groupDefaultVideoChunksValue');
        formStep1.resetField('groupDefaultVideoChunksUnit');
        formStep1.resetField('groupDefaultNumFrames');
        formStep1.resetField('groupDefaultVideoOverlapValue');
        formStep1.resetField('groupDefaultVideoOverlapUnit');
        formStep2.setValue('sceneDescription', ''); // Clear scene description for Step 2
      }
    }
  };

  const onSubmitStep1: SubmitHandler<AddCameraStep1Values> = async (data) => {
    if (!formStep1.formState.isValid) return;

    setIsProcessingStep2(true);
    setSnapshotGcsUrl(null);
    setSnapshotResolution(null);
    
    let sceneDescForStep2 = '';
    if (data.group && data.group !== 'add_new_group') {
        const selectedGroupData = groups.find(g => g.id === data.group);
        sceneDescForStep2 = selectedGroupData?.defaultCameraSceneContext || '';
    } else if (data.group === 'add_new_group') {
        sceneDescForStep2 = data.groupDefaultCameraSceneContext || '';
    }
    formStep2.setValue('sceneDescription', sceneDescForStep2);


    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in." });
        setIsProcessingStep2(false);
        return;
      }

      const idToken = await user.getIdToken();

      const snapshotResponse = await fetch('/api/take-camera-snapshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        // For new camera, camera_id is not sent to snapshot service during initial snapshot
        body: JSON.stringify({ rtsp_url: data.rtspUrl }), 
      });

      const snapshotData = await snapshotResponse.json();
      let errorMessageText = `Failed to get snapshot (status: ${snapshotResponse.status})`;

      if (!snapshotResponse.ok) {
          console.error("Snapshot API Error from frontend:", snapshotData.message || snapshotData.error || errorMessageText);
          errorMessageText = snapshotData.message || snapshotData.error || errorMessageText;
          throw new Error(errorMessageText);
      }
      
      if (snapshotData.status === 'success' && snapshotData.snapshotUrl && snapshotData.resolution) {
        setSnapshotGcsUrl(snapshotData.snapshotUrl); 
        setSnapshotResolution(snapshotData.resolution); 
      } else {
        setSnapshotGcsUrl(null); 
        setSnapshotResolution(null); 
        throw new Error(snapshotData.message || "Snapshot API call succeeded but returned invalid data (missing URL or resolution).");
      }
    } catch (error: any) {
      console.error("Error in Step 1 (snapshot fetching):", error);
      toast({
        variant: "destructive",
        title: "Snapshot Error",
        description: error.message || "Could not retrieve camera snapshot. Check RTSP URL and network connectivity.",
      });
      setSnapshotGcsUrl(null);
      setSnapshotResolution(null);
    } finally {
      setIsProcessingStep2(false);
      setDrawerStep(2);
    }
  };

  const handleStep2Back = () => {
    setDrawerStep(1);
    setSnapshotGcsUrl(null);
    setSnapshotResolution(null);
  };

  const onSubmitStep2: SubmitHandler<AddCameraStep2Values> = async (data) => {
    if (!formStep2.formState.isValid) return;

    const step1Values = formStep1.getValues();
    const currentSceneDesc = data.sceneDescription;

    let finalCameraContext = currentSceneDesc;
    let finalAiTarget = '';
    let finalAlertEvents = '';
    let finalVideoChunksValue = '10';
    let finalVideoChunksUnit: 'seconds' | 'minutes' = 'seconds';
    let finalNumFrames = '5';
    let finalVideoOverlapValue = '2';
    let finalVideoOverlapUnit: 'seconds' | 'minutes' = 'seconds';


    if (step1Values.group && step1Values.group !== 'add_new_group') {
        const selectedGroupData = groups.find(g => g.id === step1Values.group);
        if (selectedGroupData) {
            finalCameraContext = selectedGroupData.defaultCameraSceneContext || currentSceneDesc;
            finalAiTarget = selectedGroupData.defaultAiDetectionTarget || '';
            finalAlertEvents = (selectedGroupData.defaultAlertEvents || []).join(', ');
            if(selectedGroupData.defaultVideoChunks) {
                finalVideoChunksValue = selectedGroupData.defaultVideoChunks.value.toString();
                finalVideoChunksUnit = selectedGroupData.defaultVideoChunks.unit;
            }
            if(selectedGroupData.defaultNumFrames) finalNumFrames = selectedGroupData.defaultNumFrames.toString();
            if(selectedGroupData.defaultVideoOverlap) {
                finalVideoOverlapValue = selectedGroupData.defaultVideoOverlap.value.toString();
                finalVideoOverlapUnit = selectedGroupData.defaultVideoOverlap.unit;
            }
        }
    } else if (step1Values.group === 'add_new_group') {
        finalCameraContext = step1Values.groupDefaultCameraSceneContext || currentSceneDesc;
        finalAiTarget = step1Values.groupDefaultAiDetectionTarget || '';
        finalAlertEvents = step1Values.groupDefaultAlertEvents || '';
        if(step1Values.groupDefaultVideoChunksValue) finalVideoChunksValue = step1Values.groupDefaultVideoChunksValue;
        if(step1Values.groupDefaultVideoChunksUnit) finalVideoChunksUnit = step1Values.groupDefaultVideoChunksUnit;
        if(step1Values.groupDefaultNumFrames) finalNumFrames = step1Values.groupDefaultNumFrames;
        if(step1Values.groupDefaultVideoOverlapValue) finalVideoOverlapValue = step1Values.groupDefaultVideoOverlapValue;
        if(step1Values.groupDefaultVideoOverlapUnit) finalVideoOverlapUnit = step1Values.groupDefaultVideoOverlapUnit;
    } else {
        // No group selected, use current scene description for context if not empty
        finalCameraContext = currentSceneDesc || ''; 
    }

    formStep3.setValue('cameraSceneContext', finalCameraContext);
    formStep3.setValue('aiDetectionTarget', finalAiTarget);
    formStep3.setValue('alertEvents', finalAlertEvents);
    formStep3.setValue('videoChunksValue', finalVideoChunksValue);
    formStep3.setValue('videoChunksUnit', finalVideoChunksUnit);
    formStep3.setValue('numFrames', finalNumFrames);
    formStep3.setValue('videoOverlapValue', finalVideoOverlapValue);
    formStep3.setValue('videoOverlapUnit', finalVideoOverlapUnit);

    setDrawerStep(3);
  };

  const handleStep3Back = () => {
      setDrawerStep(2);
  };

  const getEffectiveServerUrl = useCallback(async (currentOrgIdParam: string): Promise<string | null> => {
    if (!currentOrgIdParam) return null;
    try {
      const orgDocRef = doc(db, 'organizations', currentOrgIdParam);
      const orgDocSnap = await getDoc(orgDocRef);
      let serverToUseId: string | null = null;

      if (orgDocSnap.exists()) {
        const orgData = orgDocSnap.data();
        if (orgData.orgDefaultServerId) {
          serverToUseId = orgData.orgDefaultServerId;
          console.log("Using Organization Default Server ID:", serverToUseId);
        }
      } else {
        console.warn(`Organization document ${currentOrgIdParam} not found.`);
      }

      if (!serverToUseId) {
        console.log("Organization default server not set or org not found, looking for System Default Server...");
        const systemDefaultServerQuery = query(collection(db, 'servers'), where('isSystemDefault', '==', true), limit(1));
        const systemDefaultSnapshot = await getDocs(systemDefaultServerQuery);
        if (!systemDefaultSnapshot.empty) {
          serverToUseId = systemDefaultSnapshot.docs[0].id;
          console.log("Using System Default Server ID:", serverToUseId);
        }
      }

      if (serverToUseId) {
        const serverDocRef = doc(db, 'servers', serverToUseId);
        const serverDocSnap = await getDoc(serverDocRef);
        if (serverDocSnap.exists()) {
          const serverData = serverDocSnap.data();
          if (serverData.status === 'online') {
            return `${serverData.protocol}://${serverData.ipAddressWithPort}`;
          } else {
            console.warn(`Selected default server ${serverData.name} (${serverToUseId}) is not online. Status: ${serverData.status}. No server IP will be assigned.`);
            return null;
          }
        } else {
          console.warn(`Server document for ID ${serverToUseId} not found. No server IP will be assigned.`);
          return null;
        }
      }

      console.warn("No suitable (Organization or System) Default Server found or active. No server IP will be assigned.");
      return null;
    } catch (error) {
      console.error("Error fetching effective server URL:", error);
      toast({
        variant: "destructive",
        title: "Server Fetch Error",
        description: "Could not fetch default server information.",
      });
      return null;
    }
  }, [toast]);


  const onSubmitStep3: SubmitHandler<AddCameraStep3Values> = async (configData) => {
    if (!formStep3.formState.isValid || !currentUser || !orgId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Missing required information or user not authenticated.",
      });
      return;
    }

    const step1Data = formStep1.getValues();
    const step2Data = formStep2.getValues();

    let effectiveServerUrl: string | null = null;
    try {
        effectiveServerUrl = await getEffectiveServerUrl(orgId);
    } catch (error) {
        // Error already toasted by getEffectiveServerUrl
    }

    const batch = writeBatch(db);
    const now = serverTimestamp() as Timestamp;
    let finalGroupId: string | null = null;

    if (step1Data.group === 'add_new_group' && step1Data.newGroupName) {
        const groupDocRef = doc(collection(db, 'groups'));
        finalGroupId = groupDocRef.id;
        const newGroup: Omit<Group, 'id'| 'createdAt' | 'updatedAt'> & { createdAt: Timestamp, updatedAt: Timestamp, videos: string[], cameras: string[] } = {
            name: step1Data.newGroupName,
            orgId: orgId,
            userId: currentUser.uid,
            cameras: [],
            videos: [],
            defaultCameraSceneContext: step1Data.groupDefaultCameraSceneContext || null,
            defaultAiDetectionTarget: step1Data.groupDefaultAiDetectionTarget || null,
            defaultAlertEvents: step1Data.groupDefaultAlertEvents ? step1Data.groupDefaultAlertEvents.split(',').map(ae => ae.trim()).filter(ae => ae) : null,
            defaultVideoChunks: step1Data.groupDefaultVideoChunksValue ? { value: parseFloat(step1Data.groupDefaultVideoChunksValue), unit: step1Data.groupDefaultVideoChunksUnit || 'seconds' } : null,
            defaultNumFrames: step1Data.groupDefaultNumFrames ? parseInt(step1Data.groupDefaultNumFrames, 10) : null,
            defaultVideoOverlap: step1Data.groupDefaultVideoOverlapValue ? { value: parseFloat(step1Data.groupDefaultVideoOverlapValue), unit: step1Data.groupDefaultVideoOverlapUnit || 'seconds' } : null,
            createdAt: now,
            updatedAt: now,
        };
        batch.set(groupDocRef, newGroup);
        setGroups(prev => [...prev, { ...newGroup, id: groupDocRef.id }]);
    } else if (step1Data.group) {
        finalGroupId = step1Data.group;
    }

    const cameraDocRef = doc(collection(db, 'cameras'));
    const configDocRef = doc(collection(db, 'configurations'));

    batch.set(cameraDocRef, {
      cameraName: step1Data.cameraName,
      groupId: finalGroupId,
      userId: currentUser.uid,
      orgId: orgId,
      createdAt: now,
      updatedAt: now,
      url: step1Data.rtspUrl,
      protocol: "rtsp",
      activeVSSId: null,
      historicalVSSIds: [],
      processingStatus: "waiting_for_approval",
      currentConfigId: configDocRef.id,
      snapshotUrl: snapshotGcsUrl, 
      resolution: snapshotResolution, 
    });

    batch.set(configDocRef, {
      sourceId: cameraDocRef.id,
      sourceType: "camera",
      serverIpAddress: effectiveServerUrl, 
      createdAt: now,
      videoChunks: {
        value: parseFloat(configData.videoChunksValue),
        unit: configData.videoChunksUnit,
      },
      numFrames: parseInt(configData.numFrames, 10),
      videoOverlap: {
        value: parseFloat(configData.videoOverlapValue),
        unit: configData.videoOverlapUnit,
      },
      cameraSceneContext: configData.cameraSceneContext,
      aiDetectionTarget: configData.aiDetectionTarget,
      alertEvents: configData.alertEvents.split(',').map(ae => ae.trim()).filter(ae => ae),
      sceneDescription: step2Data.sceneDescription,
      userId: currentUser.uid,
      previousConfigId: null,
    });

    if (finalGroupId) {
        const groupRefToUpdate = doc(db, 'groups', finalGroupId);
        batch.update(groupRefToUpdate, {
            cameras: arrayUnion(cameraDocRef.id),
            updatedAt: now,
        });
        setGroups(prevGroups => prevGroups.map(g =>
            g.id === finalGroupId
            ? { ...g, cameras: [...(g.cameras || []), cameraDocRef.id], updatedAt: now }
            : g
        ));
    }

    try {
      await batch.commit();
      toast({
        title: "Camera Saved",
        description: `${step1Data.cameraName} has been added. It is awaiting approval by an administrator.`,
      });
      const newCameraForState: Camera = {
        id: cameraDocRef.id,
        cameraName: step1Data.cameraName,
        imageUrl: snapshotGcsUrl || 'https://placehold.co/600x400.png',
        dataAiHint: configData.aiDetectionTarget || 'newly added camera',
        processingStatus: "waiting_for_approval",
        resolution: snapshotResolution || undefined,
      };
      setCameras(prevCameras => [...prevCameras, newCameraForState]);
      handleDrawerClose();
    } catch (error: any) {
      console.error("Error saving camera and configuration: ", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: `Could not save the camera. ${error.message}`,
      });
    }
  };

  const handleSendChatMessage = async () => {
    if (!currentChatMessage.trim() || !selectedCameraForChat) return;

    const userMessage: ChatMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: currentChatMessage,
      timestamp: new Date(),
      avatar: 'https://placehold.co/50x50.png',
    };

    setChatMessages(prev => [...prev, userMessage]);
    setCurrentChatMessage('');
    setIsSendingMessage(true);

    await new Promise(resolve => setTimeout(resolve, 1500));
    const aiResponse: ChatMessage = {
      id: 'ai-' + Date.now(),
      sender: 'ai',
      text: `Okay, I've processed your message about ${selectedCameraForChat.cameraName}: "${userMessage.text}". What else can I help you with?`,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, aiResponse]);
    setIsSendingMessage(false);
  };

  useEffect(() => {
    const scrollElement = chatScrollAreaRef.current;
    if (scrollElement) {
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }
  }, [chatMessages]);

  const handleGenerateGroupAlerts = async () => {
    const detectionTarget = formStep1.getValues('groupDefaultAiDetectionTarget');
    if (!detectionTarget || detectionTarget.trim() === "") {
        toast({
            variant: "destructive",
            title: "Input Required",
            description: "Please enter an AI detection target first.",
        });
        return;
    }
    setIsGeneratingAlerts(true);
    try {
        const response = await generateGroupAlertEvents({ aiDetectionTarget: detectionTarget, language: language });
        if (response && response.suggestedAlertEvents && !response.suggestedAlertEvents.startsWith("Error:")) {
            formStep1.setValue('groupDefaultAlertEvents', response.suggestedAlertEvents);
            toast({
                title: "Alerts Generated",
                description: "Suggested alert events have been populated.",
            });
        } else {
            toast({
                variant: "destructive",
                title: "Generation Failed",
                description: response.suggestedAlertEvents || "Could not generate alert events. Please try again.",
            });
        }
    } catch (error: any) {
        console.error("Error generating group alert events:", error);
        let description = "An unexpected error occurred while generating alert events.";
        if (error.message && error.message.includes('API key not valid')) {
            description = "Generation failed: API key is not valid. Please check your configuration.";
        } else if (error.message) {
            description = `Generation failed: ${error.message}`;
        }
        toast({
            variant: "destructive",
            title: "Error",
            description: description,
        });
    } finally {
        setIsGeneratingAlerts(false);
    }
};


  const renderDrawerContent = () => {
    if (drawerType === 'addCamera') {
      if (drawerStep === 1) {
        return (
          <div className="p-6">
            <Form {...formStep1}>
            <form id="add-camera-form-step1" onSubmit={formStep1.handleSubmit(onSubmitStep1)} className="space-y-8">
                <FormField
                control={formStep1.control}
                name="rtspUrl"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="flex items-center mb-1.5">
                        <Video className="w-4 h-4 mr-2 text-muted-foreground"/> RTSP URL
                    </FormLabel>
                    <FormControl>
                        <Input placeholder="rtsp://..." {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={formStep1.control}
                name="cameraName"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="flex items-center mb-1.5">
                        <Edit3 className="w-4 h-4 mr-2 text-muted-foreground"/> Name
                    </FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., Front Door Camera" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={formStep1.control}
                name="group"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="flex items-center mb-1.5">
                        <Folder className="w-4 h-4 mr-2 text-muted-foreground"/> Group
                    </FormLabel>
                    <Select onValueChange={handleGroupChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger id="group">
                            <SelectValue placeholder="Select a group or add new" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {groups.length > 0 ? groups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                            {group.name}
                            </SelectItem>
                        )) : (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">No groups yet.</div>
                        )}
                        <SelectItem value="add_new_group">
                            <span className="text-primary font-medium">Add new group...</span>
                        </SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />

                {showNewGroupForm && (
                <Card className="p-4 bg-muted/50">
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center">
                            <Plus className="w-4 h-4 mr-2"/> Add a new group for your cameras or videos
                        </h4>
                        <FormField
                            control={formStep1.control}
                            name="newGroupName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center mb-1.5">
                                        <Edit3 className="w-4 h-4 mr-2 text-muted-foreground"/>Group Name
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Warehouse Zone 1" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={formStep1.control}
                            name="groupDefaultCameraSceneContext"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center mb-1.5">
                                        <HelpCircle className="w-4 h-4 mr-2 text-muted-foreground"/>What does the cameras in this group looking at? (Group Default)
                                    </FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="e.g., Monitors the main entrance and exit points." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={formStep1.control}
                            name="groupDefaultAiDetectionTarget"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center mb-1.5">
                                        <Settings2 className="w-4 h-4 mr-2 text-muted-foreground"/>What does the things you want the AI to detect from this group of cameras? (Group Default)
                                    </FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="e.g., Detect unauthorized personnel, loitering, package theft." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                            />
                        <FormField
                            control={formStep1.control}
                            name="groupDefaultAlertEvents"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center justify-between mb-1.5">
                                      <span className="flex items-center">
                                        <ShieldAlert className="w-4 h-4 mr-2 text-muted-foreground"/>Group Alert Events (Default)
                                      </span>
                                       <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleGenerateGroupAlerts}
                                            disabled={isGeneratingAlerts || !formStep1.watch('groupDefaultAiDetectionTarget')}
                                            className="text-xs"
                                        >
                                            {isGeneratingAlerts ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                                            Suggest
                                        </Button>
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., safety: worker not wearing ppe, safety: unlit work area" {...field} />
                                    </FormControl>
                                    <p className="text-xs text-muted-foreground mt-1">Enter comma-separated alert events for the group.</p>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-1 gap-y-4">
                            <Label className="text-sm font-medium text-muted-foreground col-span-full">Group Default Video Config:</Label>
                            <div className="grid grid-cols-2 gap-x-4">
                                <FormField control={formStep1.control} name="groupDefaultVideoChunksValue" render={({ field }) => ( <FormItem> <FormLabel className="text-xs">Video Chunks</FormLabel> <FormControl><Input type="number" placeholder="10" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={formStep1.control} name="groupDefaultVideoChunksUnit" render={({ field }) => ( <FormItem className="self-end"> <Select onValueChange={field.onChange} defaultValue={field.value || 'seconds'}><FormControl><SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger></FormControl><SelectContent><SelectItem value="seconds">Secs</SelectItem><SelectItem value="minutes">Mins</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                            </div>
                             <div className="grid grid-cols-2 gap-x-4">
                                <FormField control={formStep1.control} name="groupDefaultVideoOverlapValue" render={({ field }) => ( <FormItem> <FormLabel className="text-xs">Video Overlap</FormLabel> <FormControl><Input type="number" placeholder="2" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={formStep1.control} name="groupDefaultVideoOverlapUnit" render={({ field }) => ( <FormItem className="self-end"> <Select onValueChange={field.onChange} defaultValue={field.value || 'seconds'}><FormControl><SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger></FormControl><SelectContent><SelectItem value="seconds">Secs</SelectItem><SelectItem value="minutes">Mins</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                            </div>
                            <FormField control={formStep1.control} name="groupDefaultNumFrames" render={({ field }) => ( <FormItem> <FormLabel className="text-xs">No. of Frames</FormLabel> <FormControl><Input type="number" placeholder="5" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                    </div>
                </Card>
                )}
            </form>
            </Form>
          </div>
        );
        } else if (drawerStep === 2) {
        return (
          <div className="p-6">
            <Form {...formStep2}>
                <form id="add-camera-form-step2" onSubmit={formStep2.handleSubmit(onSubmitStep2)} className="space-y-6">
                
                {isProcessingStep2 ? (
                    <div className="w-full aspect-video bg-muted rounded-md flex flex-col items-center justify-center text-center p-4">
                        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                        <p className="text-sm text-muted-foreground">Connecting to camera and extracting snapshot...</p>
                        <p className="text-xs text-muted-foreground">This may take a moment.</p>
                    </div>
                ) : snapshotGcsUrl ? (
                    <Image
                    src={snapshotGcsUrl} 
                    alt="Camera Snapshot"
                    width={400}
                    height={300}
                    className="rounded-md border object-cover aspect-video w-full"
                    data-ai-hint="camera snapshot"
                    unoptimized // Useful for GCS URLs if not configured in next.config.js
                    />
                ) : (
                     <div className="w-full aspect-video bg-muted rounded-md flex flex-col items-center justify-center text-center p-4">
                        <CameraIconLucide className="h-12 w-12 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Could not retrieve snapshot.</p>
                        <p className="text-xs text-muted-foreground">Check RTSP URL and network or try again. You can still proceed to describe the scene manually.</p>
                    </div>
                )}

                <FormField
                    control={formStep2.control}
                    name="sceneDescription"
                    render={({ field }) => (
                        <FormItem className="text-left">
                            <FormLabel className="flex items-center">
                                <Wand2 className="w-4 h-4 mr-2 text-muted-foreground" />
                                Explain the scene?
                            </FormLabel>
                            <FormControl>
                                <div className="relative">
                                <Textarea
                                    placeholder="e.g., This camera overlooks the main warehouse loading bay, monitoring incoming and outgoing trucks."
                                    {...field}
                                    rows={3}
                                    className="pr-10"
                                />
                                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7">
                                    <Mic className="w-4 h-4" />
                                </Button>
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                </form>
            </Form>
          </div>
        );
        } else if (drawerStep === 3) {
            return (
              <div className="p-6">
                <Form {...formStep3}>
                    <form id="add-camera-form-step3" onSubmit={formStep3.handleSubmit(onSubmitStep3)} className="space-y-6">
                        <FormField
                            control={formStep3.control}
                            name="cameraSceneContext"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center">
                                        <HelpCircle className="w-4 h-4 mr-2 text-muted-foreground" />
                                        What does this camera do? (Camera Scene Context)
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Textarea
                                                placeholder="e.g., Monitors the main entrance and exit points for security."
                                                {...field}
                                                rows={3}
                                                className="pr-10"
                                            />
                                            <Button variant="ghost" size="icon" className="absolute right-1 top-2 h-7 w-7">
                                                <Mic className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={formStep3.control}
                            name="aiDetectionTarget"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center">
                                        <Wand2 className="w-4 h-4 mr-2 text-muted-foreground" />
                                        What does the things you want the AI to detect from this camera? (AI Detection Target)
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Textarea
                                                placeholder="e.g., Detect unauthorized personnel, loitering, package theft."
                                                {...field}
                                                rows={3}
                                                className="pr-10"
                                            />
                                            <Button variant="ghost" size="icon" className="absolute right-1 top-2 h-7 w-7">
                                                <Mic className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={formStep3.control}
                            name="alertEvents"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center">
                                        <Diamond className="w-4 h-4 mr-2 text-muted-foreground" />
                                        Alert Events
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="e.g., safety: worker not wearing ppe, safety: worker not wearing helmet, safety: unlit work area"
                                            {...field}
                                        />
                                    </FormControl>
                                    <p className="text-xs text-muted-foreground mt-1">Enter comma-separated alert events for this camera.</p>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-1 gap-y-6">
                            <div className="grid grid-cols-2 gap-x-4">
                                <FormField
                                    control={formStep3.control}
                                    name="videoChunksValue"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="flex items-center">
                                                <Film className="w-4 h-4 mr-2 text-muted-foreground" />
                                                Video Chunks
                                            </FormLabel>
                                            <FormControl>
                                                <Input type="number" placeholder="e.g., 10" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={formStep3.control}
                                    name="videoChunksUnit"
                                    render={({ field }) => (
                                    <FormItem className="self-end">
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                            <SelectValue placeholder="Unit" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="seconds">Seconds</SelectItem>
                                            <SelectItem value="minutes">Minutes</SelectItem>
                                        </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                            </div>

                             <div className="grid grid-cols-2 gap-x-4">
                                <FormField
                                    control={formStep3.control}
                                    name="videoOverlapValue"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="flex items-center">
                                                <AlertCircleIconLucide className="w-4 h-4 mr-2 text-muted-foreground" />
                                                Video Overlap
                                            </FormLabel>
                                            <FormControl>
                                                <Input type="number" placeholder="e.g., 2" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={formStep3.control}
                                    name="videoOverlapUnit"
                                    render={({ field }) => (
                                    <FormItem className="self-end">
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                            <SelectValue placeholder="Unit" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="seconds">Seconds</SelectItem>
                                            <SelectItem value="minutes">Minutes</SelectItem>
                                        </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={formStep3.control}
                                name="numFrames"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center">
                                            <BarChart className="w-4 h-4 mr-2 text-muted-foreground" />
                                            No. of Frames
                                        </FormLabel>
                                        <FormControl>
                                            <Input type="number" placeholder="e.g., 5" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="flex items-center space-x-2 mt-4">
                            <CalendarDays className="w-4 h-4 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Total no. of frames processed in a day: <span className="font-medium text-foreground"> (Calculated based on above values)</span></p>
                        </div>
                    </form>
                </Form>
              </div>
            );
        }
    } else if (drawerType === 'chatCamera' && selectedCameraForChat) {
        return (
            <div className="flex flex-col h-full p-4 space-y-4" ref={chatScrollAreaRef}>
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
                    <div className="flex items-end space-x-2 max-w-[80%]">
                      {msg.sender === 'ai' && (
                        <Avatar className="h-8 w-8">
                           <div className="bg-primary rounded-full p-1.5 flex items-center justify-center h-full w-full">
                            <Bot className="h-5 w-5 text-primary-foreground" />
                           </div>
                        </Avatar>
                      )}
                      <div
                        className={`p-3 rounded-lg ${
                          msg.sender === 'user'
                            ? 'bg-primary text-primary-foreground rounded-br-none'
                            : 'bg-muted text-foreground rounded-bl-none'
                        }`}
                      >
                        <p className="text-sm">{msg.text}</p>
                      </div>
                      {msg.sender === 'user' && msg.avatar && (
                         <Avatar className="h-8 w-8">
                            <AvatarImage src={msg.avatar} alt="User" data-ai-hint="user avatar"/>
                            <AvatarFallback>{/* User initials */}</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  </div>
                ))}
                 {isSendingMessage && (
                    <div className="flex justify-start mb-3">
                        <div className="flex items-end space-x-2">
                            <Avatar className="h-8 w-8">
                                <div className="bg-primary rounded-full p-1.5 flex items-center justify-center h-full w-full">
                                    <Bot className="h-5 w-5 text-primary-foreground" />
                                </div>
                            </Avatar>
                            <div className="p-3 rounded-lg bg-muted text-foreground rounded-bl-none">
                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            </div>
                        </div>
                    </div>
                )}
            </div>
          );
    }
    return null;
  };

  const drawerFooter = () => {
    if (drawerType === 'addCamera') {
        if (drawerStep === 1) {
        return (
            <div className="flex justify-between p-4 border-t">
                <Button variant="outline" onClick={handleDrawerClose}>Cancel</Button>
                <Button
                    type="submit"
                    form="add-camera-form-step1"
                    disabled={formStep1.formState.isSubmitting || !formStep1.formState.isValid || isProcessingStep2}
                >
                    {formStep1.formState.isSubmitting || isProcessingStep2 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Next
                </Button>
            </div>
        );
        } else if (drawerStep === 2) {
        return (
            <div className="flex justify-between p-4 border-t">
                <Button variant="outline" onClick={handleStep2Back}>Back</Button>
                <Button
                    type="submit"
                    form="add-camera-form-step2"
                    disabled={isProcessingStep2 || formStep2.formState.isSubmitting || !formStep2.formState.isValid}
                >
                    {(isProcessingStep2 || formStep2.formState.isSubmitting) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Next
                </Button>
            </div>
        );
        } else if (drawerStep === 3) {
            return (
                <div className="flex justify-between p-4 border-t">
                    <Button variant="outline" onClick={handleStep3Back}>Back</Button>
                    <Button
                        type="submit"
                        form="add-camera-form-step3"
                        disabled={formStep3.formState.isSubmitting || !formStep3.formState.isValid}
                    >
                        {formStep3.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save Camera
                    </Button>
                </div>
            );
        }
    } else if (drawerType === 'chatCamera') {
        return (
            <div className="p-4 border-t flex items-center space-x-2">
                <Avatar className="h-8 w-8">
                    <AvatarImage src="https://placehold.co/50x50.png" alt="User" data-ai-hint="user avatar" />
                    <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <Input
                    placeholder="Add a comment..."
                    value={currentChatMessage}
                    onChange={(e) => setCurrentChatMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !isSendingMessage && handleSendChatMessage()}
                    className="flex-grow"
                    disabled={isSendingMessage}
                />
                <Button onClick={handleSendChatMessage} disabled={isSendingMessage || !currentChatMessage.trim()}>
                    {isSendingMessage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    <span className="hidden sm:inline ml-1">Send</span>
                </Button>
            </div>
        );
    }
    return null;
  };

  const getDrawerTitle = () => {
    if (drawerType === 'addCamera') {
        let title = drawerStep === 1 ? "Add New Camera - Details" :
               drawerStep === 2 ? "Add New Camera - Scene Analysis" :
               "Add New Camera - AI Configuration";
        return title;
    }
    if (drawerType === 'chatCamera' && selectedCameraForChat) {
        return `Chat with ${selectedCameraForChat.cameraName}`;
    }
    return "Drawer";
  }


  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="space-x-2">
        </div>
        <div className="flex flex-wrap items-center space-x-2 sm:space-x-2 gap-y-2 justify-end">
          <Button onClick={handleAddCameraClick}>
            <Plus className="mr-2 h-4 w-4" /> Add Camera
          </Button>
          <Button variant="outline">
            <Users className="mr-2 h-4 w-4" /> Group
          </Button>
          <Button variant="outline">
            <ListFilter className="mr-2 h-4 w-4" /> Filter
          </Button>
          <Button variant="outline">
            <ArrowUpDown className="mr-2 h-4 w-4" /> Sort
          </Button>
          <Button variant="outline" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {isLoadingCameras ? (
         <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
      ) : cameras.length === 0 ? (
         <div className="flex flex-col items-center justify-center text-center py-12">
            <CameraIconLucide className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No Cameras Yet</h3>
            <p className="text-muted-foreground mb-6">Get started by adding your first camera to OctaVision.</p>
            <Button onClick={handleAddCameraClick}>
                <Plus className="mr-2 h-4 w-4" /> Add Your First Camera
            </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {cameras.map((camera) => (
            <Card key={camera.id} className="overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200 rounded-lg">
                <CardContent className="p-0">
                <div className="relative">
                    <Image
                    src={camera.imageUrl} 
                    alt={camera.cameraName}
                    width={200}
                    height={150}
                    className="rounded-t-lg aspect-video w-full object-cover"
                    data-ai-hint={camera.dataAiHint}
                    unoptimized // Add this if using GCS URLs not whitelisted in next.config.js
                    />
                    {camera.processingStatus === 'running_normal' ? (
                        <CheckCircle className="absolute top-2 right-2 h-5 w-5 text-green-500 bg-white rounded-full p-0.5" />
                    ) : camera.processingStatus === 'waiting_for_approval' ? (
                         <Clock className="absolute top-2 right-2 h-5 w-5 text-orange-500 bg-white rounded-full p-0.5" />
                    ) : (
                        <AlertTriangle className="absolute top-2 right-2 h-5 w-5 text-red-500 bg-white rounded-full p-0.5" />
                    )}
                </div>
                <div className="p-3">
                    <h3 className="text-sm font-semibold mb-2 truncate">{camera.cameraName}</h3>
                     {camera.resolution && <p className="text-xs text-muted-foreground mb-1">Res: {camera.resolution}</p>}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center space-x-2">
                        <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                            <div className="flex items-center space-x-1 cursor-pointer hover:text-primary">
                                <Clock className="w-3 h-3" />
                                <span>15 min</span>
                            </div>
                            </TooltipTrigger>
                            <TooltipContent>
                            <p>Recording Schedule</p>
                            </TooltipContent>
                        </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center space-x-1 cursor-pointer hover:text-destructive">
                                    <ShieldAlert className="w-3 h-3 text-destructive" />
                                    <span>2</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Active Alerts</p>
                            </TooltipContent>
                        </Tooltip>
                        </TooltipProvider>
                    </div>
                    <div className="flex items-center space-x-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleNotificationIconClick(camera.id)}>
                        <Bell className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleChatIconClick(camera)}>
                        <MessageSquare className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                    </div>
                </div>
                </CardContent>
            </Card>
            ))}
        </div>
      )}


      <RightDrawer
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        title={getDrawerTitle()}
        footerContent={drawerFooter()}
        noPadding={drawerType === 'chatCamera'}
      >
        {renderDrawerContent()}
      </RightDrawer>
    </div>
  );
};

export default CamerasPage;


    