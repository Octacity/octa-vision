
'use client';

import type { UseFormReturn } from 'react-hook-form';
import type { AddCameraStep3Values } from '@/app/(main)/cameras/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, HelpCircle, Wand2, Diamond, Film, BarChart, AlertCircle as AlertCircleIconLucide } from 'lucide-react';

interface AddCameraStep3FormProps {
  formStep3: UseFormReturn<AddCameraStep3Values>;
  onSubmitStep3: (data: AddCameraStep3Values) => void;
}

const AddCameraStep3Form: React.FC<AddCameraStep3FormProps> = ({
  formStep3,
  onSubmitStep3,
}) => {
  return (
    <div className="p-6">
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
              <FormItem>
                <FormLabel className="flex items-center">
                  <Wand2 className="w-4 h-4 mr-2 text-muted-foreground" />
                  What does the things you want the AI to detect from this camera? (AI Detection Target)
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="e.g., Detect unauthorized personnel, loitering, package theft."
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
            name="alertEvents"
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
      </Form>
    </div>
  );
};

export default AddCameraStep3Form;
