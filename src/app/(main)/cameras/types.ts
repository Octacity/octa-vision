
import type { Timestamp } from 'firebase/firestore';
import * as z from 'zod';

export interface Group {
  id: string;
  name: string;
  orgId: string;
  userId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  cameras?: string[];
  videos?: string[];
  defaultCameraSceneContext?: string | null;
  defaultAiDetectionTarget?: string | null;
  defaultAlertEvents?: string[] | null;
  defaultVideoChunks?: { value: number; unit: 'seconds' | 'minutes' } | null;
  defaultNumFrames?: number | null;
  defaultVideoOverlap?: { value: number; unit: 'seconds' | 'minutes' } | null;
}

export interface Camera {
  id: string;
  cameraName: string;
  imageUrl?: string; // This will hold the GCS signed URL for display
  snapshotGcsObjectName?: string | null;
  resolution?: string | null;
  dataAiHint: string;
  processingStatus?: string;
  rtspUsername?: string | null;
  rtspPassword?: string | null;
}
export interface Camera extends CameraBase {
 cameraSceneContext?: string | null;
 aiDetectionTarget?: string | null;
 alertEvents?: Array<{ name: string; condition: string }> | null; // Array of objects for alert name and condition
 vssBasePrompt?: string | null; // Internally generated VSS prompt
 vssCaptionPrompt?: string | null; // Internally generated VSS prompt
 vssSummaryPrompt?: string | null; // Internally generated VSS prompt

export interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: Date;
  avatar?: string;
}

export const addCameraStep1Schema = z.object({
  rtspUrl: z.string().min(1, "RTSP URL is required.").refine(value => {
    try {
      return value.toLowerCase().startsWith('rtsp://');
    } catch (e) {
      return false;
    }
  }, { message: "Invalid RTSP URL format. Must start with rtsp://" }),
  rtspUsername: z.string().optional(),
  rtspPassword: z.string().optional(),
  cameraName: z.string().min(1, "Camera name is required."),
 group: z.string().optional(), // Still needed for selecting a group
 newGroupName: z.string().optional(), // Still needed for adding a new group
 groupDefaultCameraSceneContext: z.string().optional(), // Still needed if creating new group
 groupDefaultAiDetectionTarget: z.string().optional(), // Still needed if creating new group
 groupDefaultAlertEvents: z.string().optional(), // Still needed if creating new group
 // Remove group default video config fields from Step 1
}).refine(data => {
  if (data.group === 'add_new_group' && !data.newGroupName) {
    return false;
  }
  return true;
}, {
  message: "New group name is required when adding a new group.",
  path: ["newGroupName"],
});

export type AddCameraStep1Values = z.infer<typeof addCameraStep1Schema>;

export const addCameraStep2Schema = z.object({
 sceneDescription: z.string().optional(), // AI-generated based on snapshot
 cameraSceneContext: z.string().optional(), // What does the camera typically view/do?
});
export type AddCameraStep2Values = z.infer<typeof addCameraStep2Schema>;

export const addCameraStep3Schema = z.object({
 // AI Configuration fields
 aiDetectionTarget: z.string().optional(), // What specific objects/events to detect?
 // alertEvents is now an array of objects, updated schema
 alertEvents: z.array(z.object({
 name: z.string().min(1, "Alert name is required."),
 condition: z.string().optional(), // Condition/description is optional
 })).optional(), // The entire alertEvents array is optional initially

 // Video Processing Configuration fields
    videoChunksValue: z.string().min(1, "Video chunks value is required.").refine(val => !isNaN(parseFloat(val)), {message: "Must be a number"}),
    videoChunksUnit: z.enum(['seconds', 'minutes']).default('seconds'),
    videoOverlapValue: z.string().min(1, "Video overlap value is required.").refine(val => !isNaN(parseFloat(val)), {message: "Must be a number"}),
    videoOverlapUnit: z.enum(['seconds', 'minutes']).default('seconds'),
    numFrames: z.string().min(1, "Number of frames is required.").refine(val => !isNaN(parseFloat(val)), {message: "Must be a number"}),

 // VSS Prompt fields (read-only, generated internally)
 // These will be populated during form processing, not directly in the user input schema
});
export type AddCameraStep3Values = z.infer<typeof addCameraStep3Schema>;
