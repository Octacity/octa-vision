
'use client';

import type { NextPage } from 'next';
import Image from 'next/image';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, addDoc, collection, serverTimestamp, writeBatch, arrayUnion, updateDoc, Timestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/firebase/firebase';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowUpDown, Bot, Bell, Camera as CameraIconLucide, CheckCircle, Clock, Folder as FolderIcon, ListFilter, Loader2, MessageSquare, MoreHorizontal, Plus, Send, Settings2, ShieldAlert, Video, Wand2, Eye, EyeOff, HelpCircle, XCircle } from 'lucide-react';
import RightDrawer from '@/components/RightDrawer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNotificationDrawer } from '@/contexts/NotificationDrawerContext';
import { useToast } from '@/hooks/use-toast';
import { generateGroupAlertEvents } from '@/ai/flows/generate-group-alert-events';
import { describeImage } from '@/ai/flows/describe-image-flow';
import { useLanguage } from '@/contexts/LanguageContext';

import type { Group, Camera, ChatMessage, AddCameraStep1Values, AddCameraStep2Values, AddCameraStep3Values } from './types';
import { addCameraStep1Schema, addCameraStep2Schema, addCameraStep3Schema } from './types';

import AddCameraStep1Form from '@/components/cameras/AddCameraStep1Form';
import AddCameraStep2Form from '@/components/cameras/AddCameraStep2Form';
import AddCameraStep3Form from '@/components/cameras/AddCameraStep3Form';
import CameraChatDrawerContent from '@/components/cameras/CameraChatDrawerContent';
import CameraCard from '@/components/cameras/CameraCard';


