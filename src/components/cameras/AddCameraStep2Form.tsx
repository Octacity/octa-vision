
'use client';

import type { UseFormReturn } from 'react-hook-form';
import { useSetState } from '@react-spring/web';
import Image from 'next/image';
import type { AddCameraStep2Values } from '@/app/(main)/cameras/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Camera as CameraIconLucide, Loader2, Wand2, HelpCircle } from 'lucide-react';

interface AddCameraStep2FormProps {
  formStep2: UseFormReturn<AddCameraStep2Values>;
  onSubmitStep2: (data: AddCameraStep2Values) => void;
  isProcessingStep2Snapshot: boolean;
  isLoadingSnapshotUrl: boolean;
  displayableSnapshotUrl: string | null;
  isGeneratingDescription: boolean;
}

const AddCameraStep2Form: React.FC<AddCameraStep2FormProps> = ({
  formStep2,
  onSubmitStep2,
  isProcessingStep2Snapshot,
  isLoadingSnapshotUrl,
  displayableSnapshotUrl,
  // Removed handleGenerateSceneDescription prop as it's now handled internally
  isGeneratingDescription,
}) => {

  // State to manage potential errors during AI generation
  const [generationError, setGenerationError] = useSetState<string | null>(null);

  const handleGenerateSceneDescription = async () => {
    if (!displayableSnapshotUrl) return;

    setGenerationError(null); // Clear previous errors
    // isGeneratingDescription is managed by the parent component's state/mutation status

    try {
      // TODO: Convert displayableSnapshotUrl to a suitable format (e.g., base64 string) before sending
      const response = await fetch('/api/suggest-scene-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl: displayableSnapshotUrl }), // Sending URL for now, adjust as needed
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      formStep2.setValue('sceneDescription', data.sceneDescription);
    } catch (error: any) {
      setGenerationError(`Failed to generate description: ${error.message}`);
    }
  };

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
              <p className="text-xs text-muted-foreground">Check RTSP URL and network or try again. You can proceed to the next step to configure AI settings.</p>
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
                  {generationError && <p className="text-xs text-destructive mt-1">{generationError}</p>}
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
