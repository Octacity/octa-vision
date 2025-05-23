
'use client';

import { useState } from 'react';
import type { UseFormReturn, FieldErrors } from 'react-hook-form';
import { useFieldArray, useWatch } from 'react-hook-form';
import type { AddCameraStep3Values } from '@/app/(main)/cameras/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@radix-ui/react-textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CalendarDays, HelpCircle, Wand2, Diamond, Film, BarChart, AlertCircle as AlertCircleIconLucide, PlusCircle, Trash2, Loader2, Sparkles } from 'lucide-react';
import { vssBasePromptTemplate, vssCaptionPromptTemplate, vssSummaryPromptTemplate } from '@/lib/vssPrompts';

interface AddCameraStep3FormProps {
  formStep3: UseFormReturn<AddCameraStep3Values>;
  onSubmitStep3: (data: AddCameraStep3Values) => void;
}

const AddCameraStep3Form: React.FC<AddCameraStep3FormProps> = ({
  formStep3,
  onSubmitStep3,
}) => {
  const { control, formState } = formStep3;
  const { errors } = formState;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'alertEvents',
  });

  const [isGeneratingDetectionTarget, setIsGeneratingDetectionTarget] = useState(false);
  const [detectionTargetError, setDetectionTargetError] = useState<string | null>(null);
  const [isGeneratingAlertEvents, setIsGeneratingAlertEvents] = useState(false);

  // Watch relevant fields to update VSS prompts
  const watchedFields = useWatch({
    control,
    name: ['cameraSceneContext', 'aiDetectionTarget', 'alertEvents'],
  });

  const handleSuggestDetectionTarget = async () => {
    setIsGeneratingDetectionTarget(true);
    setDetectionTargetError(null); // Clear previous errors

    try {
      const response = await fetch('/api/suggest-detection-targets', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cameraSceneContext: formStep3.getValues('cameraSceneContext'), aiDetectionTarget: formStep3.getValues('aiDetectionTarget') }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to suggest detection targets');
 formStep3.setValue('aiDetectionTarget', data.suggestedTargets);
    } catch (error: any) {
 console.error('Error suggesting detection targets:', error);
 setDetectionTargetError(error.message || 'Failed to get suggestions.');
    }
    setIsGeneratingDetectionTarget(false);
  };

  const handleSuggestAlertEvents = async () => {
    setIsGeneratingAlertEvents(true);
    // Simulate API call with AI detection target and scene context
    // In a real scenario, you'd send cameraSceneContext and aiDetectionTarget to your AI API
    const sceneContext = formStep3.getValues('cameraSceneContext') || '';
    const detectionTarget = formStep3.getValues('aiDetectionTarget') || '';

    try {
      const response = await fetch('/api/suggest-alert-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cameraSceneContext: sceneContext, aiDetectionTarget: detectionTarget }),
      });
      const suggestedAlerts = await response.json(); // Assume the API returns the array directly
      if (!response.ok) throw new Error(suggestedAlerts.error || 'Failed to suggest alert events');
      replace(suggestedAlerts); // Replace existing alerts with suggestions
    } catch (error: any) {
      console.error('Error suggesting alert events:', error);
    }

    setIsGeneratingAlertEvents(false);
  };
  // Helper to cast errors for field array
  const alertEventsErrors = errors.alertEvents as FieldErrors<{ name: string; condition: string }>[] | undefined;

  return (
    <div className="p-6">
      {/* Use watched fields to generate VSS prompts */}
      {formStep3.getValues('cameraSceneContext') || formStep3.getValues('aiDetectionTarget') || fields.length > 0 ? (
        <>
        {/* VSS Prompts will be displayed here based on watched fields */}
        </>
      ) : null}


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
              <FormItem className="text-left">
                <div className="flex items-center justify-between">
                  <FormLabel className="flex items-center">
                    <Wand2 className="w-4 h-4 mr-2 text-muted-foreground" />
                    What specific objects or events should the AI detect?
                  </FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSuggestDetectionTarget}
                    disabled={isGeneratingDetectionTarget}
                    className="text-xs"
                  >
                    {isGeneratingDetectionTarget ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                    Suggest
                  </Button>
                </div>
                <FormControl>
                  <Textarea
                    placeholder="e.g., People, vehicles, packages, safety vests"
                    {...field}
                    rows={3}
                    disabled={isGeneratingDetectionTarget}
                  />
                </FormControl>
                {isGeneratingDetectionTarget && <p className="text-xs text-muted-foreground mt-1 text-primary">AI is generating suggestions...</p>}
                {detectionTargetError && <p className="text-xs text-destructive mt-1">{detectionTargetError}</p>}
                <FormMessage />
              </FormItem>
            )}
          />

          <div>
            <div className="flex items-center justify-between mb-4">
              <FormLabel className="flex items-center text-base">
                <Diamond className="w-4 h-4 mr-2 text-muted-foreground" />
                Define Alert Events
              </FormLabel>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSuggestAlertEvents}
                disabled={isGeneratingAlertEvents}
                className="text-xs"
              >
                 {isGeneratingAlertEvents ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                Suggest Alert Events
              </Button>
            </div>
            <div className="space-y-4">
              {fields.map((item, index) => (
                <div key={item.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded-md p-4">
                   <FormField
                    control={control}
                    name={`alertEvents.${index}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center text-xs">Alert Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Unauthorized Entry" {...field} />
                        </FormControl>
                        <FormMessage>{alertEventsErrors?.[index]?.name?.message}</FormMessage>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name={`alertEvents.${index}.condition`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center text-xs">Alert Condition/Description</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Person detected in restricted area" {...field} />
                        </FormControl>
                         <FormMessage>{alertEventsErrors?.[index]?.condition?.message}</FormMessage>
                      </FormItem>
                    )}
                  />
                  <div className="md:col-span-2 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      className="text-red-500 hover:text-red-600 text-xs"
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
             {isGeneratingAlertEvents && <p className="text-xs text-muted-foreground mt-1 text-primary">AI is generating suggestions...</p>}
             {fields.length === 0 && !isGeneratingAlertEvents && (
                <p className="text-sm text-muted-foreground text-center mt-4">Click below to add your first alert event or use the AI suggestions.</p>
             )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ name: '', condition: '' })}
              className="mt-4 w-full"
            >
              <PlusCircle className="h-4 w-4 mr-2" /> Add New Alert Event
            </Button>
             {alertEventsErrors?.message && <p className="text-sm font-medium text-destructive mt-2">{alertEventsErrors.message}</p>}
          </div>

          {/* Video Processing Configuration */}
          <div className="grid grid-cols-1 gap-y-6 mt-6">
            <h3 className="text-lg font-semibold">Video Processing Settings</h3>
            <div className="grid grid-cols-2 gap-x-4">
                <FormField
                control={formStep3.control}
                name="videoOverlapValue" // Make sure this matches the type definition
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

        {/* Display Generated VSS Prompts */}
        {(formStep3.getValues('cameraSceneContext') || formStep3.getValues('aiDetectionTarget') || fields.length > 0) && (
          <div className="mt-8 space-y-6">
            <h3 className="text-lg font-semibold">Generated VSS Prompts (Read-only)</h3>
            <FormItem>
              <FormLabel className="flex items-center">VSS Base Prompt</FormLabel>
              <FormControl>
                <Textarea
                  value={vssBasePromptTemplate({
                    cameraSceneContext: formStep3.getValues('cameraSceneContext'),
                    aiDetectionTarget: formStep3.getValues('aiDetectionTarget'),
                    alertEvents: fields, // Use the fields array from useFieldArray
                    sceneDescription: formStep3.getValues('sceneDescription'), // Include sceneDescription if available
                  })}
                  readOnly
                  rows={6}
                  className="font-mono text-xs"
                />
              </FormControl>
            </FormItem>

            <FormItem>
              <FormLabel className="flex items-center">VSS Caption Prompt</FormLabel>
              <FormControl>
                <Textarea
                   value={vssCaptionPromptTemplate({
                    cameraSceneContext: formStep3.getValues('cameraSceneContext'),
                    aiDetectionTarget: formStep3.getValues('aiDetectionTarget'),
                    alertEvents: fields, // Use the fields array
                     sceneDescription: formStep3.getValues('sceneDescription'), // Include sceneDescription
                  })}
                  readOnly
                  rows={6}
                  className="font-mono text-xs"
                />
              </FormControl>
            </FormItem>

            <FormItem>
              <FormLabel className="flex items-center">VSS Summary Prompt</FormLabel>
              <FormControl>
                 <Textarea
                   value={vssSummaryPromptTemplate({
                    cameraSceneContext: formStep3.getValues('cameraSceneContext'),
                    aiDetectionTarget: formStep3.getValues('aiDetectionTarget'),
                    alertEvents: fields, // Use the fields array
                     sceneDescription: formStep3.getValues('sceneDescription'), // Include sceneDescription
                  })}
                  readOnly
                  rows={10}
                  className="font-mono text-xs"
                />
              </FormControl>
            </FormItem>
          </div>
        )}

      </Form>
    </div>
  );
};

export default AddCameraStep3Form;
