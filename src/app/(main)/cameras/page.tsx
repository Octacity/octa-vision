
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
import { AlertCircle as AlertCircleIconLucide, AlertTriangle as AlertTriangleIcon, ArrowUpDown, BarChart, Bell, Bot, CalendarDays, Camera as CameraIconLucide, CheckCircle, Clock, Diamond, Edit3, Film, Folder, HelpCircle, ListFilter, Loader2, MessageSquare, MoreHorizontal, Plus, Send, Server, Settings2, ShieldAlert, Sparkles, Users, Video, Wand2 } from 'lucide-react';
import RightDrawer from '@/components/RightDrawer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useNotificationDrawer } from '@/contexts/NotificationDrawerContext';
import { useToast } from '@/hooks/use-toast';
import { generateGroupAlertEvents } from '@/ai/flows/generate-group-alert-events';
// Removed import for describeImage as it's no longer used
import { useLanguage } from '@/contexts/LanguageContext';

export interface Group {
  id: string;
  name: string;
  orgId: string;
  userId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  cameras?: string[];
  videos?: string[];
  defaultCameraSceneContext?: string | null;
  defaultAiDetectionTarget?: string | null;
  defaultAlertEvents?: string[] | null;
  defaultVideoChunks?: { value: number; unit: 'seconds' | 'minutes' } | null;
  defaultNumFrames?: number | null;
  defaultVideoOverlap?: { value: number; unit: 'seconds' | 'minutes' } | null;
}


export interface Camera {
  id: string;
  cameraName: string;
  imageUrl?: string; // This will hold the GCS signed URL for display
  dataAiHint: string;
  processingStatus?: string;
  resolution?: string | null;
  snapshotGcsObjectName?: string | null; // Stores the GCS object name
}

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: Date;
  avatar?: string;
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

