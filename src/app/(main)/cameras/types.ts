
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
  defaultAlertEvents?: string[] | null; // Array of event names
  defaultVideoChunks?: { value: number; unit: 'seconds' | 'minutes' } | null;
  defaultNumFrames?: number | null;
  defaultVideoOverlap?: { value: number; unit: 'seconds' | 'minutes' } | null;
}

// Consolidated and corrected Camera interface
export interface Camera {
  id: string; // Auto-generated
  orgId: string; // Organization ID
  userId: string; // User ID
  createdAt: Timestamp;
  updatedAt: Timestamp;
  cameraName: string;
  rtspUrl: string;
  rtspUsername?: string | null; // Optional
  rtspPassword?: string | null; // Optional
  groupId?: string | null; // Optional, from formStep1
  cameraSceneContext?: string | null; // From formStep2
  aiDetectionTarget?: string | null; // From formStep3
  alertEvents?: Array<{ name: string; condition: string }> | null; // From formStep3
  videoChunksValue: number; // From formStep3
  videoChunksUnit: 'seconds' | 'minutes'; // From formStep3
  videoOverlapValue: number; // From formStep3
  videoOverlapUnit: 'seconds' | 'minutes'; // From formStep3
  numFrames: number; // From formStep3
  sceneDescription?: string | null; // From formStep2, AI-generated or user-edited
  vssBasePrompt?: string | null; // Internally generated based on form inputs
  vssCaptionPrompt?: string | null; // Internally generated
  vssSummaryPrompt?: string | null; // Internally generated
  // Fields for UI display and state management, not directly part of core config saved in 'configurations'
  imageUrl?: string; // For camera card display (GCS signed URL)
  snapshotGcsObjectName?: string | null; // Stored in Firestore 'cameras' collection
  resolution?: string | null; // Stored in Firestore 'cameras' collection
  processingStatus?: string; // Stored in Firestore 'cameras' collection
  currentConfigId?: string; // Stored in Firestore 'cameras' collection
  activeVSSId?: string | null; // Stored in Firestore 'cameras' collection
  historicalVSSIds?: string[] | null; // Stored in Firestore 'cameras' collection
  dataAiHint?: string; // For image components if needed, not directly saved
}


export interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: Date;
  avatar?: string;
}

// Step 1: Camera Connection & Basic Info
export const addCameraStep1Schema = z.object({
  cameraName: z.string().min(1, "Camera name is required."),
  rtspUrl: z.string().min(1, "RTSP URL is required.").refine(value => {
    try {
      return value.toLowerCase().startsWith('rtsp://');
    } catch (e) {
      return false;
    }
  }, { message: "Invalid RTSP URL format. Must start with rtsp://" }),
  rtspUsername: z.string().optional(),
  rtspPassword: z.string().optional(),
  group: z.string().optional(),
  newGroupName: z.string().optional(),
  groupDefaultCameraSceneContext: z.string().optional(),
  groupDefaultAiDetectionTarget: z.string().optional(),
  groupDefaultAlertEvents: z.string().optional(), // Comma-separated string from form
  groupDefaultVideoChunksValue: z.string().optional().refine(val => val === undefined || val === '' || !isNaN(parseFloat(val)), { message: "Must be a number" }),
  groupDefaultVideoChunksUnit: z.enum(['seconds', 'minutes']).optional(),
  groupDefaultNumFrames: z.string().optional().refine(val => val === undefined || val === '' || !isNaN(parseFloat(val)), { message: "Must be a number" }),
  groupDefaultVideoOverlapValue: z.string().optional().refine(val => val === undefined || val === '' || !isNaN(parseFloat(val)), { message: "Must be a number" }),
  groupDefaultVideoOverlapUnit: z.enum(['seconds', 'minutes']).optional(),
}).refine(data => {
  if (data.group === 'add_new_group' && (!data.newGroupName || data.newGroupName.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: "New group name is required when adding a new group.",
  path: ["newGroupName"],
});
export type AddCameraStep1Values = z.infer<typeof addCameraStep1Schema>;


// Step 2: Scene Analysis & Context
export const addCameraStep2Schema = z.object({
  sceneDescription: z.string().optional(),
  cameraSceneContext: z.string().min(1, "Camera scene context is required."),
});
export type AddCameraStep2Values = z.infer<typeof addCameraStep2Schema>;

// Step 3: AI Configuration & Alert Definition
export const addCameraStep3Schema = z.object({
  aiDetectionTarget: z.string().min(1, "AI detection target is required."),
  alertEvents: z.array(z.object({
    name: z.string().min(1, "Alert name is required."),
    condition: z.string().min(1, "Alert condition is required."),
  })).min(1, "At least one alert event is required."), // Ensure at least one event
  videoChunksValue: z.string().min(1, "Video chunks value is required.").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Must be a positive number" }),
  videoChunksUnit: z.enum(['seconds', 'minutes']),
  videoOverlapValue: z.string().min(1, "Video overlap value is required.").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, { message: "Must be a non-negative number" }),
  videoOverlapUnit: z.enum(['seconds', 'minutes']),
  numFrames: z.string().min(1, "Number of frames is required.").refine(val => !isNaN(parseInt(val)) && parseInt(val) > 0, { message: "Must be a positive integer" }),
});
export type AddCameraStep3Values = z.infer<typeof addCameraStep3Schema>;
