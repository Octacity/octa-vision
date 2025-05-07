'use client';

import type { NextPage } from 'next';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/firebase';

import { Card, CardContent } from '@/components/ui/card';
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
import { CheckCircle, Clock, AlertTriangle, Bell, MessageSquare, Plus, Users, ListFilter, ArrowUpDown, MoreHorizontal, Video, Edit3, Folder, HelpCircle, ShieldAlert, Settings2, ArrowDown, Wand2, Mic, Loader2, Film, BarChart, CalendarDays, AlertCircle as AlertCircleIcon, Diamond, Bot, Send, Camera as CameraIconLucide } from 'lucide-react'; 
import RightDrawer from '@/components/RightDrawer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useNotificationDrawer } from '@/contexts/NotificationDrawerContext';


export interface Camera { // Exporting Camera interface
  id: string;
  name: string;
  imageUrl: string;
  dataAiHint: string;
}

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: Date;
  avatar?: string;
}


const initialGroups: {id: string, name: string}[] = [];


const addCameraStep1Schema = z.object({
  rtspUrl: z.string().url({ message: "Invalid RTSP URL format." }).min(1, "RTSP URL is required."),
  cameraName: z.string().min(1, "Camera name is required."),
  group: z.string().optional(),
  newGroupName: z.string().optional(),
  groupSceneContext: z.string().optional(), // Renamed from groupDescription
  groupAIDetectionTarget: z.string().optional(), // Renamed from groupAIDetection
  alertClasses: z.string().optional(),
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
    sceneDescription: z.string().min(1, "Scene description is required."), // Was detailedSceneDescription
});
type AddCameraStep2Values = z.infer<typeof addCameraStep2Schema>;

const addCameraStep3Schema = z.object({
    cameraPurposeDescription: z.string().min(1, "This field is required."), // This field might be better named as sceneContext or similar
    aiDetectionTarget: z.string().min(1, "AI detection target is required."), // Renamed from aiDetectionPrompt
    cameraAlertEvents: z.string().min(1, "Alert events are required."), // Renamed from cameraAlertClasses
    videoChunksValue: z.string().min(1, "Video chunks value is required.").refine(val => val === undefined || val === '' || !isNaN(parseFloat(val)), {message: "Must be a number"}),
    videoChunksUnit: z.enum(['seconds', 'minutes']).optional().default('seconds'),
    numFrames: z.string().min(1, "Number of frames is required.").refine(val => val === undefined || val === '' || !isNaN(parseFloat(val)), {message: "Must be a number"}),
    videoOverlapValue: z.string().min(1, "Video overlap value is required.").refine(val => val === undefined || val === '' || !isNaN(parseFloat(val)), {message: "Must be a number"}),
    videoOverlapUnit: z.enum(['seconds', 'minutes']).optional().default('seconds'),
});
type AddCameraStep3Values = z.infer<typeof addCameraStep3Schema>;


