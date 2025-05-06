
'use client';

import type { NextPage } from 'next';
import Image from 'next/image';
import { useState } from 'react';
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
import { CheckCircle, Clock, AlertTriangle, Bell, MessageSquare, Plus, Users, ListFilter, ArrowUpDown, MoreHorizontal, Video, Edit3, Folder, HelpCircle, ShieldAlert, Settings2 } from 'lucide-react';
import RightDrawer from '@/components/RightDrawer'; // Import the RightDrawer component
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


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


const CamerasPage: NextPage = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);
  const [showNewGroupForm, setShowNewGroupForm] = useState(false);

  const handleAddCameraClick = () => {
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setShowNewGroupForm(false); // Reset new group form on close
  };
  
  const handleGroupChange = (value: string) => {
    setSelectedGroup(value);
    if (value === 'add_new_group') {
      setShowNewGroupForm(true);
    } else {
      setShowNewGroupForm(false);
    }
  };

  const drawerFooter = (
    <>
      <Button variant="outline" onClick={handleDrawerClose}>Cancel</Button>
      <Button type="submit" form="add-camera-form">Next</Button> {/* Assuming form ID is "add-camera-form" */}
    </>
  );


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
        title="Add New Camera"
        footerContent={drawerFooter}
      >
        <form id="add-camera-form" className="space-y-8">
          <div className="px-[5px]">
            <Label htmlFor="rtspUrl" className="flex items-center mb-1.5">
                <Video className="w-4 h-4 mr-2 text-muted-foreground"/> RTSP URL
            </Label>
            <Input id="rtspUrl" name="rtspUrl" placeholder="rtsp://..." />
          </div>

          <div className="px-[5px]">
            <Label htmlFor="cameraName" className="flex items-center mb-1.5">
                <Edit3 className="w-4 h-4 mr-2 text-muted-foreground"/> Name
            </Label>
            <Input id="cameraName" name="cameraName" placeholder="e.g., Front Door Camera" />
          </div>
          
          <div className="px-[5px]">
            <Label htmlFor="group" className="flex items-center mb-1.5">
                <Folder className="w-4 h-4 mr-2 text-muted-foreground"/> Group
            </Label>
            <Select onValueChange={handleGroupChange} value={selectedGroup}>
              <SelectTrigger id="group">
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
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
          </div>

          {showNewGroupForm && (
            <Card className="p-4 bg-muted/50">
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center">
                        <Plus className="w-4 h-4 mr-2"/> Add a new group for your cameras
                    </h4>
                    <div className="px-[5px]">
                        <Label htmlFor="newGroupName" className="flex items-center mb-1.5">
                             <Edit3 className="w-4 h-4 mr-2 text-muted-foreground"/>Group Name
                        </Label>
                        <Input id="newGroupName" name="newGroupName" placeholder="e.g., Warehouse Zone 1" />
                    </div>
                    <div className="px-[5px]">
                        <Label htmlFor="groupDescription" className="flex items-center mb-1.5">
                            <HelpCircle className="w-4 h-4 mr-2 text-muted-foreground"/>What does the cameras in this group do?
                        </Label>
                        <Textarea id="groupDescription" name="groupDescription" placeholder="e.g., Monitors the main entrance and exit points." />
                    </div>
                     <div className="px-[5px]">
                        <Label htmlFor="groupAIDetection" className="flex items-center mb-1.5">
                            <Settings2 className="w-4 h-4 mr-2 text-muted-foreground"/>What does the things you want the AI to detect from this group of cameras?
                        </Label>
                        <Textarea id="groupAIDetection" name="groupAIDetection" placeholder="e.g., Detect unauthorized personnel, loitering, package theft." />
                    </div>
                     <div className="px-[5px]">
                        <Label htmlFor="alertClasses" className="flex items-center mb-1.5">
                            <ShieldAlert className="w-4 h-4 mr-2 text-muted-foreground"/>Alert Classes
                        </Label>
                        <Input id="alertClasses" name="alertClasses" placeholder="e.g., safety: worker not wearing ppe, safety: unlit work area" />
                        <p className="text-xs text-muted-foreground mt-1">Enter comma-separated alert classes if any predefined.</p>
                    </div>
                </div>
            </Card>
          )}
        </form>
      </RightDrawer>
    </div>
  );
};

export default CamerasPage;
