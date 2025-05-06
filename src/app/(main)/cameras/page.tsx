
'use client';

import type { NextPage } from 'next';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

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
import { CheckCircle, Clock, AlertTriangle, Bell, MessageSquare, Plus, Users, ListFilter, ArrowUpDown, MoreHorizontal, Video, Edit3, Folder, HelpCircle, ShieldAlert, Settings2, ArrowDown, Wand2, Mic, Loader2 } from 'lucide-react';
import RightDrawer from '@/components/RightDrawer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const cameras = [
  {
    id: '1',
    name: 'Camera 1',
    imageUrl: 'https://picsum.photos/id/237/200/150',
    dataAiHint: 'security camera',
  },
  {
    id: '2',
    name: 'Camera 2',
    imageUrl: 'https://picsum.photos/id/238/200/150',
    dataAiHint: 'office surveillance',
  },
  {
    id: '3',
    name: 'Camera 3',
    imageUrl: 'https://picsum.photos/id/239/200/150',
    dataAiHint: 'street view',
  },
  {
    id: '4',
    name: 'Camera 4',
    imageUrl: 'https://picsum.photos/id/240/200/150',
    dataAiHint: 'parking lot',
  },
  {
    id: '5',
    name: 'Camera 5',
    imageUrl: 'https://picsum.photos/id/241/200/150',
    dataAiHint: 'indoor retail',
  },
  {
    id: '6',
    name: 'Camera 6',
    imageUrl: 'https://picsum.photos/id/242/200/150',
    dataAiHint: 'warehouse aisle',
  },
  {
    id: '7',
    name: 'Camera 7',
    imageUrl: 'https://picsum.photos/id/243/200/150',
    dataAiHint: 'lobby entrance',
  },
  {
    id: '8',
    name: 'Camera 8',
    imageUrl: 'https://picsum.photos/id/244/200/150',
    dataAiHint: 'exterior building',
  },
  {
    id: '9',
    name: 'Camera 9',
    imageUrl: 'https://picsum.photos/id/245/200/150',
    dataAiHint: 'rooftop view',
  },
];

const groups = [
    { id: 'group1', name: 'Warehouse Section A' },
    { id: 'group2', name: 'Office Entrance' },
    { id: 'group3', name: 'Retail Floor - Aisles' },
];

