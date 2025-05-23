
'use client';

import { useState } from 'react';
import type { UseFormReturn, FieldErrors } from 'react-hook-form';
import { useFieldArray } from 'react-hook-form';
import type { AddCameraStep3Values } from '@/app/(main)/cameras/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CalendarDays, HelpCircle, Wand2, Diamond, Film, BarChart, AlertCircle as AlertCircleIconLucide, PlusCircle, Trash2, Loader2, Sparkles } from 'lucide-react';
import { vssBasePromptTemplate, vssCaptionPromptTemplate, vssSummaryPromptTemplate } from '@/lib/vssPrompts';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';


interface AddCameraStep3FormProps {
  formStep3: UseFormReturn<AddCameraStep3Values>;
  onSubmitStep3: (data: AddCameraStep3Values) => void;
  handleSuggestDetectionTargets: () => Promise<void>;
  isSuggestingDetectionTargets: boolean;
  handleSuggestAlertEvents: () => Promise<void>;
  isSuggestingAlertEvents: boolean;
}

const AddCameraStep3Form: React.FC<AddCameraStep3FormProps> = ({
  formStep3,
  onSubmitStep3,
  handleSuggestDetectionTargets,
  isSuggestingDetectionTargets,
  handleSuggestAlertEvents,
  isSuggestingAlertEvents,
}) => {
  const { control, formState, getValues, setValue } = formStep3;
  const { errors } = formState;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'alertEvents',
  });

  const alertEventsErrors = errors.alertEvents as FieldErrors<{ name: string; condition: string }>[] | undefined;
  
  // This part is problematic as formStep2 is not available here.
  // The necessary values (cameraSceneContext, sceneDescription) for prompt generation
  // need to be passed from the parent (CamerasPage) or fetched if not available.
  // For now, I'll assume CamerasPage will pass the necessary context if these prompts are to be displayed here.
  // For simplicity of this component, I will remove the direct VSS prompt display from here.
  // The VSS prompts are generated in CamerasPage onSubmitStep3.

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
                    onClick={handleSuggestDetectionTargets}
                    disabled={isSuggestingDetectionTargets}
                    className="text-xs"
                  >
                    {isSuggestingDetectionTargets ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                    Suggest
                  </Button>
                </div>
                <FormControl>
                  <Textarea
                    placeholder="e.g., People, vehicles, packages, safety vests"
                    {...field}
                    value={field.value || ''}
                    rows={3}
                    disabled={isSuggestingDetectionTargets}
                  />
                </FormControl>
                {isSuggestingDetectionTargets && <p className="text-xs text-muted-foreground mt-1 text-primary">AI is generating suggestions...</p>}
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
                disabled={isSuggestingAlertEvents || !getValues('aiDetectionTarget')}
                className="text-xs"
              >
                 {isSuggestingAlertEvents ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
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
                          <Input placeholder="e.g., Unauthorized Entry" {...field} value={field.value || ''} />
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
                          <Input placeholder="e.g., Person detected in restricted area" {...field} value={field.value || ''} />
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
             {isSuggestingAlertEvents && <p className="text-xs text-muted-foreground mt-1 text-primary">AI is generating suggestions...</p>}
             {fields.length === 0 && !isSuggestingAlertEvents && (
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
      </Form>
    </div>
  );
};

export default AddCameraStep3Form;
