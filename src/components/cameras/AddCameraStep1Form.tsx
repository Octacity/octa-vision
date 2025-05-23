
'use client';

import type { UseFormReturn } from 'react-hook-form';
import { useState } from 'react';
import type { AddCameraStep1Values, Group } from '@/app/(main)/cameras/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Video, Edit3, Folder, Plus, XCircle, HelpCircle, Settings2, ShieldAlert, Film, BarChart, AlertCircle as AlertCircleIconLucide, Loader2, Sparkles, Eye, EyeOff } from 'lucide-react';
import type { RefObject } from 'react';

interface AddCameraStep1FormProps {
  formStep1: UseFormReturn<AddCameraStep1Values>;
  onSubmitStep1: (data: AddCameraStep1Values) => void;
  groups: Group[];
  showNewGroupForm: boolean;
  handleGroupChange: (value: string) => void;
  handleCancelAddNewGroup: () => void;
  newGroupNameInputRef: RefObject<HTMLInputElement>;
  handleGenerateGroupAlerts: () => void;
  isGeneratingAlerts: boolean;
  isProcessingStep1Submitting: boolean;
  showRtspPassword: boolean;
  setShowRtspPassword: (show: boolean) => void;
  onConnectionSuccess: () => void; // Add a callback for successful connection/snapshot
  onConnectionError: (error: string) => void; // Add a callback for connection errors
}

const AddCameraStep1Form: React.FC<AddCameraStep1FormProps> = ({
  formStep1,
  onSubmitStep1,
  groups,
  showNewGroupForm,
  handleGroupChange,
  handleCancelAddNewGroup,
  newGroupNameInputRef,
  handleGenerateGroupAlerts,
  isGeneratingAlerts,
  isProcessingStep1Submitting,
  showRtspPassword,
  setShowRtspPassword,
  onConnectionSuccess,
  onConnectionError,
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const rtspUrlValue = formStep1.watch('rtspUrl');

  const handleTestConnection = async () => {
    setConnectionError(null);
    setIsConnecting(true);

    // Simulate camera connection and snapshot retrieval
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate network delay

    // Simulate success or failure
    if (rtspUrlValue && rtspUrlValue.includes('fail')) {
      setConnectionError('Failed to connect to the camera or retrieve snapshot.');
      onConnectionError('Failed to connect to the camera or retrieve snapshot.');
    } else {
      // In a real scenario, you would get the snapshot data here
      // For simulation, just call the success callback
      onConnectionSuccess();
    }

    setIsConnecting(false);
  };

  return (
    <div className="p-6">
      <Form {...formStep1}>
        <form id="add-camera-form-step1" onSubmit={formStep1.handleSubmit(onSubmitStep1)} className="space-y-6">
          <FormField
            name="rtspUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center">
                  <Video className="w-4 h-4 mr-2 text-muted-foreground" /> RTSP URL
                </FormLabel>
                <FormControl>
                  <Input placeholder="rtsp://..." {...field} />
                </FormControl>
                <FormMessage />
 {connectionError && (
                  <p className="text-sm font-medium text-destructive">{connectionError}</p>
 )}
              </FormItem>
            )}
          />

          <Button
            type="button" // Important: prevent form submission
            onClick={handleTestConnection}
            disabled={isConnecting || !rtspUrlValue}
          >
            {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Test Connection / Get Snapshot
          </Button>
          <FormField
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
            name="cameraName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center">
                  <Edit3 className="w-4 h-4 mr-2 text-muted-foreground" /> Name
                </FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Front Door Camera" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="group"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center">
                  <Folder className="w-4 h-4 mr-2 text-muted-foreground" /> Group
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
                    <Plus className="w-4 h-4 mr-2" /> Add a new group for your cameras or videos
                  </h4>
                  <Button type="button" variant="ghost" size="sm" onClick={handleCancelAddNewGroup} className="text-xs">
                    <XCircle className="w-3 h-3 mr-1" /> Cancel
                  </Button>
                </div>
                <FormField
                  name="newGroupName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Edit3 className="w-4 h-4 mr-2 text-muted-foreground" />Group Name
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Warehouse Zone 1" {...field} ref={newGroupNameInputRef} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="groupDefaultCameraSceneContext"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <HelpCircle className="w-4 h-4 mr-2 text-muted-foreground" />What does the cameras in this group looking at? (Group Default)
                      </FormLabel>
                      <FormControl>
                        <Textarea placeholder="e.g., Monitors the main entrance and exit points." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="groupDefaultAiDetectionTarget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Settings2 className="w-4 h-4 mr-2 text-muted-foreground" />What does the things you want the AI to detect from this group of cameras? (Group Default)
                      </FormLabel>
                      <FormControl>
                        <Textarea placeholder="e.g., Detect unauthorized personnel, loitering, package theft." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="groupDefaultAlertEvents"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center justify-between">
                        <span className="flex items-center">
                          <ShieldAlert className="w-4 h-4 mr-2 text-muted-foreground" />Group Alert Events (Default)
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
                    <FormField control={formStep1.control} name="groupDefaultVideoChunksValue" render={({ field }) => (<FormItem> <FormLabel className="text-xs">Video Chunks</FormLabel> <FormControl><Input type="number" placeholder="10" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={formStep1.control} name="groupDefaultVideoChunksUnit" render={({ field }) => (<FormItem className="self-end"> <Select onValueChange={field.onChange} defaultValue={field.value || 'seconds'}><FormControl><SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger></FormControl><SelectContent><SelectItem value="seconds">Secs</SelectItem><SelectItem value="minutes">Mins</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4">
                    <FormField control={formStep1.control} name="groupDefaultVideoOverlapValue" render={({ field }) => (<FormItem> <FormLabel className="text-xs">Video Overlap</FormLabel> <FormControl><Input type="number" placeholder="2" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={formStep1.control} name="groupDefaultVideoOverlapUnit" render={({ field }) => (<FormItem className="self-end"> <Select onValueChange={field.onChange} defaultValue={field.value || 'seconds'}><FormControl><SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger></FormControl><SelectContent><SelectItem value="seconds">Secs</SelectItem><SelectItem value="minutes">Mins</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                  </div>
                  <FormField control={formStep1.control} name="groupDefaultNumFrames" render={({ field }) => (<FormItem> <FormLabel className="text-xs">No. of Frames</FormLabel> <FormControl><Input type="number" placeholder="5" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
              </div>
            </Card>
          )}
        </form>
      </Form>
    </div>
  );
};

export default AddCameraStep1Form;