const addCameraStep1Schema = z.object({
  rtspUrl: z.string().url({ message: "Invalid RTSP URL format." }).min(1, "RTSP URL is required."),
  cameraName: z.string().min(1, "Camera name is required."),
  group: z.string().optional(),
  newGroupName: z.string().optional(),
  groupDescription: z.string().optional(),
  groupAIDetection: z.string().optional(),
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

const CamerasPage: NextPage = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerStep, setDrawerStep] = useState(1);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);
  const [showNewGroupForm, setShowNewGroupForm] = useState(false);
  const [isProcessingStep2, setIsProcessingStep2] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [sceneDescription, setSceneDescription] = useState<string | null>(null);


  const form = useForm<AddCameraStep1Values>({
    resolver: zodResolver(addCameraStep1Schema),
    defaultValues: {
      rtspUrl: '',
      cameraName: '',
      group: undefined,
      newGroupName: '',
      groupDescription: '',
      groupAIDetection: '',
      alertClasses: '',
    },
  });

  const handleAddCameraClick = () => {
    form.reset();
    setDrawerStep(1);
    setIsDrawerOpen(true);
    setShowNewGroupForm(false);
    setSelectedGroup(undefined);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setShowNewGroupForm(false);
    setDrawerStep(1); // Reset step on close
    form.reset();
  };
  
  const handleGroupChange = (value: string) => {
    setSelectedGroup(value);
    form.setValue('group', value);
    if (value === 'add_new_group') {
      setShowNewGroupForm(true);
    } else {
      setShowNewGroupForm(false);
    }
  };

  const onSubmitStep1: SubmitHandler<AddCameraStep1Values> = async (data) => {
    console.log("Step 1 Data:", data);
    setIsProcessingStep2(true);
    setDrawerStep(2);
    // Simulate API calls for step 2
    // 1. Testing connection (dummy delay)
    await new Promise(resolve => setTimeout(resolve, 1500));
    // 2. Getting snapshot (dummy delay and set image)
    await new Promise(resolve => setTimeout(resolve, 1500));
    setSnapshotUrl('https://picsum.photos/seed/step2snapshot/400/300'); // Placeholder snapshot
    // 3. Generating scene description (dummy delay and set description)
    await new Promise(resolve => setTimeout(resolve, 2000));
    setSceneDescription('This is an art gallery with various paintings on display. Several visitors are admiring the artwork. The lighting is bright and even.');
    setIsProcessingStep2(false);
  };

  const handleStep2Back = () => {
    setDrawerStep(1);
    setSnapshotUrl(null);
    setSceneDescription(null);
  };

  const handleStep2Save = () => {
    console.log("Saving camera...");
    // Actual save logic here
    handleDrawerClose();
  };

  const renderDrawerContent = () => {
    if (drawerStep === 1) {
      return (
        <Form {...form}>
          <form id="add-camera-form-step1" onSubmit={form.handleSubmit(onSubmitStep1)} className="space-y-8">
            <FormField
              control={form.control}
              name="rtspUrl"
              render={({ field }) => (
                <FormItem className="px-[5px]">
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
              control={form.control}
              name="cameraName"
              render={({ field }) => (
                <FormItem className="px-[5px]">
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
              control={form.control}
              name="group"
              render={({ field }) => (
                <FormItem className="px-[5px]">
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
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
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
              <Card className="p-4 bg-muted/50 mx-[5px]">
                  <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center">
                          <Plus className="w-4 h-4 mr-2"/> Add a new group for your cameras
                      </h4>
                      <FormField
                        control={form.control}
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
                        control={form.control}
                        name="groupDescription"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center mb-1.5">
                                    <HelpCircle className="w-4 h-4 mr-2 text-muted-foreground"/>What does the cameras in this group do?
                                </FormLabel>
                                <FormControl>
                                    <Textarea placeholder="e.g., Monitors the main entrance and exit points." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="groupAIDetection"
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
                        control={form.control}
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
      );
    } else if (drawerStep === 2) {
      return (
        <div className="space-y-6 px-[5px] text-center">
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
            {isProcessingStep2 && !sceneDescription && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            {sceneDescription && <CheckCircle className="h-5 w-5 text-green-500" />}
          </div>

          <div className="space-y-2 text-left">
            <Label htmlFor="scene-explanation" className="flex items-center">
              <Wand2 className="w-4 h-4 mr-2 text-muted-foreground" />
              Explain the scene?
            </Label>
            <div className="relative">
              <Textarea
                id="scene-explanation"
                placeholder={isProcessingStep2 && !sceneDescription ? "AI is generating description..." : "Generated Dense Description of scene"}
                value={sceneDescription || ""}
                onChange={(e) => setSceneDescription(e.target.value)}
                rows={3}
                readOnly={isProcessingStep2 && !sceneDescription}
                className="pr-10"
              />
              <Button variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7">
                <Mic className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const drawerFooter = () => {
    if (drawerStep === 1) {
      return (
        <>
          <Button variant="outline" onClick={handleDrawerClose}>Cancel</Button>
          <Button type="submit" form="add-camera-form-step1">Next</Button>
        </>
      );
    } else if (drawerStep === 2) {
      return (
        <>
          <Button variant="outline" onClick={handleStep2Back}>Back</Button>
          <Button onClick={handleStep2Save} disabled={isProcessingStep2}>
            {isProcessingStep2 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Camera
          </Button>
        </>
      );
    }
    return null;
  };


  return (
    <div>
      <div className="flex justify-end items-center mb-6">
        <div className="flex items-center space-x-2">
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
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Bell className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <RightDrawer
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        title={drawerStep === 1 ? "Add New Camera - Step 1" : "Add New Camera - Step 2"}
        footerContent={drawerFooter()}
      >
        {renderDrawerContent()}
      </RightDrawer>
    </div>
  );
};

export default CamerasPage;
