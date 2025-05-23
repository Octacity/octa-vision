
'use client';

import { useState } from 'react';
import type { UseFormReturn, FieldErrors } from 'react-hook-form';
import { useFieldArray, useWatch } from 'react-hook-form';
import type { AddCameraStep3Values } from '@/app/(main)/cameras/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; // Corrected import path
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CalendarDays, HelpCircle, Wand2, Diamond, Film, BarChart, AlertCircle as AlertCircleIconLucide, PlusCircle, Trash2, Loader2, Sparkles } from 'lucide-react';
import { vssBasePromptTemplate, vssCaptionPromptTemplate, vssSummaryPromptTemplate } from '@/lib/vssPrompts';
import { useLanguage } from '@/contexts/LanguageContext'; // Added for translation if needed
import { useToast } from '@/hooks/use-toast'; // Added for notifications
import { suggestDetectionTargets } from '@/ai/flows/suggest-detection-targets'; // Assuming this is the correct path
import { suggestAlertEvents } from '@/ai/flows/suggest-alert-events'; // Assuming this is the correct path


interface AddCameraStep3FormProps {
  formStep3: UseFormReturn<AddCameraStep3Values>;
  onSubmitStep3: (data: AddCameraStep3Values) => void;
  getStep2Values: () => { sceneDescription?: string | null; cameraSceneContext?: string | null }; // Function to get values from Step 2
}

const AddCameraStep3Form: React.FC<AddCameraStep3FormProps> = ({
  formStep3,
  onSubmitStep3,
  getStep2Values,
}) => {
  const { control, formState, getValues, setValue } = formStep3;
  const { errors } = formState;
  const { language } = useLanguage();
  const { toast } = useToast();

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'alertEvents',
  });

  const [isGeneratingDetectionTarget, setIsGeneratingDetectionTarget] = useState(false);
  const [isGeneratingAlertEvents, setIsGeneratingAlertEvents] = useState(false);

  const watchedFields = useWatch({
    control,
    name: ['cameraSceneContext', 'aiDetectionTarget', 'alertEvents', 'sceneDescription'],
  });


  const handleSuggestDetectionTarget = async () => {
    setIsGeneratingDetectionTarget(true);
    const { cameraSceneContext, sceneDescription } = getStep2Values();
    try {
      const response = await suggestDetectionTargets({
        cameraSceneContext: cameraSceneContext || '',
        sceneDescription: sceneDescription || '',
        language: language,
      });
      if (response && response.suggestedTargets && !response.suggestedTargets.startsWith("Error:")) {
        setValue('aiDetectionTarget', response.suggestedTargets);
        toast({ title: "AI Suggestions", description: "Detection targets suggested." });
      } else {
        toast({ variant: "destructive", title: "Suggestion Failed", description: response.suggestedTargets || "Could not suggest detection targets." });
      }
    } catch (error: any) {
      console.error('Error suggesting detection targets:', error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to get suggestions." });
    }
    setIsGeneratingDetectionTarget(false);
  };

  const handleSuggestAlertEvents = async () => {
    setIsGeneratingAlertEvents(true);
    const { cameraSceneContext } = getStep2Values();
    const aiDetectionTarget = getValues('aiDetectionTarget');
    try {
      const response = await suggestAlertEvents({
        cameraSceneContext: cameraSceneContext || '',
        aiDetectionTarget: aiDetectionTarget || '',
        language: language,
      });
      if (response && Array.isArray(response.suggestedAlerts) && response.suggestedAlerts.length > 0 && !response.suggestedAlerts[0]?.name?.startsWith("Error:")) {
        replace(response.suggestedAlerts.map(alert => ({ name: alert.name, condition: alert.condition || '' })));
        toast({ title: "AI Suggestions", description: "Alert events suggested." });
      } else {
        let errorMsg = "Could not suggest alert events.";
        if(response && Array.isArray(response.suggestedAlerts) && response.suggestedAlerts[0]?.name?.startsWith("Error:")){
            errorMsg = response.suggestedAlerts[0].name;
        } else if (response && (response as any).error) {
            errorMsg = (response as any).error;
        }
        toast({ variant: "destructive", title: "Suggestion Failed", description: errorMsg });
      }
    } catch (error: any) {
      console.error('Error suggesting alert events:', error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to get alert event suggestions." });
    }
    setIsGeneratingAlertEvents(false);
  };

  const alertEventsErrors = errors.alertEvents as FieldErrors<{ name: string; condition: string }>[] | undefined;

  // Calculate derived values for VSS prompts
  const vssData = {
    cameraSceneContext: getStep2Values().cameraSceneContext || '',
    aiDetectionTarget: getValues('aiDetectionTarget') || '',
    alertEvents: getValues('alertEvents') || [],
    sceneDescription: getStep2Values().sceneDescription || '',
  };

  return (
    <div className="p-6">
      <Form {...formStep3}>
        <form id="add-camera-form-step3" onSubmit={formStep3.handleSubmit(onSubmitStep3)} className="space-y-6">
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
                disabled={isGeneratingAlertEvents || !getValues('aiDetectionTarget')}
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
             {errors.alertEvents?.root?.message && <p className="text-sm font-medium text-destructive mt-2">{errors.alertEvents.root.message}</p>}
          </div>

          {/* Video Processing Configuration */}
          <div className="space-y-4 mt-6">
            <h3 className="text-base font-semibold flex items-center">
                <Film className="w-4 h-4 mr-2 text-muted-foreground"/>
                Video Processing Settings
            </h3>
            <div className="grid grid-cols-2 gap-x-4">
                <FormField
                control={formStep3.control}
                name="videoChunksValue"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="flex items-center text-xs">Video Chunks</FormLabel>
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
                    <FormLabel className="flex items-center text-xs">
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
                    <FormLabel className="flex items-center text-xs">
                        <BarChart className="w-4 h-4 mr-2 text-muted-foreground" />
                        No. of Frames (per chunk)
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
        {(vssData.cameraSceneContext || vssData.aiDetectionTarget || (vssData.alertEvents && vssData.alertEvents.length > 0)) && (
          <div className="mt-8 space-y-6">
            <h3 className="text-base font-semibold">Generated VSS Prompts (Read-only for review)</h3>
            <FormItem>
              <FormLabel className="flex items-center text-sm">VSS Base Prompt</FormLabel>
              <FormControl>
                <Textarea
                  value={vssBasePromptTemplate(vssData)}
                  readOnly
                  rows={6}
                  className="font-mono text-xs bg-muted/50"
                />
              </FormControl>
            </FormItem>

            <FormItem>
              <FormLabel className="flex items-center text-sm">VSS Caption Prompt</FormLabel>
              <FormControl>
                <Textarea
                   value={vssCaptionPromptTemplate(vssData)}
                  readOnly
                  rows={6}
                  className="font-mono text-xs bg-muted/50"
                />
              </FormControl>
            </FormItem>

            <FormItem>
              <FormLabel className="flex items-center text-sm">VSS Summary Prompt</FormLabel>
              <FormControl>
                 <Textarea
                   value={vssSummaryPromptTemplate(vssData)}
                  readOnly
                  rows={10}
                  className="font-mono text-xs bg-muted/50"
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
