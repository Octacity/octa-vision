
'use client';

import type { UseFormReturn, FieldErrors } from 'react-hook-form';
import type { AddCameraStep3Values } from '@/app/(main)/cameras/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CalendarDays, HelpCircle, Wand2, Film, BarChart, Loader2, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import AlertConfigurationForm from './AlertConfigurationForm'; // Import the new component

interface AddCameraStep3FormProps {
  formStep3: UseFormReturn<AddCameraStep3Values>;
  onSubmitStep3: (data: AddCameraStep3Values) => void;
  handleSuggestDetectionTargets: () => Promise<void>;
  isSuggestingDetectionTargets: boolean;
  handleSuggestAlertEvents: () => Promise<void>; // Passed to AlertConfigurationForm
  isSuggestingAlertEvents: boolean; // Passed to AlertConfigurationForm
  getCameraSceneContext: () => string | undefined;
  getSceneDescription: () => string | undefined;
}

const AddCameraStep3Form: React.FC<AddCameraStep3FormProps> = ({
  formStep3,
  onSubmitStep3,
  handleSuggestDetectionTargets,
  isSuggestingDetectionTargets,
  handleSuggestAlertEvents, // Prop for AI suggestion
  isSuggestingAlertEvents,  // Prop for AI suggestion loading state
  getCameraSceneContext,
  getSceneDescription,
}) => {
  const { control, formState, getValues, setValue } = formStep3;
  const { errors } = formState;
  const { translate } = useLanguage();

  return (
    <div className="p-6">
      <Form {...formStep3}>
        <form id="add-camera-form-step3" onSubmit={formStep3.handleSubmit(onSubmitStep3)} className="space-y-6">
          <FormField
            control={control}
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

          {/* Use the new AlertConfigurationForm component */}
          <AlertConfigurationForm
            control={control}
            setValue={setValue}
            getValues={getValues}
            errors={errors}
            handleSuggestAlertEvents={handleSuggestAlertEvents}
            isSuggestingAlertEvents={isSuggestingAlertEvents}
          />

          <div className="space-y-4 mt-6">
            <h3 className="text-base font-semibold flex items-center">
                <Film className="w-4 h-4 mr-2 text-muted-foreground"/>
                Video Processing Settings
            </h3>
            <div className="grid grid-cols-2 gap-x-4">
                <FormField
                control={control}
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
                control={control}
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
                control={control}
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
                control={control}
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
                control={control}
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