const CamerasPage: NextPage = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<'addCamera' | 'chatCamera' | null>(null);
  const [drawerStep, setDrawerStep] = useState(1);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);
  const [showNewGroupForm, setShowNewGroupForm] = useState(false);
  const [isProcessingStep2, setIsProcessingStep2] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

  const [selectedCameraForChat, setSelectedCameraForChat] = useState<Camera | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentChatMessage, setCurrentChatMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const chatScrollAreaRef = useRef<HTMLDivElement>(null);
  const { openNotificationDrawer } = useNotificationDrawer();
  const [isOrgApproved, setIsOrgApproved] = useState<boolean | null>(null);
  const [isLoadingOrgStatus, setIsLoadingOrgStatus] = useState(true);

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [groups, setGroups] = useState<{id: string, name: string}[]>(initialGroups);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          const organizationId = userData?.organizationId;
          if (organizationId) {
            const orgDocRef = doc(db, 'organizations', organizationId);
            const orgDocSnap = await getDoc(orgDocRef);
            if (orgDocSnap.exists()) {
              setIsOrgApproved(orgDocSnap.data()?.approved || false);
            } else {
              setIsOrgApproved(false);
            }
          } else {
            setIsOrgApproved(false);
          }
        } else {
          setIsOrgApproved(false);
        }
      } else {
        setIsOrgApproved(false);
      }
      setIsLoadingOrgStatus(false);
    });
    return () => unsubscribe();
  }, []);


  const formStep1 = useForm<AddCameraStep1Values>({
    resolver: zodResolver(addCameraStep1Schema),
    mode: "onChange", 
    defaultValues: {
      rtspUrl: '',
      cameraName: '',
      group: undefined,
      newGroupName: '',
      groupSceneContext: '',
      groupAIDetectionTarget: '',
      alertClasses: '',
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
        cameraPurposeDescription: '',
        aiDetectionTarget: '',
        cameraAlertEvents: '',
        videoChunksValue: '',
        videoChunksUnit: 'seconds',
        numFrames: '',
        videoOverlapValue: '',
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
    setSnapshotUrl(null);
  };

  const handleChatIconClick = (camera: Camera) => {
    setSelectedCameraForChat(camera);
    setDrawerType('chatCamera');
    setChatMessages([
      {
        id: 'ai-initial-' + camera.id,
        sender: 'ai',
        text: `You can now chat with ${camera.name}. Do you want to know about the alerts for the day?`,
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
  };
  
  const handleGroupChange = (value: string) => {
    setSelectedGroup(value);
    formStep1.setValue('group', value);
    if (value === 'add_new_group') {
      setShowNewGroupForm(true);
    } else {
      setShowNewGroupForm(false);
      formStep1.setValue('newGroupName', ''); 
      formStep1.setValue('groupSceneContext', '');
      formStep1.setValue('groupAIDetectionTarget', '');
      formStep1.setValue('alertClasses', '');
    }
  };

  const onSubmitStep1: SubmitHandler<AddCameraStep1Values> = async (data) => {
    console.log("Step 1 Data:", data);
    if (!formStep1.formState.isValid) return;
    setIsProcessingStep2(true);
    setDrawerStep(2);
    await new Promise(resolve => setTimeout(resolve, 1500)); 
    setSnapshotUrl('https://picsum.photos/seed/step2snapshot/400/300'); 
    await new Promise(resolve => setTimeout(resolve, 2000)); 
    formStep2.setValue('sceneDescription', 'This is an art gallery with various paintings on display. Several visitors are admiring the artwork. The lighting is bright and even.');
    setIsProcessingStep2(false);
  };

  const handleStep2Back = () => {
    setDrawerStep(1);
    setSnapshotUrl(null);
    formStep2.reset();
  };

  const onSubmitStep2: SubmitHandler<AddCameraStep2Values> = async (data) => {
    console.log("Step 2 Data:", data);
    if (!formStep2.formState.isValid) return;
    const groupSceneCtx = formStep1.getValues('groupSceneContext');
    const groupAIDetectionTarget = formStep1.getValues('groupAIDetectionTarget');
    const currentSceneDesc = data.sceneDescription; // Renamed from sceneDesc

    let cameraPurpose = `Based on the scene description: "${currentSceneDesc}"`;
    if (groupSceneCtx) {
        cameraPurpose += ` and the group's context: "${groupSceneCtx}", this camera's role is to...`;
    }
    formStep3.setValue('cameraPurposeDescription', cameraPurpose); // This field is essentially 'sceneContext' for the camera

    let aiTarget = '';
    if (groupAIDetectionTarget) {
        aiTarget += `Inherited from group: "${groupAIDetectionTarget}". `;
    }
    aiTarget += 'Additionally, for this specific camera detect...';
    formStep3.setValue('aiDetectionTarget', aiTarget);

    const groupAlertClasses = formStep1.getValues('alertClasses');
    if (groupAlertClasses) {
        formStep3.setValue('cameraAlertEvents', groupAlertClasses); // Renamed from cameraAlertClasses
    }
    setDrawerStep(3);
  };
  
  const handleStep3Back = () => {
      setDrawerStep(2);
  };

  const onSubmitStep3: SubmitHandler<AddCameraStep3Values> = async (data) => {
    console.log("Saving camera...");
    if (!formStep3.formState.isValid) return;
    console.log("Step 1 Data (final):", formStep1.getValues());
    console.log("Step 2 Data (final):", formStep2.getValues());
    console.log("Step 3 Data (final):", data);
    // TODO: Add logic to save camera to Firestore and update the `cameras` state
    handleDrawerClose();
  };

  const handleSendChatMessage = async () => {
    if (!currentChatMessage.trim() || !selectedCameraForChat) return;

    const userMessage: ChatMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: currentChatMessage,
      timestamp: new Date(),
      avatar: 'https://picsum.photos/id/1005/50/50', 
    };

    setChatMessages(prev => [...prev, userMessage]);
    setCurrentChatMessage('');
    setIsSendingMessage(true);

    await new Promise(resolve => setTimeout(resolve, 1500));
    const aiResponse: ChatMessage = {
      id: 'ai-' + Date.now(),
      sender: 'ai',
      text: `Okay, I've processed your message about ${selectedCameraForChat.name}: "${userMessage.text}". What else can I help you with?`,
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

  const renderDrawerContent = () => {
    if (drawerType === 'addCamera') {
      const approvalAlert = !isLoadingOrgStatus && isOrgApproved === false && (
        <Alert variant="destructive" className="mb-4">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Organization Approval Pending</AlertTitle>
          <AlertDescription>
            You can add cameras and set up configurations. However, camera processing will only begin after your organization&apos;s account is approved by an administrator and based on server space availability.
          </AlertDescription>
        </Alert>
      );

      if (drawerStep === 1) {
        return (
          <div className="p-6">
            {approvalAlert}
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
                            <SelectValue placeholder="Select a group" />
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
                            <Plus className="w-4 h-4 mr-2"/> Add a new group for your cameras
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
                            name="groupSceneContext" // Renamed from groupDescription
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center mb-1.5">
                                        <HelpCircle className="w-4 h-4 mr-2 text-muted-foreground"/>What does the cameras in this group looking at?
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
                            name="groupAIDetectionTarget" // Renamed from groupAIDetection
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center mb-1.5">
                                        <Settings2 className="w-4 h-4 mr-2 text-muted-foreground"/>What does the things you want the AI to detect from this group of cameras?
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
                            name="alertClasses"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center mb-1.5">
                                        <ShieldAlert className="w-4 h-4 mr-2 text-muted-foreground"/>Alert Classes
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., safety: worker not wearing ppe, safety: unlit work area" {...field} />
                                    </FormControl>
                                    <p className="text-xs text-muted-foreground mt-1">Enter comma-separated alert classes if any predefined.</p>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
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
            {approvalAlert}
            <Form {...formStep2}>
                <form id="add-camera-form-step2" onSubmit={formStep2.handleSubmit(onSubmitStep2)} className="space-y-6 text-center">
                <div className="flex flex-col items-center space-y-2">
                    <p className="text-sm text-muted-foreground">Testing connection...</p>
                    {!snapshotUrl && !isProcessingStep2 && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                    {snapshotUrl && <CheckCircle className="h-5 w-5 text-green-500" />}
                </div>
                <ArrowDown className="h-5 w-5 text-muted-foreground mx-auto" />
                
                <div className="flex flex-col items-center space-y-2">
                    <p className="text-sm text-muted-foreground">Getting Snapshot...</p>
                    {!snapshotUrl && isProcessingStep2 && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                    {snapshotUrl && <CheckCircle className="h-5 w-5 text-green-500" />}
                </div>

                {snapshotUrl && (
                    <Image
                    src={snapshotUrl}
                    alt="Camera Snapshot"
                    width={400}
                    height={300}
                    className="rounded-md border object-cover aspect-video w-full"
                    data-ai-hint="art gallery exhibition"
                    />
                )}
                {!snapshotUrl && isProcessingStep2 && (
                    <div className="w-full aspect-video bg-muted rounded-md flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}


                <ArrowDown className="h-5 w-5 text-muted-foreground mx-auto" />
                
                <div className="flex flex-col items-center space-y-2">
                    <p className="text-sm text-muted-foreground">Generating Scene Dense Description (for prompt)</p>
                    {isProcessingStep2 && !formStep2.getValues('sceneDescription') && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                    {formStep2.getValues('sceneDescription') && <CheckCircle className="h-5 w-5 text-green-500" />}
                </div>

                <FormField
                    control={formStep2.control}
                    name="sceneDescription" // Was detailedSceneDescription
                    render={({ field }) => (
                        <FormItem className="text-left">
                            <FormLabel className="flex items-center">
                                <Wand2 className="w-4 h-4 mr-2 text-muted-foreground" />
                                Explain the scene?
                            </FormLabel>
                            <FormControl>
                                <div className="relative">
                                <Textarea
                                    placeholder={isProcessingStep2 && !field.value ? "AI is generating description..." : "Generated Dense Description of scene"}
                                    {...field}
                                    rows={3}
                                    readOnly={isProcessingStep2 && !field.value}
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
                {approvalAlert}
                <Form {...formStep3}>
                    <form id="add-camera-form-step3" onSubmit={formStep3.handleSubmit(onSubmitStep3)} className="space-y-6">
                        <FormField
                            control={formStep3.control}
                            name="cameraPurposeDescription" // This is effectively the camera's sceneContext
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center">
                                        <HelpCircle className="w-4 h-4 mr-2 text-muted-foreground" />
                                        What does this camera do? (Scene Context)
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Textarea 
                                                placeholder="Based on the dense description and the group's description, generate the detailed scene" 
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
                            name="aiDetectionTarget" // Renamed from aiDetectionPrompt
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center">
                                        <Wand2 className="w-4 h-4 mr-2 text-muted-foreground" />
                                        What does the things you want the AI to detect from this camera? (AI Detection Target)
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Textarea 
                                                placeholder="If there is Group value + any specific value." 
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
                            name="cameraAlertEvents" // Renamed from cameraAlertClasses
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
                                                <AlertCircleIcon className="w-4 h-4 mr-2 text-muted-foreground" />
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
                                            No of frames
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
                    disabled={formStep1.formState.isSubmitting || !formStep1.formState.isValid}
                >
                    {formStep1.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
                    <AvatarImage src="https://picsum.photos/id/1005/50/50" alt="User" data-ai-hint="user avatar" />
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
        let title = drawerStep === 1 ? "Add New Camera - Step 1" :
               drawerStep === 2 ? "Add New Camera - Step 2" :
               "Add New Camera - Step 3";
        if (!isLoadingOrgStatus && isOrgApproved === false) {
            title += " (Approval Pending)";
        }
        return title;
    }
    if (drawerType === 'chatCamera' && selectedCameraForChat) {
        return `Chat with ${selectedCameraForChat.name}`;
    }
    return "Drawer";
  }


  return (
    <div>
      <div className="flex justify-end items-center mb-6">
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
      {cameras.length === 0 ? (
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
                    alt={camera.name}
                    width={200}
                    height={150}
                    className="rounded-t-lg aspect-video w-full object-cover"
                    data-ai-hint={camera.dataAiHint}
                    />
                    <CheckCircle className="absolute top-2 right-2 h-5 w-5 text-green-500 bg-white rounded-full p-0.5" />
                </div>
                <div className="p-3">
                    <h3 className="text-sm font-semibold mb-2 truncate">{camera.name}</h3>
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


    
