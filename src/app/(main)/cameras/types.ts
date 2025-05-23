
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
  group: z.string().optional(),
  newGroupName: z.string().optional(),
  groupDefaultCameraSceneContext: z.string().optional(),
  groupDefaultAiDetectionTarget: z.string().optional(),
  groupDefaultAlertEvents: z.string().optional(),
  groupDefaultVideoChunksValue: z.string().optional().refine(val => val === undefined || val === '' || !isNaN(parseFloat(val)), {message: "Must be a number"}),
  groupDefaultVideoChunksUnit: z.enum(['seconds', 'minutes']).optional(),
  groupDefaultNumFrames: z.string().optional().refine(val => val === undefined || val === '' || !isNaN(parseFloat(val)), {message: "Must be a number"}),
  groupDefaultVideoOverlapValue: z.string().optional().refine(val => val === undefined || val === '' || !isNaN(parseFloat(val)), {message: "Must be a number"}),
  groupDefaultVideoOverlapUnit: z.enum(['seconds', 'minutes']).optional(),
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
  sceneDescription: z.string().optional(),
});
export type AddCameraStep2Values = z.infer<typeof addCameraStep2Schema>;

export const addCameraStep3Schema = z.object({
    cameraSceneContext: z.string().min(1, "This field is required."),
    aiDetectionTarget: z.string().min(1, "AI detection target is required."),
    alertEvents: z.string().min(1, "Alert events are required."),
    videoChunksValue: z.string().min(1, "Video chunks value is required.").refine(val => !isNaN(parseFloat(val)), {message: "Must be a number"}),
    videoChunksUnit: z.enum(['seconds', 'minutes']).default('seconds'),
    numFrames: z.string().min(1, "Number of frames is required.").refine(val => !isNaN(parseFloat(val)), {message: "Must be a number"}),
    videoOverlapValue: z.string().min(1, "Video overlap value is required.").refine(val => !isNaN(parseFloat(val)), {message: "Must be a number"}),
    videoOverlapUnit: z.enum(['seconds', 'minutes']).default('seconds'),
});
export type AddCameraStep3Values = z.infer<typeof addCameraStep3Schema>;
