
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertCircle as AlertCircleIconLucide, AlertTriangle as AlertTriangleIcon, ArrowUpDown, Bot, Bell, Camera as CameraIconLucide, CheckCircle, Clock, Folder as FolderIcon, ListFilter, Loader2, MessageSquare, MoreHorizontal, Plus, Send, Settings2, ShieldAlert, Sparkles, Users, Video, Wand2 } from 'lucide-react';
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
          dataAiHint: data.aiDetectionTarget || 'camera security',
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
    console.log("handleAddCameraClick: Reset formStep2.sceneDescription to empty string");
    formStep3.reset({
      cameraSceneContext: '', aiDetectionTarget: '', alertEvents: '',
      videoChunksValue: '10', videoChunksUnit: 'seconds', numFrames: '5',
      videoOverlapValue: '2', videoOverlapUnit: 'seconds',
    });

    setDrawerType('addCamera'); setDrawerStep(1); setIsDrawerOpen(true);
    setShowNewGroupForm(false); setSelectedGroup(undefined);
    setCurrentRtspUrlForSnapshot(null); setSnapshotGcsObjectName(null);
    setDisplayableSnapshotUrl(null); setSnapshotResolution(null);
    setIsGeneratingDescription(false); setShowRtspPassword(false);
    setIsProcessingStep1Submitting(false); setIsProcessingStep2Snapshot(false); setIsLoadingSnapshotUrl(false);
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
    console.log("handleDrawerClose: Reset formStep2.sceneDescription to empty string");
    formStep3.reset({
      cameraSceneContext: '', aiDetectionTarget: '', alertEvents: '',
      videoChunksValue: '10', videoChunksUnit: 'seconds', numFrames: '5',
      videoOverlapValue: '2', videoOverlapUnit: 'seconds',
    });
    setSelectedCameraForChat(null); setChatMessages([]);
    setCurrentRtspUrlForSnapshot(null); setSnapshotGcsObjectName(null);
    setDisplayableSnapshotUrl(null); setSnapshotResolution(null);
    setIsGeneratingDescription(false); setShowRtspPassword(false);
    setIsProcessingStep1Submitting(false); setIsProcessingStep2Snapshot(false); setIsLoadingSnapshotUrl(false);
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
      videoChunksValueForStep3 = currentStep1Defaults.groupDefaultVideoChunksValue || '10';
      videoChunksUnitForStep3 = currentStep1Defaults.groupDefaultVideoChunksUnit || 'seconds';
      numFramesForStep3 = currentStep1Defaults.groupDefaultNumFrames || '5';
      videoOverlapValueForStep3 = currentStep1Defaults.groupDefaultVideoOverlapValue || '2';
      videoOverlapUnitForStep3 = currentStep1Defaults.groupDefaultVideoOverlapUnit || 'seconds';
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
        videoChunksValueForStep3 = '10'; videoChunksUnitForStep3 = 'seconds'; numFramesForStep3 = '5';
        videoOverlapValueForStep3 = '2'; videoOverlapUnitForStep3 = 'seconds';
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
    setCurrentRtspUrlForSnapshot(data_step1_form.rtspUrl);
    setSnapshotGcsObjectName(null); setDisplayableSnapshotUrl(null); setSnapshotResolution(null);
    setIsGeneratingDescription(false);

    let sceneDescForStep2Init = '';
    const selectedGroupFromForm = data_step1_form.group;
    if (selectedGroupFromForm && selectedGroupFromForm !== 'add_new_group') {
      const groupData = groups.find(g => g.id === selectedGroupFromForm);
      sceneDescForStep2Init = groupData?.defaultCameraSceneContext || '';
    } else if (selectedGroupFromForm === 'add_new_group') {
      sceneDescForStep2Init = data_step1_form.groupDefaultCameraSceneContext || '';
    }
    formStep2.reset({ sceneDescription: sceneDescForStep2Init });
    console.log("onSubmitStep1: Reset formStep2.sceneDescription to:", sceneDescForStep2Init, "FormStep2 Values after reset:", formStep2.getValues());

    let sceneContextForStep3 = sceneDescForStep2Init;
    let aiTargetForStep3 = ''; let alertEventsForStep3 = '';
    let videoChunksValueForStep3 = '10'; let videoChunksUnitForStep3: 'seconds' | 'minutes' = 'seconds';
    let numFramesForStep3 = '5'; let videoOverlapValueForStep3 = '2'; let videoOverlapUnitForStep3: 'seconds' | 'minutes' = 'seconds';

    if (selectedGroupFromForm && selectedGroupFromForm !== 'add_new_group') {
      const groupData = groups.find(g => g.id === selectedGroupFromForm);
      if (groupData) {
        sceneContextForStep3 = groupData.defaultCameraSceneContext || sceneDescForStep2Init;
        aiTargetForStep3 = groupData.defaultAiDetectionTarget || '';
        alertEventsForStep3 = (groupData.defaultAlertEvents || []).join(', ');
        videoChunksValueForStep3 = groupData.defaultVideoChunks?.value?.toString() || '10';
        videoChunksUnitForStep3 = groupData.defaultVideoChunks?.unit || 'seconds';
        numFramesForStep3 = groupData.defaultNumFrames?.toString() || '5';
        videoOverlapValueForStep3 = groupData.defaultVideoOverlap?.value?.toString() || '2';
        videoOverlapUnitForStep3 = groupData.defaultVideoOverlap?.unit || 'seconds';
      }
    } else if (selectedGroupFromForm === 'add_new_group') {
      sceneContextForStep3 = data_step1_form.groupDefaultCameraSceneContext || sceneDescForStep2Init;
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
    setDrawerStep(2);
  };

  useEffect(() => {
    const fetchSnapshotAndDetails = async () => {
      if (drawerStep === 2 && currentRtspUrlForSnapshot && !snapshotGcsObjectName && !isProcessingStep2Snapshot && !isLoadingSnapshotUrl) {
        setIsProcessingStep2Snapshot(true); setSnapshotGcsObjectName(null);
        setDisplayableSnapshotUrl(null); setSnapshotResolution(null);
        try {
          const auth = getAuth(); const user = auth.currentUser;
          if (!user) { toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in." }); setIsProcessingStep2Snapshot(false); return; }
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
            setSnapshotGcsObjectName(snapshotData.gcsObjectName); setSnapshotResolution(snapshotData.resolution);
          } else { throw new Error(snapshotData.message || "Snapshot API call succeeded but returned invalid data (gcsObjectName/resolution)."); }
        } catch (error: any) {
          console.error("Error fetching snapshot GCS object name in Step 2:", error);
          toast({ variant: "destructive", title: "Snapshot Error", description: error.message || "Could not retrieve camera snapshot details." });
          setSnapshotGcsObjectName(null); setSnapshotResolution(null);
        } finally { setIsProcessingStep2Snapshot(false); }
      }
    };
    if (drawerStep === 2 && currentRtspUrlForSnapshot) { fetchSnapshotAndDetails(); }
  }, [drawerStep, currentRtspUrlForSnapshot, toast, isProcessingStep2Snapshot, snapshotGcsObjectName, isLoadingSnapshotUrl]);

  useEffect(() => {
    const fetchDisplayableSnapshotUrl = async () => {
      if (drawerStep === 2 && snapshotGcsObjectName && !displayableSnapshotUrl && !isLoadingSnapshotUrl) {
        setIsLoadingSnapshotUrl(true);
        try {
          const retrieveSnapshotServiceUrl = process.env.NEXT_PUBLIC_RETRIEVE_SNAPSHOT_URL;
          if (!retrieveSnapshotServiceUrl) { throw new Error("Retrieve snapshot service URL (NEXT_PUBLIC_RETRIEVE_SNAPSHOT_URL) is not configured."); }
          const auth = getAuth(); const user = auth.currentUser;
          if (!user) throw new Error("User not authenticated for retrieving snapshot URL.");
          const idToken = await user.getIdToken();
          console.log(`Frontend: Attempting to call /retrieve-snapshot: ${retrieveSnapshotServiceUrl} for Step 2 display: GCS Object: ${snapshotGcsObjectName}`);
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
          setDisplayableSnapshotUrl(null);
        } finally { setIsLoadingSnapshotUrl(false); }
      }
    };
    if (drawerStep === 2 && snapshotGcsObjectName) { fetchDisplayableSnapshotUrl(); }
  }, [drawerStep, snapshotGcsObjectName, displayableSnapshotUrl, isLoadingSnapshotUrl, toast]);

  const handleStep2Back = () => {
    setDrawerStep(1); setCurrentRtspUrlForSnapshot(null); setSnapshotGcsObjectName(null);
    setDisplayableSnapshotUrl(null); setSnapshotResolution(null); setIsProcessingStep2Snapshot(false);
    setIsLoadingSnapshotUrl(false); setIsGeneratingDescription(false);
    formStep2.reset({ sceneDescription: '' });
    console.log("handleStep2Back: Reset formStep2.sceneDescription to empty string");
  };

  const onSubmitStep2: SubmitHandler<AddCameraStep2Values> = async (data_step2_form) => {
    const step1Values = formStep1.getValues();
    const currentSceneDescriptionFromStep2 = data_step2_form.sceneDescription || '';
    let sceneContextForStep3 = ''; let aiTargetForStep3 = ''; let alertEventsForStep3 = '';
    let videoChunksValueForStep3 = '10'; let videoChunksUnitForStep3: 'seconds' | 'minutes' = 'seconds';
    let numFramesForStep3 = '5'; let videoOverlapValueForStep3 = '2'; let videoOverlapUnitForStep3: 'seconds' | 'minutes' = 'seconds';

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
    } else { sceneContextForStep3 = currentSceneDescriptionFromStep2; }
    formStep3.reset({
      cameraSceneContext: sceneContextForStep3, aiDetectionTarget: aiTargetForStep3, alertEvents: alertEventsForStep3,
      videoChunksValue: videoChunksValueForStep3, videoChunksUnit: videoChunksUnitForStep3, numFrames: numFramesForStep3,
      videoOverlapValue: videoOverlapValueForStep3, videoOverlapUnit: videoOverlapUnitForStep3,
    });
    setDrawerStep(3);
  };

  const getEffectiveServerUrl = useCallback(async (): Promise<string | null> => {
    if (!currentUser) { toast({ variant: "destructive", title: "Authentication Error", description: "User not authenticated." }); return null; }
    const currentOrgId = orgId || (await getDoc(doc(db, 'users', currentUser.uid))).data()?.organizationId;
    if (!currentOrgId) { toast({ variant: "destructive", title: "Configuration Error", description: "User organization not found." }); return null; }
    try {
      const orgDocRef = doc(db, 'organizations', currentOrgId); const orgDocSnap = await getDoc(orgDocRef);
      let serverUrlToUse: string | null = null;
      if (orgDocSnap.exists()) {
        const orgData = orgDocSnap.data();
        if (orgData.orgDefaultServerId) {
          const serverDocRef = doc(db, 'servers', orgData.orgDefaultServerId); const serverDocSnap = await getDoc(serverDocRef);
          if (serverDocSnap.exists()) {
            const serverData = serverDocSnap.data();
            if (serverData.status === 'online' && serverData.ipAddressWithPort && serverData.protocol) {
              serverUrlToUse = `${serverData.protocol}://${serverData.ipAddressWithPort}`;
            }
          }
        }
      }
      if (!serverUrlToUse) {
        const systemDefaultServerQuery = query(collection(db, 'servers'), where('isSystemDefault', '==', true), limit(1));
        const systemDefaultSnapshot = await getDocs(systemDefaultServerQuery);
        if (!systemDefaultSnapshot.empty) {
          const serverData = systemDefaultSnapshot.docs[0].data();
          if (serverData.status === 'online' && serverData.ipAddressWithPort && serverData.protocol) {
            serverUrlToUse = `${serverData.protocol}://${serverData.ipAddressWithPort}`;
          }
        }
      }
      if (serverUrlToUse) return serverUrlToUse;
      toast({ variant: "destructive", title: "No Server Available", description: "No suitable processing server (org or system default) is currently online or configured." });
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
      const newGroup: Omit<Group, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: Timestamp, updatedAt: Timestamp } = {
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
    const cameraDocRef = doc(collection(db, 'cameras')); const configDocRef = doc(collection(db, 'configurations'));
    batch.set(cameraDocRef, {
      cameraName: step1Data.cameraName, groupId: finalGroupId, userId: currentUser.uid, orgId: orgId,
      createdAt: now, updatedAt: now, url: step1Data.rtspUrl,
      rtspUsername: step1Data.rtspUsername || null, rtspPassword: step1Data.rtspPassword || null,
      protocol: "rtsp", activeVSSId: null, historicalVSSIds: [],
      currentConfigId: configDocRef.id, processingStatus: "waiting_for_approval",
      snapshotGcsObjectName: snapshotGcsObjectName, resolution: snapshotResolution,
    });
    batch.set(configDocRef, {
      sourceId: cameraDocRef.id, sourceType: "camera", serverIpAddress: effectiveServerUrlValue, createdAt: now,
      videoChunks: { value: parseFloat(configData.videoChunksValue), unit: configData.videoChunksUnit },
      numFrames: parseInt(configData.numFrames, 10),
      videoOverlap: { value: parseFloat(configData.videoOverlapValue), unit: configData.videoOverlapUnit },
      cameraSceneContext: configData.cameraSceneContext, aiDetectionTarget: configData.aiDetectionTarget,
      alertEvents: configData.alertEvents.split(',').map(ae => ae.trim()).filter(ae => ae),
      sceneDescription: formStep2.getValues().sceneDescription || null,
      userId: currentUser.uid, previousConfigId: null,
    });
    if (finalGroupId) {
      const groupRefToUpdate = doc(db, 'groups', finalGroupId);
      batch.update(groupRefToUpdate, { cameras: arrayUnion(cameraDocRef.id), updatedAt: now });
      setGroups(prevGroups => prevGroups.map(g => g.id === finalGroupId ? { ...g, cameras: [...(g.cameras || []), cameraDocRef.id], updatedAt: now } : g));
    }
    try {
      await batch.commit();
      toast({ title: "Camera Saved", description: `${step1Data.cameraName} has been added. It is awaiting approval by an administrator.` });
      const newCameraForState: Camera = {
        id: cameraDocRef.id, cameraName: step1Data.cameraName, imageUrl: displayableSnapshotUrl,
        snapshotGcsObjectName: snapshotGcsObjectName, resolution: snapshotResolution,
        dataAiHint: configData.aiDetectionTarget || 'newly added camera',
        processingStatus: "waiting_for_approval",
        rtspUsername: step1Data.rtspUsername || undefined, rtspPassword: step1Data.rtspPassword || undefined,
      };
      setCameras(prevCameras => [...prevCameras, newCameraForState]); handleDrawerClose();
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
        toast({ title: "Alerts Generated", description: "Suggested alert events have been populated." });
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
    console.log("Frontend: Attempting to call /take-snapshot:")
    if (!displayableSnapshotUrl) {
      toast({ variant: "destructive", title: "Snapshot Missing", description: "Please wait for the snapshot to load or ensure a valid snapshot was taken." }); return;
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
          } else { isLikelyError = true; }
          if (!isLikelyError && typeof description === 'string') {
            console.log("Frontend: Attempting to set sceneDescription with:", description);
            formStep2.setValue('sceneDescription', description);
            formStep2.trigger('sceneDescription');
            console.log("Frontend: Value of sceneDescription after setValue:", formStep2.getValues('sceneDescription'));
            toast({ title: "AI Scene Description", description: "Scene description generated successfully." })
          } else {
            const descErrorMsg = description || "AI failed to generate a valid description or returned an error.";
            console.error("Frontend: AI Description error or malformed response:", descErrorMsg, aiDescriptionResponse);
            toast({ variant: "destructive", title: "AI Description Failed", description: descErrorMsg });
          }
        } catch (aiError: any) {
          console.error("Frontend: Error calling describeImage Genkit flow:", aiError);
          toast({ variant: "destructive", title: "AI Description Error", description: aiError.message || "Failed to get AI description." });
        } finally { setIsGeneratingDescription(false); }
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
                  isProcessingStep2Snapshot={isProcessingStep2Snapshot}
                  isLoadingSnapshotUrl={isLoadingSnapshotUrl}
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
            <Button variant="outline" onClick={handleStep2Back} disabled={isProcessingStep2Snapshot || isLoadingSnapshotUrl || isGeneratingDescription}>Back</Button>
            <Button type="submit" form="add-camera-form-step2" disabled={isProcessingStep2Snapshot || isLoadingSnapshotUrl || isGeneratingDescription || formStep2.formState.isSubmitting || !formStep2.formState.isValid}>
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
            <Card key={camera.id} className="overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200 rounded-lg">
              <CardContent className="p-0">
                <div className="relative">
                  {camera.imageUrl ? (
                    <Image src={camera.imageUrl} alt={camera.cameraName} width={200} height={150} className="rounded-t-lg aspect-video w-full object-cover" data-ai-hint={camera.dataAiHint} unoptimized />
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
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><div className="flex items-center space-x-1 cursor-pointer hover:text-primary"><Settings2 className="w-3 h-3" /><span>Config</span></div></TooltipTrigger><TooltipContent><p>View/Edit Configuration</p></TooltipContent></Tooltip></TooltipProvider>
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><div className="flex items-center space-x-1 cursor-pointer hover:text-destructive"><ShieldAlert className="w-3 h-3 text-destructive" /><span>2</span></div></TooltipTrigger><TooltipContent><p>Active Alerts</p></TooltipContent></Tooltip></TooltipProvider>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleNotificationIconClick(camera.id)}><Bell className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleChatIconClick(camera)}><MessageSquare className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
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