// Step 2 schema is now empty as sceneDescription field is removed
const addCameraStep2Schema = z.object({});
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

  const [isProcessingStep1Submitting, setIsProcessingStep1Submitting] = useState(false);
  const [isProcessingStep2Snapshot, setIsProcessingStep2Snapshot] = useState(false);
  const [currentRtspUrlForSnapshot, setCurrentRtspUrlForSnapshot] = useState<string | null>(null);

  const [snapshotGcsObjectName, setSnapshotGcsObjectName] = useState<string | null>(null);
  const [displayableSnapshotUrl, setDisplayableSnapshotUrl] = useState<string | null>(null);
  const [snapshotResolution, setSnapshotResolution] = useState<string | null>(null);
  const [isLoadingSnapshotUrl, setIsLoadingSnapshotUrl] = useState(false);
  // Removed isGeneratingDescription state


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
    setCameras([]);
    try {
      const q = query(collection(db, "cameras"), where("orgId", "==", currentOrgId));
      const querySnapshot = await getDocs(q);
      const fetchedCamerasPromises = querySnapshot.docs.map(async (docSnapshot) => {
        const data = docSnapshot.data();
        let imageUrlToDisplay: string | undefined = undefined;

        if (data.snapshotGcsObjectName) {
          try {
            const retrieveSnapshotServiceUrl = process.env.NEXT_PUBLIC_RETRIEVE_SNAPSHOT_URL;
            if (!retrieveSnapshotServiceUrl) {
                console.error("Retrieve snapshot service URL is not configured for camera list.");
            } else {
                const auth = getAuth();
                const user = auth.currentUser;
                if (user) {
                    const idToken = await user.getIdToken();
                    const response = await fetch(retrieveSnapshotServiceUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    },
                    body: JSON.stringify({ gcsObjectName: data.snapshotGcsObjectName })
                    });
                    if (response.ok) {
                    const resData = await response.json();
                    if (resData.status === 'success' && resData.signedUrl) {
                        imageUrlToDisplay = resData.signedUrl;
                    } else {
                        console.warn(`Failed to retrieve signed URL for ${data.snapshotGcsObjectName} in list: ${resData.message || 'Unknown error'}`);
                    }
                    } else {
                        const errorText = await response.text();
                        console.warn(`Failed to retrieve image for ${data.snapshotGcsObjectName} in list: ${response.status} - ${errorText}`);
                    }
                }
            }
          } catch (e) {
            console.warn(`Error fetching signed URL for ${data.snapshotGcsObjectName} in list:`, e);
          }
        }
        return {
          id: docSnapshot.id,
          cameraName: data.cameraName,
          imageUrl: imageUrlToDisplay,
          dataAiHint: data.aiDetectionTarget || 'camera security', // aiDetectionTarget is in configurations, might need adjustment
          processingStatus: data.processingStatus,
          resolution: data.resolution || null,
          snapshotGcsObjectName: data.snapshotGcsObjectName,
        } as Camera;
      });
      const fetchedCameras = await Promise.all(fetchedCamerasPromises);
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

  // FormStep2 now has an empty schema and default values
  const formStep2 = useForm<AddCameraStep2Values>({
    resolver: zodResolver(addCameraStep2Schema),
    mode: "onChange",
    defaultValues: {},
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
    formStep1.reset({
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
    });
    formStep2.reset({}); // Reset step 2 form
    formStep3.reset({
        cameraSceneContext: '',
        aiDetectionTarget: '',
        alertEvents: '',
        videoChunksValue: '10',
        videoChunksUnit: 'seconds',
        numFrames: '5',
        videoOverlapValue: '2',
        videoOverlapUnit: 'seconds',
    });

    setDrawerType('addCamera');
    setDrawerStep(1);
    setIsDrawerOpen(true);
    setShowNewGroupForm(false);
    setSelectedGroup(undefined);

    setCurrentRtspUrlForSnapshot(null);
    setSnapshotGcsObjectName(null);
    setDisplayableSnapshotUrl(null);
    setSnapshotResolution(null);

    setIsProcessingStep1Submitting(false);
    setIsProcessingStep2Snapshot(false);
    setIsLoadingSnapshotUrl(false);
    // Removed isGeneratingDescription reset
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

    formStep1.reset({
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
    });
    formStep2.reset({});
    formStep3.reset({
        cameraSceneContext: '',
        aiDetectionTarget: '',
        alertEvents: '',
        videoChunksValue: '10',
        videoChunksUnit: 'seconds',
        numFrames: '5',
        videoOverlapValue: '2',
        videoOverlapUnit: 'seconds',
    });

    setSelectedCameraForChat(null);
    setChatMessages([]);

    setCurrentRtspUrlForSnapshot(null);
    setSnapshotGcsObjectName(null);
    setDisplayableSnapshotUrl(null);
    setSnapshotResolution(null);
    setIsProcessingStep1Submitting(false);
    setIsProcessingStep2Snapshot(false);
    setIsLoadingSnapshotUrl(false);
    // Removed isGeneratingDescription reset
  };

  const handleGroupChange = (value: string) => {
    setSelectedGroup(value);
    formStep1.setValue('group', value);

    if (value === 'add_new_group') {
      setShowNewGroupForm(true);
      formStep1.setValue('newGroupName', '');
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
      formStep1.setValue('newGroupName', '');
      const selectedGroupData = groups.find(g => g.id === value);
      if (selectedGroupData) {
        formStep1.setValue('groupDefaultCameraSceneContext', selectedGroupData.defaultCameraSceneContext || '');
        formStep1.setValue('groupDefaultAiDetectionTarget', selectedGroupData.defaultAiDetectionTarget || '');
        formStep1.setValue('groupDefaultAlertEvents', (selectedGroupData.defaultAlertEvents || []).join(', '));
        formStep1.setValue('groupDefaultVideoChunksValue', selectedGroupData.defaultVideoChunks?.value?.toString() || '10');
        formStep1.setValue('groupDefaultVideoChunksUnit', selectedGroupData.defaultVideoChunks?.unit || 'seconds');
        formStep1.setValue('groupDefaultNumFrames', selectedGroupData.defaultNumFrames?.toString() || '5');
        formStep1.setValue('groupDefaultVideoOverlapValue', selectedGroupData.defaultVideoOverlap?.value?.toString() || '2');
        formStep1.setValue('groupDefaultVideoOverlapUnit', selectedGroupData.defaultVideoOverlap?.unit || 'seconds');

        formStep3.reset({ // Pre-fill step 3 based on group
            cameraSceneContext: selectedGroupData.defaultCameraSceneContext || '',
            aiDetectionTarget: selectedGroupData.defaultAiDetectionTarget || '',
            alertEvents: (selectedGroupData.defaultAlertEvents || []).join(', '),
            videoChunksValue: selectedGroupData.defaultVideoChunks?.value?.toString() || '10',
            videoChunksUnit: selectedGroupData.defaultVideoChunks?.unit || 'seconds',
            numFrames: selectedGroupData.defaultNumFrames?.toString() || '5',
            videoOverlapValue: selectedGroupData.defaultVideoOverlap?.value?.toString() || '2',
            videoOverlapUnit: selectedGroupData.defaultVideoOverlap?.unit || 'seconds',
        });
      } else {
        formStep1.resetField('groupDefaultCameraSceneContext');
        formStep1.resetField('groupDefaultAiDetectionTarget');
        formStep1.resetField('groupDefaultAlertEvents');
        formStep3.reset(); // Reset step 3 if no group selected
      }
    }
  };

  const onSubmitStep1: SubmitHandler<AddCameraStep1Values> = async (data_step1_form) => {
    if (!formStep1.formState.isValid) return;
    setIsProcessingStep1Submitting(true);

    setCurrentRtspUrlForSnapshot(data_step1_form.rtspUrl);

    // Clear previous snapshot data before moving to Step 2
    setSnapshotGcsObjectName(null);
    setDisplayableSnapshotUrl(null);
    setSnapshotResolution(null);
    setIsLoadingSnapshotUrl(false);
    setIsProcessingStep2Snapshot(true); // Start processing immediately for step 2

    formStep2.reset({}); // Reset step 2 form as sceneDescription is removed

    setIsProcessingStep1Submitting(false);
    setDrawerStep(2);
  };

  useEffect(() => {
    const fetchSnapshotAndDetails = async () => {
      if (drawerStep === 2 && currentRtspUrlForSnapshot && !snapshotGcsObjectName && !isProcessingStep2Snapshot && !isLoadingSnapshotUrl) {
        setIsProcessingStep2Snapshot(true);
        setSnapshotGcsObjectName(null);
        setDisplayableSnapshotUrl(null);
        setSnapshotResolution(null);

        try {
          const auth = getAuth();
          const user = auth.currentUser;
          if (!user) {
            toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in." });
            setIsProcessingStep2Snapshot(false);
            return;
          }
          const idToken = await user.getIdToken();

          const snapshotServiceUrl = process.env.NEXT_PUBLIC_TAKE_SNAPSHOT_URL;
          if (!snapshotServiceUrl) {
            throw new Error("Snapshot service URL is not configured.");
          }

          console.log(`Calling snapshot service at: ${snapshotServiceUrl} for RTSP: ${currentRtspUrlForSnapshot}`);

          const snapshotResponse = await fetch(snapshotServiceUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ rtsp_url: currentRtspUrlForSnapshot }),
            signal: AbortSignal.timeout(45000)
          });

          let errorMessageText = `Failed to get snapshot details (status: ${snapshotResponse.status})`;
          if (!snapshotResponse.ok) {
            try {
                const errorData = await snapshotResponse.json();
                console.error("Snapshot service error response:", errorData);
                errorMessageText = errorData.message || errorData.error || errorMessageText;
            } catch (e) { /* Ignore if response isn't JSON */ }
             throw new Error(errorMessageText);
          }

          const snapshotData = await snapshotResponse.json();
          if (snapshotData.status === 'success' && snapshotData.gcsObjectName && snapshotData.resolution) {
            setSnapshotGcsObjectName(snapshotData.gcsObjectName);
            setSnapshotResolution(snapshotData.resolution);
          } else {
            throw new Error(snapshotData.message || "Snapshot API call succeeded but returned invalid data (gcsObjectName/resolution).");
          }
        } catch (error: any) {
          console.error("Error fetching snapshot GCS object name in Step 2:", error);
          toast({
            variant: "destructive",
            title: "Snapshot Error",
            description: error.message || "Could not retrieve camera snapshot details.",
          });
          setSnapshotGcsObjectName(null);
          setSnapshotResolution(null);
        } finally {
          setIsProcessingStep2Snapshot(false);
        }
      }
    };
    fetchSnapshotAndDetails();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerStep, currentRtspUrlForSnapshot]); // Trigger when step becomes 2 and RTSP URL is set


  useEffect(() => {
    const fetchDisplayableSnapshotUrl = async () => {
        if (drawerStep === 2 && snapshotGcsObjectName && !displayableSnapshotUrl && !isLoadingSnapshotUrl && !isProcessingStep2Snapshot) {
            setIsLoadingSnapshotUrl(true);
            try {
                const retrieveSnapshotServiceUrl = process.env.NEXT_PUBLIC_RETRIEVE_SNAPSHOT_URL;
                if (!retrieveSnapshotServiceUrl) {
                    throw new Error("Retrieve snapshot URL service is not configured.");
                }

                const auth = getAuth();
                const user = auth.currentUser;
                if (!user) throw new Error("User not authenticated for retrieving snapshot URL.");
                const idToken = await user.getIdToken();

                console.log(`Calling retrieve snapshot service at: ${retrieveSnapshotServiceUrl} for GCS Object: ${snapshotGcsObjectName}`);

                const signedUrlResponse = await fetch(retrieveSnapshotServiceUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                    body: JSON.stringify({ gcsObjectName: snapshotGcsObjectName }),
                    signal: AbortSignal.timeout(15000)
                });

                let errorMessageText = `Failed to get signed URL (status: ${signedUrlResponse.status})`;
                if (!signedUrlResponse.ok) {
                    try {
                        const errorData = await signedUrlResponse.json();
                        console.error("Retrieve snapshot URL service error:", errorData);
                        errorMessageText = errorData.message || errorData.error || errorMessageText;
                    } catch (e) { /* Ignore if response isn't JSON */ }
                    throw new Error(errorMessageText);
                }

                const signedUrlData = await signedUrlResponse.json();
                if (signedUrlData.status === 'success' && signedUrlData.signedUrl) {
                    setDisplayableSnapshotUrl(signedUrlData.signedUrl);
                } else {
                    throw new Error(signedUrlData.message || "Failed to get signed URL from service.");
                }
            } catch (error: any) {
                console.error("Error retrieving displayable snapshot URL:", error);
                toast({ variant: "destructive", title: "Snapshot Display Error", description: error.message || "Could not load snapshot image." });
                setDisplayableSnapshotUrl(null);
            } finally {
                setIsLoadingSnapshotUrl(false);
            }
        }
    };
    fetchDisplayableSnapshotUrl();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerStep, snapshotGcsObjectName, isProcessingStep2Snapshot]);


  const handleStep2Back = () => {
    setDrawerStep(1);
  };

  const onSubmitStep2: SubmitHandler<AddCameraStep2Values> = async (data_step2_form) => {
    // Step 2 form is now empty, so validation always passes if schema is empty.
    // We mainly proceed to Step 3, pre-filling its form based on Step 1's group choices.

    const step1Values = formStep1.getValues();
    let finalCameraContext = ''; // Initialize with empty string
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
            finalCameraContext = selectedGroupData.defaultCameraSceneContext || '';
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
        finalCameraContext = step1Values.groupDefaultCameraSceneContext || '';
        finalAiTarget = step1Values.groupDefaultAiDetectionTarget || '';
        finalAlertEvents = step1Values.groupDefaultAlertEvents || '';
        if(step1Values.groupDefaultVideoChunksValue) finalVideoChunksValue = step1Values.groupDefaultVideoChunksValue;
        if(step1Values.groupDefaultVideoChunksUnit) finalVideoChunksUnit = step1Values.groupDefaultVideoChunksUnit;
        if(step1Values.groupDefaultNumFrames) finalNumFrames = step1Values.groupDefaultNumFrames;
        if(step1Values.groupDefaultVideoOverlapValue) finalVideoOverlapValue = step1Values.groupDefaultVideoOverlapValue;
        if(step1Values.groupDefaultVideoOverlapUnit) finalVideoOverlapUnit = step1Values.groupDefaultVideoOverlapUnit;
    }

    formStep3.reset({
        cameraSceneContext: finalCameraContext,
        aiDetectionTarget: finalAiTarget,
        alertEvents: finalAlertEvents,
        videoChunksValue: finalVideoChunksValue,
        videoChunksUnit: finalVideoChunksUnit,
        numFrames: finalNumFrames,
        videoOverlapValue: finalVideoOverlapValue,
        videoOverlapUnit: finalVideoOverlapUnit,
    });

    setDrawerStep(3);
  };


  const handleStep3Back = () => {
      setDrawerStep(2);
  };

  const getEffectiveServerUrl = useCallback(async (orgIdParam: string | null): Promise<string | null> => {
    if (!orgIdParam) {
        console.warn("getEffectiveServerUrl: orgIdParam is null, cannot determine organization default.");
        const systemDefaultServerQuery = query(collection(db, 'servers'), where('isSystemDefault', '==', true), limit(1));
        const systemDefaultSnapshot = await getDocs(systemDefaultServerQuery);
        if (!systemDefaultSnapshot.empty) {
            const systemDefaultServerData = systemDefaultSnapshot.docs[0].data();
            if (systemDefaultServerData.status === 'online' && systemDefaultServerData.ipAddressWithPort && systemDefaultServerData.protocol) {
                console.log("Using System Default Server (orgId was null):", `${systemDefaultServerData.protocol}://${systemDefaultServerData.ipAddressWithPort}`);
                return `${systemDefaultServerData.protocol}://${systemDefaultServerData.ipAddressWithPort}`;
            }
        }
        toast({ variant: "destructive", title: "No Server Available", description: "No system default processing server is currently online or configured."});
        return null;
    }

    try {
      const orgDocRef = doc(db, 'organizations', orgIdParam);
      const orgDocSnap = await getDoc(orgDocRef);
      let serverUrlToUse: string | null = null;

      if (orgDocSnap.exists()) {
        const orgData = orgDocSnap.data();
        if (orgData.orgDefaultServerId) {
          const serverDocRef = doc(db, 'servers', orgData.orgDefaultServerId);
          const serverDocSnap = await getDoc(serverDocRef);
          if (serverDocSnap.exists()) {
            const serverData = serverDocSnap.data();
            if (serverData.status === 'online' && serverData.ipAddressWithPort && serverData.protocol) {
              serverUrlToUse = `${serverData.protocol}://${serverData.ipAddressWithPort}`;
              console.log("Using Org Default Server:", serverUrlToUse);
            } else {
              console.warn(`Org default server ${orgData.orgDefaultServerId} is not online or misconfigured. Falling back.`);
            }
          } else {
            console.warn(`Org default server ${orgData.orgDefaultServerId} not found. Falling back.`);
          }
        }
      } else {
        console.warn(`Organization document ${orgIdParam} not found. Falling back to system default.`);
      }

      if (!serverUrlToUse) {
        const systemDefaultServerQuery = query(collection(db, 'servers'), where('isSystemDefault', '==', true), limit(1));
        const systemDefaultSnapshot = await getDocs(systemDefaultServerQuery);
        if (!systemDefaultSnapshot.empty) {
          const systemDefaultServerData = systemDefaultSnapshot.docs[0].data();
          if (systemDefaultServerData.status === 'online' && systemDefaultServerData.ipAddressWithPort && systemDefaultServerData.protocol) {
            serverUrlToUse = `${systemDefaultServerData.protocol}://${systemDefaultServerData.ipAddressWithPort}`;
            console.log("Using System Default Server (fallback):", serverUrlToUse);
          } else {
            console.warn(`System default server ${systemDefaultSnapshot.docs[0].id} is not online or misconfigured.`);
          }
        }
      }

      if (serverUrlToUse) {
        return serverUrlToUse;
      }

      if (!currentUser?.email?.endsWith('@octavision.com')) {
        toast({ variant: "destructive", title: "No Server Available", description: "No suitable processing server (org default or system default) is currently online."});
      }
      return null;

    } catch (error) {
      console.error("Error fetching effective server URL:", error);
      toast({ variant: "destructive", title: "Server Fetch Error", description: "Could not determine default server information."});
      return null;
    }
  }, [toast, currentUser]);


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
    // Step 2 data (sceneDescription) is no longer used here for saving

    let effectiveServerUrlValue: string | null = null;
    try {
        effectiveServerUrlValue = await getEffectiveServerUrl(orgId);
        if (!effectiveServerUrlValue && !currentUser.email?.endsWith('@octavision.com')) {
            return;
        }
    } catch (error) {
        return;
    }

    const batch = writeBatch(db);
    const now = serverTimestamp() as Timestamp;
    let finalGroupId: string | null = null;

    if (step1Data.group === 'add_new_group' && step1Data.newGroupName) {
        const groupDocRef = doc(collection(db, 'groups'));
        finalGroupId = groupDocRef.id;
        const newGroup: Omit<Group, 'id'> & {createdAt:Timestamp, updatedAt: Timestamp} = {
            name: step1Data.newGroupName,
            orgId: orgId,
            userId: currentUser.uid,
            createdAt: now,
            updatedAt: now,
            cameras: [],
            videos: [],
            defaultCameraSceneContext: step1Data.groupDefaultCameraSceneContext || null,
            defaultAiDetectionTarget: step1Data.groupDefaultAiDetectionTarget || null,
            defaultAlertEvents: step1Data.groupDefaultAlertEvents ? step1Data.groupDefaultAlertEvents.split(',').map(ae => ae.trim()).filter(ae => ae) : null,
            defaultVideoChunks: step1Data.groupDefaultVideoChunksValue ? { value: parseFloat(step1Data.groupDefaultVideoChunksValue), unit: step1Data.groupDefaultVideoChunksUnit || 'seconds' } : null,
            defaultNumFrames: step1Data.groupDefaultNumFrames ? parseInt(step1Data.groupDefaultNumFrames, 10) : null,
            defaultVideoOverlap: step1Data.groupDefaultVideoOverlapValue ? { value: parseFloat(step1Data.groupDefaultVideoOverlapValue), unit: step1Data.groupDefaultVideoOverlapUnit || 'seconds' } : null,
        };
        batch.set(groupDocRef, newGroup);
        setGroups(prev => [...prev, { ...newGroup, id: groupDocRef.id, createdAt: now, updatedAt: now }]);
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
      currentConfigId: configDocRef.id,
      processingStatus: "waiting_for_approval",
      snapshotGcsObjectName: snapshotGcsObjectName,
      resolution: snapshotResolution,
    });

    batch.set(configDocRef, {
      sourceId: cameraDocRef.id,
      sourceType: "camera",
      serverIpAddress: effectiveServerUrlValue,
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
      // sceneDescription from formStep2 is removed here
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
        imageUrl: displayableSnapshotUrl, // Use the GCS signed URL for immediate UI update
        dataAiHint: configData.aiDetectionTarget || 'newly added camera',
        processingStatus: "waiting_for_approval",
        resolution: snapshotResolution || undefined,
        snapshotGcsObjectName: snapshotGcsObjectName,
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
      avatar: 'https://placehold.co/50x50.png?data-ai-hint=user+avatar',
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
        const response = await generateGroupAlertEvents({ aiDetectionTarget: detectionTarget, language });
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
                            <FormLabel className="text-sm font-medium text-muted-foreground col-span-full">Group Default Video Config:</FormLabel>
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
                 {(isProcessingStep2Snapshot || isLoadingSnapshotUrl) ? (
                    <div className="w-full aspect-video bg-muted rounded-md flex flex-col items-center justify-center text-center p-4">
                        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                        <p className="text-sm text-muted-foreground">
                           {isProcessingStep2Snapshot ? "Connecting to camera and extracting snapshot..." : "Loading snapshot image..."}
                        </p>
                        <p className="text-xs text-muted-foreground">This may take a moment.</p>
                    </div>
                ) : displayableSnapshotUrl ? (
                    <Image
                    src={displayableSnapshotUrl}
                    alt="Camera Snapshot"
                    width={400}
                    height={300}
                    className="rounded-md border object-cover aspect-video w-full"
                    data-ai-hint="camera snapshot"
                    unoptimized
                    />
                ) : (
                     <div className="w-full aspect-video bg-muted rounded-md flex flex-col items-center justify-center text-center p-4">
                        <CameraIconLucide className="h-12 w-12 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Could not retrieve snapshot.</p>
                        <p className="text-xs text-muted-foreground">Check RTSP URL and network or try again. You can proceed to the next step to configure AI settings.</p>
                    </div>
                )}
                {/* sceneDescription field removed from here */}
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
                                        <Textarea
                                            placeholder="e.g., Monitors the main entrance and exit points for security."
                                            {...field}
                                            rows={3}
                                        />
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
                                        <Textarea
                                            placeholder="e.g., Detect unauthorized personnel, loitering, package theft."
                                            {...field}
                                            rows={3}
                                        />
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
                    disabled={isProcessingStep1Submitting || !formStep1.formState.isValid}
                >
                    {isProcessingStep1Submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Next
                </Button>
            </div>
        );
        } else if (drawerStep === 2) {
        return (
            <div className="flex justify-between p-4 border-t">
                <Button variant="outline" onClick={handleStep2Back} disabled={isProcessingStep2Snapshot || isLoadingSnapshotUrl}>Back</Button>
                <Button
                    type="submit"
                    form="add-camera-form-step2"
                    disabled={isProcessingStep2Snapshot || isLoadingSnapshotUrl || formStep2.formState.isSubmitting}
                >
                    {(formStep2.formState.isSubmitting) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
                    <AvatarImage src="https://placehold.co/50x50.png?data-ai-hint=user+avatar" alt="User" data-ai-hint="user avatar" />
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
          {/* Placeholder for group filter or breadcrumbs */}
        </div>
        <div className="flex flex-wrap items-center space-x-2 sm:space-x-2 gap-y-2 justify-end">
          <Button onClick={handleAddCameraClick}>
            <Plus className="mr-2 h-4 w-4" /> Add Camera
          </Button>
          <Button variant="outline">
            <Folder className="mr-2 h-4 w-4" /> Group
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
                    {camera.imageUrl ? (
                        <Image
                        src={camera.imageUrl}
                        alt={camera.cameraName}
                        width={200}
                        height={150}
                        className="rounded-t-lg aspect-video w-full object-cover"
                        data-ai-hint={camera.dataAiHint}
                        unoptimized
                        />
                    ) : (
                        <div className="rounded-t-lg aspect-video w-full object-cover bg-muted flex items-center justify-center">
                            <CameraIconLucide className="w-12 h-12 text-muted-foreground" />
                        </div>
                    )}
                    {camera.processingStatus === 'running_normal' ? (
                        <CheckCircle className="absolute top-2 right-2 h-5 w-5 text-green-500 bg-white rounded-full p-0.5" />
                    ) : camera.processingStatus === 'waiting_for_approval' ? (
                         <Clock className="absolute top-2 right-2 h-5 w-5 text-orange-500 bg-white rounded-full p-0.5" />
                    ) : (
                        <AlertTriangleIcon className="absolute top-2 right-2 h-5 w-5 text-red-500 bg-white rounded-full p-0.5" />
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
                                <Settings2 className="w-3 h-3" />
                                <span>Config</span>
                            </div>
                            </TooltipTrigger>
                            <TooltipContent>
                            <p>View/Edit Configuration</p>
                            </TooltipContent>
                        </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center space-x-1 cursor-pointer hover:text-destructive">
                                    <ShieldAlert className="w-3 h-3 text-destructive" />
                                    <span>2</span> {/* Placeholder for active alerts count */}
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