const CamerasPage: NextPage = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<'addCamera' | 'chatCamera' | null>(null);
  const [drawerStep, setDrawerStep] = useState(1);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);
  const [showNewGroupForm, setShowNewGroupForm] = useState(false);

  const [isProcessingStep1Submitting, setIsProcessingStep1Submitting] = useState(false); // Used for Step 1 form submission to Next
  const [isProcessingStep2, setIsProcessingStep2] = useState(false); // Used for snapshot capture process in Step 2

  const [currentRtspUrlForSnapshot, setCurrentRtspUrlForSnapshot] = useState<string | null>(null);
  const [rtspUrlUsedForLastSnapshot, setRtspUrlUsedForLastSnapshot] = useState<string | null>(null); // To track if RTSP URL changed
  
  const [snapshotGcsObjectName, setSnapshotGcsObjectName] = useState<string | null>(null);
  const [displayableSnapshotUrl, setDisplayableSnapshotUrl] = useState<string | null>(null);
  const [snapshotResolution, setSnapshotResolution] = useState<string | null>(null);
  const [isLoadingSnapshotUrl, setIsLoadingSnapshotUrl] = useState(false); // For fetching signed URL
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

        if (data.snapshotGcsObjectName && process.env.NEXT_PUBLIC_RETRIEVE_SNAPSHOT_URL) {
          const auth = getAuth();
          const user = auth.currentUser;
          if (user) {
            const idToken = await user.getIdToken();
            try {
              console.log(`Frontend: Attempting to call /retrieve-snapshot for camera list item: ${data.snapshotGcsObjectName}`);
              const response = await fetch(process.env.NEXT_PUBLIC_RETRIEVE_SNAPSHOT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
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
        } else if (!process.env.NEXT_PUBLIC_RETRIEVE_SNAPSHOT_URL) {
          console.error("Retrieve snapshot service URL (NEXT_PUBLIC_RETRIEVE_SNAPSHOT_URL) is not configured for camera list.");
        }
        return {
          id: docSnapshot.id,
          cameraName: data.cameraName,
          imageUrl: imageUrlToDisplay,
          snapshotGcsObjectName: data.snapshotGcsObjectName || null,
          resolution: data.resolution || null,
          dataAiHint: data.aiDetectionTarget || 'camera security', // Assuming aiDetectionTarget is on camera doc, or use config
          processingStatus: data.processingStatus,
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
      rtspUrl: '', rtspUsername: '', rtspPassword: '', cameraName: '', group: undefined, newGroupName: '',
      groupDefaultCameraSceneContext: '', groupDefaultAiDetectionTarget: '', groupDefaultAlertEvents: '',
      groupDefaultVideoChunksValue: '10', groupDefaultVideoChunksUnit: 'seconds', groupDefaultNumFrames: '5',
      groupDefaultVideoOverlapValue: '2', groupDefaultVideoOverlapUnit: 'seconds',
    },
  });

  const watchedRtspUrl = formStep1.watch('rtspUrl');

  useEffect(() => {
    if (watchedRtspUrl) {
      try {
        const url = new URL(watchedRtspUrl);
        formStep1.setValue('rtspUsername', decodeURIComponent(url.username) || '', { shouldValidate: true });
        formStep1.setValue('rtspPassword', decodeURIComponent(url.password) || '', { shouldValidate: true });
      } catch (error) {
        if (!formStep1.formState.dirtyFields.rtspUsername && formStep1.getValues('rtspUsername') !== '') {
          formStep1.setValue('rtspUsername', '', { shouldValidate: true });
        }
        if (!formStep1.formState.dirtyFields.rtspPassword && formStep1.getValues('rtspPassword') !== '') {
          formStep1.setValue('rtspPassword', '', { shouldValidate: true });
        }
      }
    } else {
      if (!formStep1.formState.dirtyFields.rtspUsername) formStep1.setValue('rtspUsername', '', { shouldValidate: true });
      if (!formStep1.formState.dirtyFields.rtspPassword) formStep1.setValue('rtspPassword', '', { shouldValidate: true });
    }
  }, [watchedRtspUrl, formStep1]);

  const formStep2 = useForm<AddCameraStep2Values>({
    resolver: zodResolver(addCameraStep2Schema),
    mode: "onChange",
    defaultValues: { sceneDescription: '' },
  });

  const formStep3 = useForm<AddCameraStep3Values>({
    resolver: zodResolver(addCameraStep3Schema),
    mode: "onChange",
    defaultValues: {
      cameraSceneContext: '', aiDetectionTarget: '', alertEvents: '',
      videoChunksValue: '10', videoChunksUnit: 'seconds', numFrames: '5',
      videoOverlapValue: '2', videoOverlapUnit: 'seconds',
    }
  });

  const handleAddCameraClick = () => {
    formStep1.reset({
      rtspUrl: '', rtspUsername: '', rtspPassword: '', cameraName: '', group: undefined, newGroupName: '',
      groupDefaultCameraSceneContext: '', groupDefaultAiDetectionTarget: '', groupDefaultAlertEvents: '',
      groupDefaultVideoChunksValue: '10', groupDefaultVideoChunksUnit: 'seconds', groupDefaultNumFrames: '5',
      groupDefaultVideoOverlapValue: '2', groupDefaultVideoOverlapUnit: 'seconds',
    });
    formStep2.reset({ sceneDescription: '' });
    formStep3.reset({
      cameraSceneContext: '', aiDetectionTarget: '', alertEvents: '',
      videoChunksValue: '10', videoChunksUnit: 'seconds', numFrames: '5',
      videoOverlapValue: '2', videoOverlapUnit: 'seconds',
    });

    setDrawerType('addCamera'); setDrawerStep(1); setIsDrawerOpen(true);
    setShowNewGroupForm(false); setSelectedGroup(undefined);
    setCurrentRtspUrlForSnapshot(null); 
    setRtspUrlUsedForLastSnapshot(null); // Reset for conditional snapshot fetching
    setSnapshotGcsObjectName(null);
    setDisplayableSnapshotUrl(null); setSnapshotResolution(null);
    setIsGeneratingDescription(false); setShowRtspPassword(false);
    setIsProcessingStep1Submitting(false); setIsProcessingStep2(false); setIsLoadingSnapshotUrl(false);
  };

  const handleChatIconClick = (camera: Camera) => {
    setSelectedCameraForChat(camera); setDrawerType('chatCamera');
    setChatMessages([{ id: 'ai-initial-' + camera.id, sender: 'ai', text: translate('chat.initialMessage', { cameraName: camera.cameraName }), timestamp: new Date(), avatar: undefined }]);
    setCurrentChatMessage(''); setIsDrawerOpen(true);
  };

  const handleNotificationIconClick = (cameraId: string) => {
    openNotificationDrawer(cameraId);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false); setDrawerType(null); setShowNewGroupForm(false); setDrawerStep(1);
    formStep1.reset({
      rtspUrl: '', rtspUsername: '', rtspPassword: '', cameraName: '', group: undefined, newGroupName: '',
      groupDefaultCameraSceneContext: '', groupDefaultAiDetectionTarget: '', groupDefaultAlertEvents: '',
      groupDefaultVideoChunksValue: '10', groupDefaultVideoChunksUnit: 'seconds', groupDefaultNumFrames: '5',
      groupDefaultVideoOverlapValue: '2', groupDefaultVideoOverlapUnit: 'seconds',
    });
    formStep2.reset({ sceneDescription: '' });
    formStep3.reset({
      cameraSceneContext: '', aiDetectionTarget: '', alertEvents: '',
      videoChunksValue: '10', videoChunksUnit: 'seconds', numFrames: '5',
      videoOverlapValue: '2', videoOverlapUnit: 'seconds',
    });
    setSelectedCameraForChat(null); setChatMessages([]);
    setCurrentRtspUrlForSnapshot(null); 
    setRtspUrlUsedForLastSnapshot(null); // Reset for conditional snapshot fetching
    setSnapshotGcsObjectName(null);
    setDisplayableSnapshotUrl(null); setSnapshotResolution(null);
    setIsGeneratingDescription(false); setShowRtspPassword(false);
    setIsProcessingStep1Submitting(false); setIsProcessingStep2(false); setIsLoadingSnapshotUrl(false);
  };

  const handleGroupChange = (value: string) => {
    formStep1.setValue('group', value); setSelectedGroup(value);
    let sceneDescForStep2Init = '';
    let sceneContextForStep3 = ''; let aiTargetForStep3 = ''; let alertEventsForStep3 = '';
    const currentStep1Defaults = formStep1.getValues();
    let videoChunksValueForStep3 = currentStep1Defaults.groupDefaultVideoChunksValue || '10';
    let videoChunksUnitForStep3 = currentStep1Defaults.groupDefaultVideoChunksUnit || 'seconds';
    let numFramesForStep3 = currentStep1Defaults.groupDefaultNumFrames || '5';
    let videoOverlapValueForStep3 = currentStep1Defaults.groupDefaultVideoOverlapValue || '2';
    let videoOverlapUnitForStep3 = currentStep1Defaults.groupDefaultVideoOverlapUnit || 'seconds';

    if (value === 'add_new_group') {
      setShowNewGroupForm(true); formStep1.setValue('newGroupName', '');
      sceneDescForStep2Init = currentStep1Defaults.groupDefaultCameraSceneContext || '';
      sceneContextForStep3 = currentStep1Defaults.groupDefaultCameraSceneContext || '';
      aiTargetForStep3 = currentStep1Defaults.groupDefaultAiDetectionTarget || '';
      alertEventsForStep3 = currentStep1Defaults.groupDefaultAlertEvents || '';
      setTimeout(() => { newGroupNameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); newGroupNameInputRef.current?.focus(); }, 100);
    } else {
      setShowNewGroupForm(false); formStep1.setValue('newGroupName', '');
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

        sceneDescForStep2Init = selectedGroupData.defaultCameraSceneContext || '';
        sceneContextForStep3 = selectedGroupData.defaultCameraSceneContext || '';
        aiTargetForStep3 = selectedGroupData.defaultAiDetectionTarget || '';
        alertEventsForStep3 = (selectedGroupData.defaultAlertEvents || []).join(', ');
        videoChunksValueForStep3 = selectedGroupData.defaultVideoChunks?.value?.toString() || '10';
        videoChunksUnitForStep3 = selectedGroupData.defaultVideoChunks?.unit || 'seconds';
        numFramesForStep3 = selectedGroupData.defaultNumFrames?.toString() || '5';
        videoOverlapValueForStep3 = selectedGroupData.defaultVideoOverlap?.value?.toString() || '2';
        videoOverlapUnitForStep3 = selectedGroupData.defaultVideoOverlap?.unit || 'seconds';
      } else {
        formStep1.resetField('groupDefaultCameraSceneContext'); formStep1.resetField('groupDefaultAiDetectionTarget');
        formStep1.resetField('groupDefaultAlertEvents'); formStep1.resetField('groupDefaultVideoChunksValue');
        formStep1.resetField('groupDefaultVideoChunksUnit'); formStep1.resetField('groupDefaultNumFrames');
        formStep1.resetField('groupDefaultVideoOverlapValue'); formStep1.resetField('groupDefaultVideoOverlapUnit');
        sceneDescForStep2Init = ''; sceneContextForStep3 = ''; aiTargetForStep3 = ''; alertEventsForStep3 = '';
      }
    }
    formStep2.reset({ sceneDescription: sceneDescForStep2Init });
    console.log("handleGroupChange: Reset formStep2.sceneDescription to:", sceneDescForStep2Init, "FormStep2 Values after reset:", formStep2.getValues());
    formStep3.reset({
      cameraSceneContext: sceneContextForStep3, aiDetectionTarget: aiTargetForStep3, alertEvents: alertEventsForStep3,
      videoChunksValue: videoChunksValueForStep3, videoChunksUnit: videoChunksUnitForStep3, numFrames: numFramesForStep3,
      videoOverlapValue: videoOverlapValueForStep3, videoOverlapUnit: videoOverlapUnitForStep3,
    });
  };

  const handleCancelAddNewGroup = () => {
    setShowNewGroupForm(false); formStep1.setValue('group', undefined); setSelectedGroup(undefined);
    formStep1.resetField('newGroupName');
    formStep1.setValue('groupDefaultCameraSceneContext', ''); formStep1.setValue('groupDefaultAiDetectionTarget', '');
    formStep1.setValue('groupDefaultAlertEvents', ''); formStep1.setValue('groupDefaultVideoChunksValue', '10');
    formStep1.setValue('groupDefaultVideoChunksUnit', 'seconds'); formStep1.setValue('groupDefaultNumFrames', '5');
    formStep1.setValue('groupDefaultVideoOverlapValue', '2'); formStep1.setValue('groupDefaultVideoOverlapUnit', 'seconds');
    formStep2.reset({ sceneDescription: '' });
    console.log("handleCancelAddNewGroup: Reset formStep2.sceneDescription to empty string");
    formStep3.reset({
      cameraSceneContext: '', aiDetectionTarget: '', alertEvents: '',
      videoChunksValue: '10', videoChunksUnit: 'seconds', numFrames: '5',
      videoOverlapValue: '2', videoOverlapUnit: 'seconds',
    });
  };

  const onSubmitStep1: SubmitHandler<AddCameraStep1Values> = async (data_step1_form) => {
    if (!formStep1.formState.isValid) return;
    setIsProcessingStep1Submitting(true);

    const currentRTSP = data_step1_form.rtspUrl;
    setCurrentRtspUrlForSnapshot(currentRTSP); // Store RTSP URL for Step 2 to trigger snapshot

    // Conditional reset of snapshot and scene description data
    if (currentRTSP !== rtspUrlUsedForLastSnapshot) {
        setSnapshotGcsObjectName(null);
        setDisplayableSnapshotUrl(null);
        setSnapshotResolution(null);
        setIsGeneratingDescription(false); // Reset AI generation state
        
        // Determine initial scene description for Step 2 based on group selection in Step 1
        let sceneDescForStep2Init = '';
        const selectedGroupFromForm = data_step1_form.group;
        if (selectedGroupFromForm && selectedGroupFromForm !== 'add_new_group') {
            const groupData = groups.find(g => g.id === selectedGroupFromForm);
            sceneDescForStep2Init = groupData?.defaultCameraSceneContext || '';
        } else if (selectedGroupFromForm === 'add_new_group') {
            sceneDescForStep2Init = data_step1_form.groupDefaultCameraSceneContext || '';
        }
        formStep2.reset({ sceneDescription: sceneDescForStep2Init });
        console.log("onSubmitStep1 (RTSP changed): Reset formStep2.sceneDescription to:", sceneDescForStep2Init);
    } else {
        // RTSP URL is the same, keep existing sceneDescription from formStep2 if user edited it
        console.log("onSubmitStep1 (RTSP same): Keeping existing formStep2.sceneDescription:", formStep2.getValues('sceneDescription'));
    }
    
    setRtspUrlUsedForLastSnapshot(currentRTSP); // Update the last used RTSP URL

    // Prepare default values for Step 3 based on Step 1's group configuration
    let sceneContextForStep3 = formStep2.getValues('sceneDescription') || ''; // Start with Step 2's current scene description
    let aiTargetForStep3 = ''; let alertEventsForStep3 = '';
    let videoChunksValueForStep3 = '10'; let videoChunksUnitForStep3: 'seconds' | 'minutes' = 'seconds';
    let numFramesForStep3 = '5'; let videoOverlapValueForStep3 = '2'; let videoOverlapUnitForStep3: 'seconds' | 'minutes' = 'seconds';
    
    const selectedGroupFromForm = data_step1_form.group;
    if (selectedGroupFromForm && selectedGroupFromForm !== 'add_new_group') {
      const groupData = groups.find(g => g.id === selectedGroupFromForm);
      if (groupData) {
        sceneContextForStep3 = formStep2.getValues('sceneDescription') || groupData.defaultCameraSceneContext || '';
        aiTargetForStep3 = groupData.defaultAiDetectionTarget || '';
        alertEventsForStep3 = (groupData.defaultAlertEvents || []).join(', ');
        videoChunksValueForStep3 = groupData.defaultVideoChunks?.value?.toString() || '10';
        videoChunksUnitForStep3 = groupData.defaultVideoChunks?.unit || 'seconds';
        numFramesForStep3 = groupData.defaultNumFrames?.toString() || '5';
        videoOverlapValueForStep3 = groupData.defaultVideoOverlap?.value?.toString() || '2';
        videoOverlapUnitForStep3 = groupData.defaultVideoOverlap?.unit || 'seconds';
      }
    } else if (selectedGroupFromForm === 'add_new_group') {
      sceneContextForStep3 = formStep2.getValues('sceneDescription') || data_step1_form.groupDefaultCameraSceneContext || '';
      aiTargetForStep3 = data_step1_form.groupDefaultAiDetectionTarget || '';
      alertEventsForStep3 = data_step1_form.groupDefaultAlertEvents || '';
      videoChunksValueForStep3 = data_step1_form.groupDefaultVideoChunksValue || '10';
      videoChunksUnitForStep3 = data_step1_form.groupDefaultVideoChunksUnit || 'seconds';
      numFramesForStep3 = data_step1_form.groupDefaultNumFrames || '5';
      videoOverlapValueForStep3 = data_step1_form.groupDefaultVideoOverlapValue || '2';
      videoOverlapUnitForStep3 = data_step1_form.groupDefaultVideoOverlapUnit || 'seconds';
    }
    formStep3.reset({
      cameraSceneContext: sceneContextForStep3, aiDetectionTarget: aiTargetForStep3, alertEvents: alertEventsForStep3,
      videoChunksValue: videoChunksValueForStep3, videoChunksUnit: videoChunksUnitForStep3, numFrames: numFramesForStep3,
      videoOverlapValue: videoOverlapValueForStep3, videoOverlapUnit: videoOverlapUnitForStep3,
    });

    setIsProcessingStep1Submitting(false);
    setDrawerStep(2);
  };

  useEffect(() => {
    const fetchSnapshotAndDetails = async () => {
      if (drawerStep === 2 && currentRtspUrlForSnapshot && !isProcessingStep2 && !isLoadingSnapshotUrl) {
        
        // Only fetch if GCS object name is not already set for this currentRtspUrlForSnapshot
        // or if the current snapshot doesn't correspond to currentRtspUrlForSnapshot
        if (snapshotGcsObjectName && currentRtspUrlForSnapshot === formStep1.getValues('rtspUrl') && rtspUrlUsedForLastSnapshot === currentRtspUrlForSnapshot) {
           // We might already have a GCS object name from a previous attempt for the *same* RTSP url
           // but we still need to fetch the displayable URL.
           // The displayable URL fetching logic is in a separate useEffect below.
           return;
        }

        setIsProcessingStep2(true);
        setSnapshotGcsObjectName(null);
        setDisplayableSnapshotUrl(null);
        setSnapshotResolution(null);

        try {
          const auth = getAuth(); const user = auth.currentUser;
          if (!user) { toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in." }); setIsProcessingStep2(false); return; }
          const idToken = await user.getIdToken();

          const snapshotServiceUrl = process.env.NEXT_PUBLIC_TAKE_SNAPSHOT_URL;
          if (!snapshotServiceUrl) { throw new Error("Snapshot service URL (NEXT_PUBLIC_TAKE_SNAPSHOT_URL) is not configured."); }
          
          console.log(`Frontend: Attempting to call /take-snapshot: ${snapshotServiceUrl} for RTSP: ${currentRtspUrlForSnapshot}`);
          const snapshotResponse = await fetch(snapshotServiceUrl, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ rtsp_url: currentRtspUrlForSnapshot }),
          });

          let errorMessageText = `Snapshot service returned an invalid response format. Status: ${snapshotResponse.status}. Check service logs.`;
          if (!snapshotResponse.ok) {
            try { const errorData = await snapshotResponse.json(); errorMessageText = errorData.message || errorData.error || errorMessageText; } 
            catch (e) { const rawErrorText = await snapshotResponse.text(); errorMessageText = rawErrorText || errorMessageText; }
            throw new Error(errorMessageText);
          }
          const snapshotData = await snapshotResponse.json();
          if (snapshotData.status === 'success' && snapshotData.gcsObjectName && snapshotData.resolution) {
            setSnapshotGcsObjectName(snapshotData.gcsObjectName); 
            setSnapshotResolution(snapshotData.resolution);
            // The next useEffect (for displayableSnapshotUrl) will trigger
          } else { 
            throw new Error(snapshotData.message || "Snapshot API call succeeded but returned invalid data (gcsObjectName/resolution)."); 
          }
        } catch (error: any) {
          console.error("Error fetching snapshot GCS object name in Step 2:", error);
          toast({ variant: "destructive", title: "Snapshot Error", description: error.message || "Could not retrieve camera snapshot details." });
          setSnapshotGcsObjectName(null); setSnapshotResolution(null); // Ensure reset on error
        } finally { 
          setIsProcessingStep2(false);
        }
      }
    };
    if (drawerStep === 2 && currentRtspUrlForSnapshot) { 
      fetchSnapshotAndDetails(); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerStep, currentRtspUrlForSnapshot]);

  useEffect(() => {
    const fetchDisplayableSnapshotUrl = async () => {
      // Fetch signed URL only if we have a GCS object name and no displayable URL yet (or if GCS object changed)
      if (drawerStep === 2 && snapshotGcsObjectName && !isLoadingSnapshotUrl) {
          // Check if we already have a displayable URL for the current GCS object
          // This prevents re-fetching if user navigates back and forth without RTSP URL change.
          if(displayableSnapshotUrl && rtspUrlUsedForLastSnapshot === currentRtspUrlForSnapshot) {
              // A displayable URL for the current snapshot context already exists, no need to refetch.
              return;
          }

        setIsLoadingSnapshotUrl(true);
        setDisplayableSnapshotUrl(null); // Clear previous one before fetching new
        try {
          const retrieveSnapshotServiceUrl = process.env.NEXT_PUBLIC_RETRIEVE_SNAPSHOT_URL;
          if (!retrieveSnapshotServiceUrl) { throw new Error("Retrieve snapshot service URL (NEXT_PUBLIC_RETRIEVE_SNAPSHOT_URL) is not configured."); }
          const auth = getAuth(); const user = auth.currentUser;
          if (!user) throw new Error("User not authenticated for retrieving snapshot URL.");
          const idToken = await user.getIdToken();

          console.log(`Frontend: Attempting to call /retrieve-snapshot: ${retrieveSnapshotServiceUrl} for GCS Object: ${snapshotGcsObjectName}`);
          const signedUrlResponse = await fetch(retrieveSnapshotServiceUrl, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ gcsObjectName: snapshotGcsObjectName }),
          });

          let errorMessageText = `Failed to get signed URL for snapshot. Status: ${signedUrlResponse.status}. Check service logs.`;
          if (!signedUrlResponse.ok) {
            try { const errorData = await signedUrlResponse.json(); errorMessageText = errorData.message || errorData.error || errorMessageText; } 
            catch (e) { const rawErrorText = await signedUrlResponse.text(); errorMessageText = rawErrorText || errorMessageText; }
            throw new Error(errorMessageText);
          }
          const signedUrlData = await signedUrlResponse.json();
          if (signedUrlData.status === 'success' && signedUrlData.signedUrl) {
            setDisplayableSnapshotUrl(signedUrlData.signedUrl);
          } else { throw new Error(signedUrlData.message || "Failed to get signed URL from retrieve snapshot service."); }
        } catch (error: any) {
          console.error("Error retrieving displayable snapshot URL:", error);
          toast({ variant: "destructive", title: "Snapshot Display Error", description: error.message || "Could not load snapshot image." });
          setDisplayableSnapshotUrl(null); // Ensure reset on error
        } finally { 
          setIsLoadingSnapshotUrl(false);
        }
      }
    };
    if (drawerStep === 2 && snapshotGcsObjectName) { fetchDisplayableSnapshotUrl(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerStep, snapshotGcsObjectName]);


  const handleStep2Back = () => {
    // Only navigate back. State reset is handled by onSubmitStep1 if RTSP URL changes.
    setDrawerStep(1); 
  };

  const onSubmitStep2: SubmitHandler<AddCameraStep2Values> = async (data_step2_form) => {
    const step1Values = formStep1.getValues();
    const currentSceneDescriptionFromStep2 = data_step2_form.sceneDescription || '';
    let sceneContextForStep3 = ''; 
    let aiTargetForStep3 = ''; 
    let alertEventsForStep3 = '';
    let videoChunksValueForStep3 = '10'; 
    let videoChunksUnitForStep3: 'seconds' | 'minutes' = 'seconds';
    let numFramesForStep3 = '5'; 
    let videoOverlapValueForStep3 = '2'; 
    let videoOverlapUnitForStep3: 'seconds' | 'minutes' = 'seconds';

    if (step1Values.group && step1Values.group !== 'add_new_group') {
      const selectedGroupData = groups.find(g => g.id === step1Values.group);
      if (selectedGroupData) {
        sceneContextForStep3 = currentSceneDescriptionFromStep2 || selectedGroupData.defaultCameraSceneContext || '';
        aiTargetForStep3 = selectedGroupData.defaultAiDetectionTarget || '';
        alertEventsForStep3 = (selectedGroupData.defaultAlertEvents || []).join(', ');
        videoChunksValueForStep3 = selectedGroupData.defaultVideoChunks?.value?.toString() || '10';
        videoChunksUnitForStep3 = selectedGroupData.defaultVideoChunks?.unit || 'seconds';
        numFramesForStep3 = selectedGroupData.defaultNumFrames?.toString() || '5';
        videoOverlapValueForStep3 = selectedGroupData.defaultVideoOverlap?.value?.toString() || '2';
        videoOverlapUnitForStep3 = selectedGroupData.defaultVideoOverlap?.unit || 'seconds';
      }
    } else if (step1Values.group === 'add_new_group') {
      sceneContextForStep3 = currentSceneDescriptionFromStep2 || step1Values.groupDefaultCameraSceneContext || '';
      aiTargetForStep3 = step1Values.groupDefaultAiDetectionTarget || '';
      alertEventsForStep3 = step1Values.groupDefaultAlertEvents || '';
      videoChunksValueForStep3 = step1Values.groupDefaultVideoChunksValue || '10';
      videoChunksUnitForStep3 = step1Values.groupDefaultVideoChunksUnit || 'seconds';
      numFramesForStep3 = step1Values.groupDefaultNumFrames || '5';
      videoOverlapValueForStep3 = step1Values.groupDefaultVideoOverlapValue || '2';
      videoOverlapUnitForStep3 = step1Values.groupDefaultVideoOverlapUnit || 'seconds';
    } else {
      sceneContextForStep3 = currentSceneDescriptionFromStep2;
    }
    formStep3.reset({
      cameraSceneContext: sceneContextForStep3, 
      aiDetectionTarget: aiTargetForStep3, 
      alertEvents: alertEventsForStep3,
      videoChunksValue: videoChunksValueForStep3, 
      videoChunksUnit: videoChunksUnitForStep3, 
      numFrames: numFramesForStep3,
      videoOverlapValue: videoOverlapValueForStep3, 
      videoOverlapUnit: videoOverlapUnitForStep3,
    });
    setDrawerStep(3);
  };

  const getEffectiveServerUrl = useCallback(async (): Promise<string | null> => {
    if (!currentUser || !orgId) {
      toast({ variant: "destructive", title: "Authentication Error", description: "User or organization not identified." });
      return null;
    }
    try {
      const orgDocRef = doc(db, 'organizations', orgId);
      const orgDocSnap = await getDoc(orgDocRef);
      if (orgDocSnap.exists()) {
        const orgData = orgDocSnap.data();
        if (orgData.orgDefaultServerId) {
          const serverDocRef = doc(db, 'servers', orgData.orgDefaultServerId);
          const serverDocSnap = await getDoc(serverDocRef);
          if (serverDocSnap.exists()) {
            const serverData = serverDocSnap.data();
            if (serverData.status === 'online' && serverData.ipAddressWithPort && serverData.protocol) {
              return `${serverData.protocol}://${serverData.ipAddressWithPort}`;
            }
          }
        }
      }
      // Fallback to System Default
      const systemDefaultServerQuery = query(collection(db, 'servers'), where('isSystemDefault', '==', true), limit(1));
      const systemDefaultSnapshot = await getDocs(systemDefaultServerQuery);
      if (!systemDefaultSnapshot.empty) {
        const serverData = systemDefaultSnapshot.docs[0].data();
        if (serverData.status === 'online' && serverData.ipAddressWithPort && serverData.protocol) {
          return `${serverData.protocol}://${serverData.ipAddressWithPort}`;
        }
      }
      toast({ variant: "destructive", title: "No Server Available", description: "No suitable default server (Org or System) is online or configured." });
      return null;
    } catch (error) {
      console.error("Error fetching effective server URL:", error);
      toast({ variant: "destructive", title: "Server Fetch Error", description: "Could not determine default server information." });
      return null;
    }
  }, [orgId, currentUser, toast]);

  const onSubmitStep3: SubmitHandler<AddCameraStep3Values> = async (configData) => {
    if (!formStep3.formState.isValid || !currentUser || !orgId) {
      toast({ variant: "destructive", title: "Error", description: "Missing required information or user not authenticated." }); return;
    }

    const step1Data = formStep1.getValues();
    const effectiveServerUrlValue = await getEffectiveServerUrl();
    
    const batch = writeBatch(db); const now = serverTimestamp() as Timestamp; let finalGroupId: string | null = null;
    if (step1Data.group === 'add_new_group' && step1Data.newGroupName) {
      const groupDocRef = doc(collection(db, 'groups')); finalGroupId = groupDocRef.id;
      const newGroup: Omit<Group, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: Timestamp, updatedAt: Timestamp, cameras: string[], videos: string[] } = {
        name: step1Data.newGroupName, orgId: orgId, userId: currentUser.uid, cameras: [], videos: [],
        defaultCameraSceneContext: step1Data.groupDefaultCameraSceneContext || null,
        defaultAiDetectionTarget: step1Data.groupDefaultAiDetectionTarget || null,
        defaultAlertEvents: step1Data.groupDefaultAlertEvents ? step1Data.groupDefaultAlertEvents.split(',').map(ae => ae.trim()).filter(ae => ae) : null,
        defaultVideoChunks: step1Data.groupDefaultVideoChunksValue ? { value: parseFloat(step1Data.groupDefaultVideoChunksValue), unit: step1Data.groupDefaultVideoChunksUnit || 'seconds' } : null,
        defaultNumFrames: step1Data.groupDefaultNumFrames ? parseInt(step1Data.groupDefaultNumFrames, 10) : null,
        defaultVideoOverlap: step1Data.groupDefaultVideoOverlapValue ? { value: parseFloat(step1Data.groupDefaultVideoOverlapValue), unit: step1Data.groupDefaultVideoOverlapUnit || 'seconds' } : null,
        createdAt: now, updatedAt: now,
      };
      batch.set(groupDocRef, newGroup);
      setGroups(prev => [...prev, { ...newGroup, id: groupDocRef.id, createdAt: now, updatedAt: now }]);
    } else if (step1Data.group) { finalGroupId = step1Data.group; }

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
      videoChunks: { value: parseFloat(configData.videoChunksValue), unit: configData.videoChunksUnit },
      numFrames: parseInt(configData.numFrames, 10),
      videoOverlap: { value: parseFloat(configData.videoOverlapValue), unit: configData.videoOverlapUnit },
      cameraSceneContext: configData.cameraSceneContext, 
      aiDetectionTarget: configData.aiDetectionTarget,
      alertEvents: configData.alertEvents.split(',').map(ae => ae.trim()).filter(ae => ae),
      sceneDescription: formStep2.getValues().sceneDescription || null,
      userId: currentUser.uid, 
      previousConfigId: null,
    });

    batch.update(cameraDocRef, { currentConfigId: configDocRef.id });


    if (finalGroupId) {
      const groupRefToUpdate = doc(db, 'groups', finalGroupId);
      batch.update(groupRefToUpdate, { cameras: arrayUnion(cameraDocRef.id), updatedAt: now });
      setGroups(prevGroups => prevGroups.map(g => g.id === finalGroupId ? { ...g, cameras: [...(g.cameras || []), cameraDocRef.id], updatedAt: now } : g));
    }
    try {
      await batch.commit();
      toast({ title: "Camera Saved", description: `${step1Data.cameraName} has been added. It is awaiting approval by an administrator.` });
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
      toast({ variant: "destructive", title: "Save Failed", description: `Could not save the camera. ${error.message}` });
    }
  };

  const handleSendChatMessage = async () => {
    if (!currentChatMessage.trim() || !selectedCameraForChat) return;
    const userMessage: ChatMessage = { id: 'user-' + Date.now(), sender: 'user', text: currentChatMessage, timestamp: new Date(), avatar: 'https://placehold.co/50x50.png?data-ai-hint=user+avatar' };
    setChatMessages(prev => [...prev, userMessage]); setCurrentChatMessage(''); setIsSendingMessage(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const aiResponse: ChatMessage = { id: 'ai-' + Date.now(), sender: 'ai', text: `Okay, I've processed your message about ${selectedCameraForChat.cameraName}: "${userMessage.text}". What else can I help you with?`, timestamp: new Date() };
    setChatMessages(prev => [...prev, aiResponse]); setIsSendingMessage(false);
  };

  useEffect(() => {
    const scrollElement = chatScrollAreaRef.current;
    if (scrollElement) { scrollElement.scrollTop = scrollElement.scrollHeight; }
  }, [chatMessages]);

  const handleGenerateGroupAlerts = async () => {
    const detectionTarget = formStep1.getValues('groupDefaultAiDetectionTarget');
    if (!detectionTarget || detectionTarget.trim() === "") {
      toast({ variant: "destructive", title: "Input Required", description: "Please enter an AI detection target first." }); return;
    }
    setIsGeneratingAlerts(true);
    try {
      const response = await generateGroupAlertEvents({ aiDetectionTarget: detectionTarget, language });
      if (response && response.suggestedAlertEvents && !response.suggestedAlertEvents.startsWith("Error:")) {
        formStep1.setValue('groupDefaultAlertEvents', response.suggestedAlertEvents);
      } else {
        toast({ variant: "destructive", title: "Generation Failed", description: response.suggestedAlertEvents || "Could not generate alert events. Please try again." });
      }
    } catch (error: any) {
      console.error("Error generating group alert events:", error);
      let description = "An unexpected error occurred while generating alert events.";
      if (error.message && error.message.includes('API key not valid')) {
        description = "Generation failed: API key is not valid. Please check your configuration.";
      } else if (error.message) { description = `Generation failed: ${error.message}`; }
      toast({ variant: "destructive", title: "Error", description: description });
    } finally { setIsGeneratingAlerts(false); }
  };

  const handleGenerateSceneDescription = async () => {
    if (!displayableSnapshotUrl) {
      toast({ variant: "destructive", title: "Snapshot Missing", description: "Please wait for the snapshot to load or ensure a valid snapshot was taken."});
      return;
    }
    setIsGeneratingDescription(true);
    try {
      console.log("Frontend: Fetching image from GCS URL for AI Description:", displayableSnapshotUrl);
      const imageResponse = await fetch(displayableSnapshotUrl);
      if (!imageResponse.ok) {
        let errorDetails = `Failed to fetch image for AI description from GCS (status: ${imageResponse.status}).`;
        try { const errorJson = await imageResponse.json(); errorDetails = errorJson.message || errorJson.error || errorDetails; }
        catch (e) { /* ignore if not json */ }
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
        return <AddCameraStep1Form
                  formStep1={formStep1}
                  onSubmitStep1={onSubmitStep1}
                  groups={groups}
                  showNewGroupForm={showNewGroupForm}
                  handleGroupChange={handleGroupChange}
                  handleCancelAddNewGroup={handleCancelAddNewGroup}
                  newGroupNameInputRef={newGroupNameInputRef}
                  handleGenerateGroupAlerts={handleGenerateGroupAlerts}
                  isGeneratingAlerts={isGeneratingAlerts}
                  isProcessingStep1Submitting={isProcessingStep1Submitting}
                  showRtspPassword={showRtspPassword}
                  setShowRtspPassword={setShowRtspPassword}
                />;
      } else if (drawerStep === 2) {
        return <AddCameraStep2Form
                  formStep2={formStep2}
                  onSubmitStep2={onSubmitStep2}
                  isProcessingStep2Snapshot={isProcessingStep2} // For snapshot capture
                  isLoadingSnapshotUrl={isLoadingSnapshotUrl} // For signed URL fetch
                  displayableSnapshotUrl={displayableSnapshotUrl}
                  handleGenerateSceneDescription={handleGenerateSceneDescription}
                  isGeneratingDescription={isGeneratingDescription}
                />;
      } else if (drawerStep === 3) {
        return <AddCameraStep3Form formStep3={formStep3} onSubmitStep3={onSubmitStep3} />;
      }
    } else if (drawerType === 'chatCamera' && selectedCameraForChat) {
      return <CameraChatDrawerContent
                chatMessages={chatMessages}
                isSendingMessage={isSendingMessage}
                selectedCameraForChat={selectedCameraForChat}
              />;
    }
    return null;
  };

  const drawerFooter = () => {
    if (drawerType === 'addCamera') {
      if (drawerStep === 1) {
        return (
          <div className="flex justify-between p-4 border-t">
            <Button variant="outline" onClick={handleDrawerClose}>Cancel</Button>
            <Button type="submit" form="add-camera-form-step1" disabled={isProcessingStep1Submitting || !formStep1.formState.isValid}>
              {isProcessingStep1Submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Next
            </Button>
          </div>
        );
      } else if (drawerStep === 2) {
        return (
          <div className="flex justify-between p-4 border-t">
            <Button variant="outline" onClick={handleStep2Back} disabled={isProcessingStep2 || isLoadingSnapshotUrl || isGeneratingDescription}>Back</Button>
            <Button type="submit" form="add-camera-form-step2" disabled={isProcessingStep2 || isLoadingSnapshotUrl || isGeneratingDescription || formStep2.formState.isSubmitting || !formStep2.formState.isValid}>
              {(formStep2.formState.isSubmitting) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Next
            </Button>
          </div>
        );
      } else if (drawerStep === 3) {
        return (
          <div className="flex justify-between p-4 border-t">
            <Button variant="outline" onClick={() => setDrawerStep(2)}>Back</Button>
            <Button type="submit" form="add-camera-form-step3" disabled={formStep3.formState.isSubmitting || !formStep3.formState.isValid}>
              {formStep3.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save Camera
            </Button>
          </div>
        );
      }
    } else if (drawerType === 'chatCamera') {
      return (
        <div className="p-4 border-t flex items-center space-x-2">
          <Avatar className="h-8 w-8"><AvatarImage src="https://placehold.co/50x50.png?data-ai-hint=user+avatar" alt="User" data-ai-hint="user avatar" /><AvatarFallback>U</AvatarFallback></Avatar>
          <Input placeholder="Add a comment..." value={currentChatMessage} onChange={(e) => setCurrentChatMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && !isSendingMessage && handleSendChatMessage()} className="flex-grow" disabled={isSendingMessage} />
          <Button onClick={handleSendChatMessage} disabled={isSendingMessage || !currentChatMessage.trim()}>
            {isSendingMessage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} <span className="hidden sm:inline ml-1">Send</span>
          </Button>
        </div>
      );
    }
    return null;
  };

  const getDrawerTitle = () => {
    if (drawerType === 'addCamera') {
      let title = drawerStep === 1 ? "Add New Camera - Details" : drawerStep === 2 ? "Add New Camera - Scene Analysis" : "Add New Camera - AI Configuration";
      return title;
    }
    if (drawerType === 'chatCamera' && selectedCameraForChat) { return `Chat with ${selectedCameraForChat.cameraName}`; }
    return "Drawer";
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="space-x-2"></div>
        <div className="flex flex-wrap items-center space-x-2 sm:space-x-2 gap-y-2 justify-end">
          <Button onClick={handleAddCameraClick}><Plus className="mr-2 h-4 w-4" /> Add Camera</Button>
          <Button variant="outline"><FolderIcon className="mr-2 h-4 w-4" /> Group</Button>
          <Button variant="outline"><ListFilter className="mr-2 h-4 w-4" /> Filter</Button>
          <Button variant="outline"><ArrowUpDown className="mr-2 h-4 w-4" /> Sort</Button>
          <Button variant="outline" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
        </div>
      </div>
      {isLoadingCameras ? (
        <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : cameras.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-12">
          <CameraIconLucide className="w-16 h-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No Cameras Yet</h3>
          <p className="text-muted-foreground mb-6">Get started by adding your first camera to OctaVision.</p>
          <Button onClick={handleAddCameraClick}><Plus className="mr-2 h-4 w-4" /> Add Your First Camera</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {cameras.map((camera) => (
            <CameraCard
                key={camera.id}
                camera={camera}
                onChatClick={handleChatIconClick}
                onNotificationClick={handleNotificationIconClick}
            />
          ))}
        </div>
      )}
      <RightDrawer isOpen={isDrawerOpen} onClose={handleDrawerClose} title={getDrawerTitle()} footerContent={drawerFooter()} noPadding={drawerType === 'chatCamera'}>
        {renderDrawerContent()}
      </RightDrawer>
    </div>
  );
};

export default CamerasPage;
