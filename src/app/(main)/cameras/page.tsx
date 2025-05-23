
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
import { AlertCircle as AlertCircleIconLucide, AlertTriangle as AlertTriangleIcon, ArrowUpDown, BarChart, Bell, Bot, CalendarDays, Camera as CameraIconLucide, CheckCircle, Clock, Diamond, Edit3, Eye, EyeOff, Film, Folder, HelpCircle, ListFilter, Loader2, MessageSquare, MoreHorizontal, Plus, Send, Server, Settings2, ShieldAlert, Sparkles, Users, Video, Wand2, XCircle } from 'lucide-react';
import RightDrawer from '@/components/RightDrawer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useNotificationDrawer } from '@/contexts/NotificationDrawerContext';
import { useToast } from '@/hooks/use-toast';
import { generateGroupAlertEvents } from '@/ai/flows/generate-group-alert-events';
import { describeImage } from '@/ai/flows/describe-image-flow';
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
  imageUrl?: string;
  snapshotGcsObjectName?: string | null;
  resolution?: string | null;
  dataAiHint: string;
  processingStatus?: string;
  rtspUsername?: string | null;
  rtspPassword?: string | null;
}

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: Date;
  avatar?: string;
}


const addCameraStep1Schema = z.object({
  rtspUrl: z.string().min(1, "RTSP URL is required.").refine(value => {
    try {
      return value.toLowerCase().startsWith('rtsp://');
    } catch (e) {
      return false;
    }
  }, { message: "Invalid RTSP URL format. Must start with rtsp://" }),
  rtspUsername: z.string().optional(),
  rtspPassword: z.string().optional(),
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
  sceneDescription: z.string().optional(),
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

  const [isProcessingStep1Submitting, setIsProcessingStep1Submitting] = useState(false);
  const [isProcessingStep2Snapshot, setIsProcessingStep2Snapshot] = useState(false);

  const [currentRtspUrlForSnapshot, setCurrentRtspUrlForSnapshot] = useState<string | null>(null);
  const [snapshotGcsObjectName, setSnapshotGcsObjectName] = useState<string | null>(null);
  const [displayableSnapshotUrl, setDisplayableSnapshotUrl] = useState<string | null>(null);
  const [snapshotResolution, setSnapshotResolution] = useState<string | null>(null);
  const [isLoadingSnapshotUrl, setIsLoadingSnapshotUrl] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [showRtspPassword, setShowRtspPassword] = useState(false);


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
  const newGroupNameInputRef = useRef<HTMLInputElement>(null);


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
          const retrieveSnapshotUrl = process.env.NEXT_PUBLIC_RETRIEVE_SNAPSHOT_URL;
          if (!retrieveSnapshotUrl) {
            console.error("Retrieve snapshot service URL (NEXT_PUBLIC_RETRIEVE_SNAPSHOT_URL) is not configured for camera list.");
          } else {
              const auth = getAuth();
              const user = auth.currentUser;
              if (user) {
                  const idToken = await user.getIdToken();
                  try {
                    console.log(`Frontend: Attempting to call /retrieve-snapshot for camera list item: ${data.snapshotGcsObjectName}`);
                    const response = await fetch(retrieveSnapshotUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${idToken}`
                        },
                        body: JSON.stringify({ gcsObjectName: data.snapshotGcsObjectName }),
                    });
                    if (response.ok) {
                        const resData = await response.json();
                        if (resData.status === 'success' && resData.signedUrl) {
                            imageUrlToDisplay = resData.signedUrl;
                        } else {
                            console.warn(`Failed to retrieve signed URL for ${data.snapshotGcsObjectName} in list (API success but no URL): ${resData.message || 'Unknown error'}`);
                        }
                    } else {
                        const errorText = await response.text();
                        console.warn(`Failed to retrieve image for ${data.snapshotGcsObjectName} in list (API error): ${response.status} - ${errorText}`);
                    }
                  } catch (e: any) {
                      console.warn(`Error fetching signed URL for ${data.snapshotGcsObjectName} in list:`, e.message);
                  }
              }
          }
        }
        return {
          id: docSnapshot.id,
          cameraName: data.cameraName,
          imageUrl: imageUrlToDisplay,
          dataAiHint: data.aiDetectionTarget || 'camera security',
          processingStatus: data.processingStatus,
          resolution: data.resolution || null,
          snapshotGcsObjectName: data.snapshotGcsObjectName || null,
          rtspUsername: data.rtspUsername || null,
          rtspPassword: data.rtspPassword || null,
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
      rtspUsername: '',
      rtspPassword: '',
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

  const watchedRtspUrl = formStep1.watch('rtspUrl');

  useEffect(() => {
    if (watchedRtspUrl) {
      try {
        const url = new URL(watchedRtspUrl); // This might throw an error if the URL is invalid
        formStep1.setValue('rtspUsername', decodeURIComponent(url.username) || '', { shouldValidate: true });
        formStep1.setValue('rtspPassword', decodeURIComponent(url.password) || '', { shouldValidate: true });
      } catch (error) {
        // If URL parsing fails, clear fields only if they haven't been manually dirtied by the user
        // and are not empty (to avoid clearing intentional empty manual input).
        if (!formStep1.formState.dirtyFields.rtspUsername && formStep1.getValues('rtspUsername') !== '') {
          formStep1.setValue('rtspUsername', '', { shouldValidate: true });
        }
        if (!formStep1.formState.dirtyFields.rtspPassword && formStep1.getValues('rtspPassword') !== '') {
          formStep1.setValue('rtspPassword', '', { shouldValidate: true });
        }
        console.warn("Could not parse RTSP URL for username/password, or URL is invalid:", error);
      }
    } else {
      // If RTSP URL is cleared, also clear username/password if not manually edited
      if (!formStep1.formState.dirtyFields.rtspUsername) formStep1.setValue('rtspUsername', '', { shouldValidate: true });
      if (!formStep1.formState.dirtyFields.rtspPassword) formStep1.setValue('rtspPassword', '', { shouldValidate: true });
    }
  }, [watchedRtspUrl, formStep1]);


  const formStep2 = useForm<AddCameraStep2Values>({
    resolver: zodResolver(addCameraStep2Schema),
    mode: "onChange",
    defaultValues: {
      sceneDescription: '', // Default to empty string
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
    formStep1.reset({
      rtspUrl: '',
      rtspUsername: '',
      rtspPassword: '',
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
    formStep2.reset({ sceneDescription: '' }); // Explicitly reset sceneDescription
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
    setIsGeneratingDescription(false);
    setShowRtspPassword(false);

    setIsProcessingStep1Submitting(false);
    setIsProcessingStep2Snapshot(false);
    setIsLoadingSnapshotUrl(false);
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
      rtspUsername: '',
      rtspPassword: '',
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
    formStep2.reset({ sceneDescription: '' }); // Explicitly reset sceneDescription
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
    setIsGeneratingDescription(false);
    setShowRtspPassword(false);
    setIsProcessingStep1Submitting(false);
    setIsProcessingStep2Snapshot(false);
    setIsLoadingSnapshotUrl(false);
  };

  const handleGroupChange = (value: string) => {
    formStep1.setValue('group', value);
    setSelectedGroup(value);

    let sceneDescForStep2Init = ''; // Crucial: Initialize to empty

    if (value === 'add_new_group') {
      setShowNewGroupForm(true);
      formStep1.setValue('newGroupName', '');
      // When adding a new group, its defaults are used for Step 2 sceneDescription
      sceneDescForStep2Init = formStep1.getValues('groupDefaultCameraSceneContext') || '';
      setTimeout(() => {
          newGroupNameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          newGroupNameInputRef.current?.focus();
      }, 100);
    } else {
      setShowNewGroupForm(false);
      formStep1.setValue('newGroupName', '');
      const selectedGroupData = groups.find(g => g.id === value);
      if (selectedGroupData) {
        // Populate Step 1 group defaults
        formStep1.setValue('groupDefaultCameraSceneContext', selectedGroupData.defaultCameraSceneContext || '');
        formStep1.setValue('groupDefaultAiDetectionTarget', selectedGroupData.defaultAiDetectionTarget || '');
        formStep1.setValue('groupDefaultAlertEvents', (selectedGroupData.defaultAlertEvents || []).join(', '));
        formStep1.setValue('groupDefaultVideoChunksValue', selectedGroupData.defaultVideoChunks?.value?.toString() || '10');
        formStep1.setValue('groupDefaultVideoChunksUnit', selectedGroupData.defaultVideoChunks?.unit || 'seconds');
        formStep1.setValue('groupDefaultNumFrames', selectedGroupData.defaultNumFrames?.toString() || '5');
        formStep1.setValue('groupDefaultVideoOverlapValue', selectedGroupData.defaultVideoOverlap?.value?.toString() || '2');
        formStep1.setValue('groupDefaultVideoOverlapUnit', selectedGroupData.defaultVideoOverlap?.unit || 'seconds');
        // Use this group's default context for Step 2 sceneDescription
        sceneDescForStep2Init = selectedGroupData.defaultCameraSceneContext || '';
      } else {
        // No specific group selected, clear Step 1 group defaults
        formStep1.resetField('groupDefaultCameraSceneContext');
        // ... reset other groupDefault... fields if needed
        sceneDescForStep2Init = ''; // Step 2 sceneDescription should be empty
      }
    }
    formStep2.reset({ sceneDescription: sceneDescForStep2Init }); // Set Step 2 sceneDescription correctly

    // Update Step 3 defaults based on the new group selection
    const step1DataCurrent = formStep1.getValues();
    let sceneContextForStep3 = '';
    let aiTargetForStep3 = '';
    let alertEventsForStep3 = '';
    // ... other Step 3 defaults ...

    if (value && value !== 'add_new_group') {
        const groupData = groups.find(g => g.id === value);
        if (groupData) {
            sceneContextForStep3 = groupData.defaultCameraSceneContext || ''; // Use group's context for Step 3 as well
            aiTargetForStep3 = groupData.defaultAiDetectionTarget || '';
            alertEventsForStep3 = (groupData.defaultAlertEvents || []).join(', ');
            // ... populate other Step 3 defaults from groupData ...
        }
    } else if (value === 'add_new_group') {
        sceneContextForStep3 = step1DataCurrent.groupDefaultCameraSceneContext || '';
        aiTargetForStep3 = step1DataCurrent.groupDefaultAiDetectionTarget || '';
        alertEventsForStep3 = step1DataCurrent.groupDefaultAlertEvents || '';
        // ... populate other Step 3 defaults from step1DataCurrent.groupDefault...
    }

    formStep3.reset({ // Use reset to ensure Step 3 is clean and uses the correct defaults
        cameraSceneContext: sceneContextForStep3,
        aiDetectionTarget: aiTargetForStep3,
        alertEvents: alertEventsForStep3,
        // ... reset other Step 3 fields with their correct defaults ...
        videoChunksValue: step1DataCurrent.groupDefaultVideoChunksValue || '10',
        videoChunksUnit: step1DataCurrent.groupDefaultVideoChunksUnit || 'seconds',
        numFrames: step1DataCurrent.groupDefaultNumFrames || '5',
        videoOverlapValue: step1DataCurrent.groupDefaultVideoOverlapValue || '2',
        videoOverlapUnit: step1DataCurrent.groupDefaultVideoOverlapUnit || 'seconds',
    });
  };

  const handleCancelAddNewGroup = () => {
    setShowNewGroupForm(false);
    formStep1.setValue('group', undefined);
    setSelectedGroup(undefined);
    formStep1.resetField('newGroupName');
    formStep1.resetField('groupDefaultCameraSceneContext');
    formStep1.resetField('groupDefaultAiDetectionTarget');
    formStep1.resetField('groupDefaultAlertEvents');
    // ... reset other group default fields ...
    formStep2.reset({ sceneDescription: '' }); // Ensure Step 2 sceneDescription is cleared
    formStep3.reset({ // Reset Step 3 to base defaults
        cameraSceneContext: '',
        aiDetectionTarget: '',
        alertEvents: '',
        videoChunksValue: '10',
        videoChunksUnit: 'seconds',
        numFrames: '5',
        videoOverlapValue: '2',
        videoOverlapUnit: 'seconds',
    });
  };

  const onSubmitStep1: SubmitHandler<AddCameraStep1Values> = async (data_step1_form) => {
    if (!formStep1.formState.isValid) return;
    
    setCurrentRtspUrlForSnapshot(data_step1_form.rtspUrl);
    setSnapshotGcsObjectName(null);
    setDisplayableSnapshotUrl(null);
    setSnapshotResolution(null);
    setIsGeneratingDescription(false);

    // Initialize sceneDescription for Step 2 based on group defaults from Step 1
    let sceneDescForStep2Init = ''; // Crucial: Initialize to empty
    if (data_step1_form.group && data_step1_form.group !== 'add_new_group') {
        const groupData = groups.find(g => g.id === data_step1_form.group);
        sceneDescForStep2Init = groupData?.defaultCameraSceneContext || '';
    } else if (data_step1_form.group === 'add_new_group') {
        sceneDescForStep2Init = data_step1_form.groupDefaultCameraSceneContext || '';
    }
    formStep2.reset({ sceneDescription: sceneDescForStep2Init }); // Set Step 2 sceneDescription correctly

    // Pre-fill Step 3 based on group defaults from Step 1
    let sceneContextForStep3 = '';
    let aiTargetForStep3 = '';
    let alertEventsForStep3 = '';
    // ... other Step 3 defaults ...

    if (data_step1_form.group && data_step1_form.group !== 'add_new_group') {
        const selectedGroupData = groups.find(g => g.id === data_step1_form.group);
        if (selectedGroupData) {
            sceneContextForStep3 = selectedGroupData.defaultCameraSceneContext || '';
            aiTargetForStep3 = selectedGroupData.defaultAiDetectionTarget || '';
            alertEventsForStep3 = (selectedGroupData.defaultAlertEvents || []).join(', ');
            // ... populate other Step 3 defaults from selectedGroupData ...
        }
    } else if (data_step1_form.group === 'add_new_group') {
        sceneContextForStep3 = data_step1_form.groupDefaultCameraSceneContext || '';
        aiTargetForStep3 = data_step1_form.groupDefaultAiDetectionTarget || '';
        alertEventsForStep3 = data_step1_form.groupDefaultAlertEvents || '';
        // ... populate other Step 3 defaults from data_step1_form.groupDefault...
    }

    formStep3.reset({
        cameraSceneContext: sceneContextForStep3,
        aiDetectionTarget: aiTargetForStep3,
        alertEvents: alertEventsForStep3,
        // ... reset other Step 3 fields to their correct group-derived or base defaults ...
        videoChunksValue: data_step1_form.groupDefaultVideoChunksValue || '10',
        videoChunksUnit: data_step1_form.groupDefaultVideoChunksUnit || 'seconds',
        numFrames: data_step1_form.groupDefaultNumFrames || '5',
        videoOverlapValue: data_step1_form.groupDefaultVideoOverlapValue || '2',
        videoOverlapUnit: data_step1_form.groupDefaultVideoOverlapUnit || 'seconds',
    });

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
            throw new Error("Snapshot service URL (NEXT_PUBLIC_TAKE_SNAPSHOT_URL) is not configured.");
          }

          console.log(`Frontend: Attempting to call ${snapshotServiceUrl} for RTSP: ${currentRtspUrlForSnapshot}`);
          const snapshotResponse = await fetch(snapshotServiceUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ rtsp_url: currentRtspUrlForSnapshot }),
          });

          let errorMessageText = `Snapshot service returned an invalid response format. Status: ${snapshotResponse.status}. Check service logs.`;
          if (!snapshotResponse.ok) {
            try {
                const errorData = await snapshotResponse.json();
                console.error("Snapshot service error response:", errorData);
                errorMessageText = errorData.message || errorData.error || errorMessageText;
            } catch (e) {
                const rawErrorText = await snapshotResponse.text();
                console.error("Snapshot service error: Could not parse JSON response. Response text:", rawErrorText);
                errorMessageText = rawErrorText || errorMessageText;
            }
            throw new Error(errorMessageText);
          }

          const snapshotData = await snapshotResponse.json();
          if (snapshotData.status === 'success' && snapshotData.gcsObjectName && snapshotData.resolution) {
            setSnapshotGcsObjectName(snapshotData.gcsObjectName);
            setSnapshotResolution(snapshotData.resolution);
            toast({ title: "Snapshot Processed", description: "Snapshot captured. Retrieving image..." });
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
  }, [drawerStep, currentRtspUrlForSnapshot, toast, isProcessingStep2Snapshot, snapshotGcsObjectName, isLoadingSnapshotUrl ]);


  useEffect(() => {
    const fetchDisplayableSnapshotUrl = async () => {
        if (drawerStep === 2 && snapshotGcsObjectName && !displayableSnapshotUrl && !isLoadingSnapshotUrl) {
            setIsLoadingSnapshotUrl(true);
            try {
                const retrieveSnapshotUrl = process.env.NEXT_PUBLIC_RETRIEVE_SNAPSHOT_URL;
                if (!retrieveSnapshotUrl) {
                    throw new Error("Retrieve snapshot URL service (NEXT_PUBLIC_RETRIEVE_SNAPSHOT_URL) is not configured.");
                }

                const auth = getAuth();
                const user = auth.currentUser;
                if (!user) throw new Error("User not authenticated for retrieving snapshot URL.");
                const idToken = await user.getIdToken();

                console.log(`Frontend: Attempting to call ${retrieveSnapshotUrl} for Step 2 display: GCS Object: ${snapshotGcsObjectName}`);
                const signedUrlResponse = await fetch(retrieveSnapshotUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                    body: JSON.stringify({ gcsObjectName: snapshotGcsObjectName }),
                });

                let errorMessageText = `Failed to get signed URL. Status: ${signedUrlResponse.status}. Check service logs.`;
                if (!signedUrlResponse.ok) {
                    try {
                        const errorData = await signedUrlResponse.json();
                        console.error("Retrieve snapshot URL service error:", errorData);
                        errorMessageText = errorData.message || errorData.error || errorMessageText;
                    } catch (e) {
                         const rawErrorText = await signedUrlResponse.text();
                        console.error("Retrieve snapshot URL service error: Could not parse JSON response. Response text:", rawErrorText);
                        errorMessageText = rawErrorText || errorMessageText;
                    }
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
  }, [drawerStep, snapshotGcsObjectName, displayableSnapshotUrl, isLoadingSnapshotUrl, toast]);


  const handleStep2Back = () => {
    setDrawerStep(1);
    setCurrentRtspUrlForSnapshot(null);
    setSnapshotGcsObjectName(null);
    setDisplayableSnapshotUrl(null);
    setSnapshotResolution(null);
    setIsProcessingStep2Snapshot(false);
    setIsLoadingSnapshotUrl(false);
    setIsGeneratingDescription(false);
    // formStep2.sceneDescription is reset based on group when returning to step 1 via onSubmitStep1 logic
  };

  const onSubmitStep2: SubmitHandler<AddCameraStep2Values> = async (data_step2_form) => {
    const step1Values = formStep1.getValues();
    const currentSceneDescriptionFromStep2 = data_step2_form.sceneDescription || '';

    let sceneContextForStep3 = '';
    let aiTargetForStep3 = '';
    let alertEventsForStep3 = '';
     // ... other Step 3 defaults ...

    if (step1Values.group && step1Values.group !== 'add_new_group') {
        const selectedGroupData = groups.find(g => g.id === step1Values.group);
        if (selectedGroupData) {
            sceneContextForStep3 = currentSceneDescriptionFromStep2 || selectedGroupData.defaultCameraSceneContext || '';
            aiTargetForStep3 = selectedGroupData.defaultAiDetectionTarget || '';
            alertEventsForStep3 = (selectedGroupData.defaultAlertEvents || []).join(', ');
             // ... populate other Step 3 defaults from selectedGroupData ...
        }
    } else if (step1Values.group === 'add_new_group') {
        sceneContextForStep3 = currentSceneDescriptionFromStep2 || step1Values.groupDefaultCameraSceneContext || '';
        aiTargetForStep3 = step1Values.groupDefaultAiDetectionTarget || '';
        alertEventsForStep3 = step1Values.groupDefaultAlertEvents || '';
         // ... populate other Step 3 defaults from step1Values.groupDefault...
    } else { 
        sceneContextForStep3 = currentSceneDescriptionFromStep2; 
    }
    
    formStep3.reset({
        ...formStep3.getValues(), // Keep existing video chunk/frame defaults
        cameraSceneContext: sceneContextForStep3,
        aiDetectionTarget: aiTargetForStep3,
        alertEvents: alertEventsForStep3,
    });

    setDrawerStep(3);
  };


  const getEffectiveServerUrl = useCallback(async (): Promise<string | null> => {
    if (!currentUser) {
        console.warn("getEffectiveServerUrl: currentUser is null.");
        toast({ variant: "destructive", title: "Authentication Error", description: "User not authenticated."});
        return null;
    }
    const currentOrgId = orgId || (await getDoc(doc(db, 'users', currentUser.uid))).data()?.organizationId;
    if (!currentOrgId) {
        console.warn("getEffectiveServerUrl: orgId is null for current user.");
        toast({ variant: "destructive", title: "Configuration Error", description: "User organization not found."});
        return null;
    }

    try {
      const orgDocRef = doc(db, 'organizations', currentOrgId);
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
        console.warn(`Organization document ${currentOrgId} not found. Falling back.`);
      }

      if (!serverUrlToUse) {
        const systemDefaultServerQuery = query(collection(db, 'servers'), where('isSystemDefault', '==', true), limit(1));
        const systemDefaultSnapshot = await getDocs(systemDefaultServerQuery);
        if (!systemDefaultSnapshot.empty) {
          const serverData = systemDefaultSnapshot.docs[0].data();
          if (serverData.status === 'online' && serverData.ipAddressWithPort && serverData.protocol) {
            serverUrlToUse = `${serverData.protocol}://${serverData.ipAddressWithPort}`;
            console.log("Using System Default Server (fallback):", serverUrlToUse);
          } else {
            console.warn(`System default server ${systemDefaultSnapshot.docs[0].id} is not online or misconfigured.`);
          }
        }
      }

      if (serverUrlToUse) {
        return serverUrlToUse;
      }

      toast({ variant: "destructive", title: "No Server Available", description: "No suitable processing server (org or system default) is currently online or configured."});
      return null;

    } catch (error) {
      console.error("Error fetching effective server URL:", error);
      toast({ variant: "destructive", title: "Server Fetch Error", description: "Could not determine default server information."});
      return null;
    }
  }, [orgId, currentUser, toast]);


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
    // const step2Data = formStep2.getValues(); // sceneDescription is now directly in formStep3 if needed, or not used

    let effectiveServerUrlValue: string | null = null;
    try {
        effectiveServerUrlValue = await getEffectiveServerUrl();
    } catch (error) {
        console.error("Could not determine effective server URL, proceeding with null:", error);
    }

    const batch = writeBatch(db);
    const now = serverTimestamp() as Timestamp;
    let finalGroupId: string | null = null;

    if (step1Data.group === 'add_new_group' && step1Data.newGroupName) {
        const groupDocRef = doc(collection(db, 'groups'));
        finalGroupId = groupDocRef.id;
        const newGroup: Omit<Group, 'id'> = {
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
      rtspUsername: step1Data.rtspUsername || null,
      rtspPassword: step1Data.rtspPassword || null,
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
      sceneDescription: formStep2.getValues().sceneDescription || null, // Get from formStep2
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
        imageUrl: displayableSnapshotUrl,
        snapshotGcsObjectName: snapshotGcsObjectName,
        resolution: snapshotResolution,
        dataAiHint: configData.aiDetectionTarget || 'newly added camera',
        processingStatus: "waiting_for_approval",
        rtspUsername: step1Data.rtspUsername || undefined,
        rtspPassword: step1Data.rtspPassword || undefined,
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

const handleGenerateSceneDescription = async () => {
    if (!displayableSnapshotUrl) {
      toast({ variant: "destructive", title: "Snapshot Missing", description: "Please wait for the snapshot to load or ensure a valid snapshot was taken."});
      return;
    }
    setIsGeneratingDescription(true);
    try {
      console.log("Frontend: Fetching image from GCS URL:", displayableSnapshotUrl);
      const imageResponse = await fetch(displayableSnapshotUrl);
      if (!imageResponse.ok) {
        let errorDetails = `Failed to fetch image for AI description from GCS (status: ${imageResponse.status}).`;
        try {
            const errorJson = await imageResponse.json();
            errorDetails = errorJson.message || errorJson.error || errorDetails;
        } catch (e) { /* ignore if not json */ }
        throw new Error(errorDetails);
      }
      const imageBlob = await imageResponse.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
          const base64data = reader.result as string;
          try {
            const aiDescriptionResponse = await describeImage({ imageDataUri: base64data, language });
            console.log("Frontend: AI Description Response received:", JSON.stringify(aiDescriptionResponse, null, 2));

            const description = aiDescriptionResponse?.description;
            let isLikelyError = false;
            if (typeof description === 'string' && description.trim() !== '') {
              const errorKeywords = ["failed to generate", "no pudo generar", "não conseguiu gerar", "Error:", "failed to communicate"];
              isLikelyError = errorKeywords.some(keyword => description.toLowerCase().includes(keyword.toLowerCase()));
            } else {
              isLikelyError = true; 
            }

            if (!isLikelyError && typeof description === 'string') {
              console.log("Frontend: Attempting to set sceneDescription with:", description);
              formStep2.setValue('sceneDescription', description);
              formStep2.trigger('sceneDescription'); 
              console.log("Frontend: Value of sceneDescription after setValue:", formStep2.getValues('sceneDescription'));
              toast({ title: "AI Scene Description", description: "Scene description generated successfully."})
            } else {
              const descErrorMsg = description || "AI failed to generate a valid description or returned an error.";
              console.error("Frontend: AI Description error or malformed response:", descErrorMsg, aiDescriptionResponse);
              toast({ variant: "destructive", title: "AI Description Failed", description: descErrorMsg });
            }
          } catch (aiError: any) {
             console.error("Frontend: Error calling describeImage Genkit flow:", aiError);
             toast({ variant: "destructive", title: "AI Description Error", description: aiError.message || "Failed to get AI description." });
          } finally {
            setIsGeneratingDescription(false);
          }
      };
      reader.readAsDataURL(imageBlob);
    } catch (fetchError: any) {
        console.error("Error fetching image from GCS for description generation:", fetchError);
        toast({ variant: "destructive", title: "Image Fetch Error for AI", description: fetchError.message || "Could not fetch snapshot for AI analysis. Check GCS bucket CORS settings." });
        setIsGeneratingDescription(false);
    }
  };


  const renderDrawerContent = () => {
    if (drawerType === 'addCamera') {
      if (drawerStep === 1) {
        return (
          <div className="p-6">
            <Form {...formStep1}>
            <form id="add-camera-form-step1" onSubmit={formStep1.handleSubmit(onSubmitStep1)} className="space-y-6">
                <FormField
                control={formStep1.control}
                name="rtspUrl"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="flex items-center">
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
                    name="rtspUsername"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="flex items-center">
                            RTSP Username (Optional)
                        </FormLabel>
                        <FormControl>
                            <Input placeholder="Leave blank if none" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={formStep1.control}
                    name="rtspPassword"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center">
                                RTSP Password (Optional)
                            </FormLabel>
                            <div className="relative">
                                <FormControl>
                                    <Input 
                                        type={showRtspPassword ? "text" : "password"} 
                                        placeholder="Leave blank if none" 
                                        {...field} 
                                        className="pr-10"
                                    />
                                </FormControl>
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => setShowRtspPassword(!showRtspPassword)}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                                >
                                    {showRtspPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    <span className="sr-only">{showRtspPassword ? "Hide password" : "Show password"}</span>
                                </Button>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                control={formStep1.control}
                name="cameraName"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="flex items-center">
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
                    <FormLabel className="flex items-center">
                        <Folder className="w-4 h-4 mr-2 text-muted-foreground"/> Group
                    </FormLabel>
                    <Select onValueChange={handleGroupChange} value={field.value || ''} defaultValue={field.value || ''}>
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
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-semibold text-foreground flex items-center">
                                <Plus className="w-4 h-4 mr-2"/> Add a new group for your cameras or videos
                            </h4>
                            <Button type="button" variant="ghost" size="sm" onClick={handleCancelAddNewGroup} className="text-xs">
                                <XCircle className="w-3 h-3 mr-1"/> Cancel
                            </Button>
                        </div>
                        <FormField
                            control={formStep1.control}
                            name="newGroupName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center">
                                        <Edit3 className="w-4 h-4 mr-2 text-muted-foreground"/>Group Name
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Warehouse Zone 1" {...field} ref={newGroupNameInputRef} />
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
                                    <FormLabel className="flex items-center">
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
                                    <FormLabel className="flex items-center">
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
                                    <FormLabel className="flex items-center justify-between">
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
                           {isProcessingStep2Snapshot ? "Connecting to camera and extracting snapshot..." :
                           (isLoadingSnapshotUrl ? "Loading snapshot image..." : "Processing...")}
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

                <FormField
                    control={formStep2.control}
                    name="sceneDescription"
                    render={({ field }) => {
                         console.log("SceneDescription FormField render, field.value:", field.value, "field.disabled:", isGeneratingDescription);
                         return (
                        <FormItem className="text-left">
                             <div className="flex items-center justify-between">
                                <FormLabel className="flex items-center">
                                    <HelpCircle className="w-4 h-4 mr-2 text-muted-foreground" />
                                    Explain the scene?
                                </FormLabel>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleGenerateSceneDescription}
                                    disabled={!displayableSnapshotUrl || isGeneratingDescription || isProcessingStep2Snapshot || isLoadingSnapshotUrl}
                                >
                                    {isGeneratingDescription ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
                                    Generate
                                </Button>
                            </div>
                            <FormControl>
                                <Textarea
                                    placeholder="e.g., This camera overlooks the main warehouse loading bay, monitoring incoming and outgoing trucks."
                                    {...field} 
                                    value={field.value || ''} 
                                    rows={3}
                                    disabled={isGeneratingDescription} 
                                />
                            </FormControl>
                             {isGeneratingDescription && <p className="text-xs text-muted-foreground mt-1 text-primary">AI is generating a description...</p>}
                            <FormMessage />
                        </FormItem>
                        );
                    }}
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
                             <div className="grid grid-cols-2 gap-x-4">
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
                <Button variant="outline" onClick={handleStep2Back} disabled={isProcessingStep2Snapshot || isLoadingSnapshotUrl || isGeneratingDescription}>Back</Button>
                <Button
                    type="submit"
                    form="add-camera-form-step2"
                    disabled={isProcessingStep2Snapshot || isLoadingSnapshotUrl || isGeneratingDescription || formStep2.formState.isSubmitting || !formStep2.formState.isValid}
                >
                    {(formStep2.formState.isSubmitting) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Next
                </Button>
            </div>
        );
        } else if (drawerStep === 3) {
            return (
                <div className="flex justify-between p-4 border-t">
                    <Button variant="outline" onClick={() => setDrawerStep(2)} >Back</Button>
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

  const handleStep3Back = () => {
    setDrawerStep(2);
  };


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
    

    