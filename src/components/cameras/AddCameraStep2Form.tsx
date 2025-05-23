
'use client';

import * as React from 'react'; // Ensure React is imported
import type { UseFormReturn } from 'react-hook-form';
// Removed: import { useSetState } from '@react-spring/web';
import Image from 'next/image';
import type { AddCameraStep2Values } from '@/app/(main)/cameras/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Camera as CameraIconLucide, Loader2, Wand2, HelpCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast'; // Assuming useToast is for notifications

interface AddCameraStep2FormProps {
  formStep2: UseFormReturn<AddCameraStep2Values>;
  onSubmitStep2: (data: AddCameraStep2Values) => void;
  isProcessingStep2Snapshot: boolean;
  isLoadingSnapshotUrl: boolean;
  displayableSnapshotUrl: string | null;
  handleGenerateSceneDescription: () => Promise<void>; // Expecting parent to handle this
  isGeneratingDescription: boolean;
}

const AddCameraStep2Form: React.FC<AddCameraStep2FormProps> = ({
  formStep2,
  onSubmitStep2,
  isProcessingStep2Snapshot,
  isLoadingSnapshotUrl,
  displayableSnapshotUrl,
  handleGenerateSceneDescription, // Passed from parent
  isGeneratingDescription,
}) => {
  // Use standard React useState for error state if needed within this component
  // For this refactor, assuming error display is handled by parent via toasts or FormMessage
  const { toast } = useToast(); // If generationError needs to show a toast, it's handled in parent

  return (
    <div className="p-6">
      <Form {...formStep2}>
        <form id="add-camera-form-step2" onSubmit={formStep2.handleSubmit(onSubmitStep2)} className="space-y-6">
          {(isProcessingStep2Snapshot || isLoadingSnapshotUrl) ? (
            <div className="w-full aspect-video bg-muted rounded-md flex flex-col items-center justify-center text-center p-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">
                {isProcessingStep2Snapshot ? "Connecting to camera and extracting snapshot..." :
                  (isLoadingSnapshotUrl ? "Loading snapshot image..." : "Processing...")}
              </p>
              <p className="text-xs text-muted-foreground">This may take a moment.</p>
            </div>
          ) : displayableSnapshotUrl ? (
            <Image
              src={displayableSnapshotUrl}
              alt="Camera Snapshot"
              width={400}
              height={300}
              className="rounded-md border object-cover aspect-video w-full"
              data-ai-hint="camera snapshot"
              unoptimized
            />
          ) : (
            <div className="w-full aspect-video bg-muted rounded-md flex flex-col items-center justify-center text-center p-4">
              <CameraIconLucide className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Could not retrieve snapshot.</p>
              <p className="text-xs text-muted-foreground">Check RTSP URL and network or try again. You can proceed to configure AI settings.</p>
            </div>
          )}

          <FormField
            control={formStep2.control}
            name="cameraSceneContext"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center">
                  <HelpCircle className="w-4 h-4 mr-2 text-muted-foreground" />
                  What does this camera typically view/do?
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="e.g., This camera overlooks the main warehouse loading bay, monitoring incoming and outgoing trucks."
                    {...field}
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={formStep2.control}
            name="sceneDescription"
            render={({ field }) => {
                 console.log("SceneDescription FormField render, field.value:", field.value);
                 return (
                <FormItem className="text-left">
                     <div className="flex items-center justify-between">
                        <FormLabel className="flex items-center">
                            <HelpCircle className="w-4 h-4 mr-2 text-muted-foreground" />
                            Explain the scene?
                        </FormLabel>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleGenerateSceneDescription}
                            disabled={!displayableSnapshotUrl || isGeneratingDescription || isProcessingStep2Snapshot || isLoadingSnapshotUrl}
                        >
                            {isGeneratingDescription ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
                            Generate
                        </Button>
                    </div>
                    <FormControl>
                        <Textarea
                            placeholder="e.g., This camera overlooks the main warehouse loading bay, monitoring incoming and outgoing trucks."
                            {...field}
                            value={field.value || ''}
                            rows={3}
                            disabled={isGeneratingDescription}
                        />
                    </FormControl>
                     {isGeneratingDescription && <p className="text-xs text-muted-foreground mt-1 text-primary">AI is generating a description...</p>}
                    <FormMessage />
                </FormItem>
                );
            }}
        />
        </form>
      </Form>
    </div>
  );
};

export default AddCameraStep2Form;
