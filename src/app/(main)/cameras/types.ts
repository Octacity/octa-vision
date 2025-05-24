
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
  defaultAlertEvents?: string[] | null; // Array of simple event strings for group defaults
  defaultVideoChunks?: { value: number; unit: 'seconds' | 'minutes' } | null;
  defaultNumFrames?: number | null;
  defaultVideoOverlap?: { value: number; unit: 'seconds' | 'minutes' } | null;
}

// This is the primary Camera interface reflecting Firestore structure
export interface Camera {
  id: string;
  orgId: string;
  userId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  cameraName: string;
  rtspUrl: string;
  rtspUsername?: string | null;
  rtspPassword?: string | null;
  groupId?: string | null;
  currentConfigId?: string; // Reference to the active document in 'configurations'
  processingStatus?: string; // e.g., "waiting_for_approval", "running_normal", "failed"
  snapshotGcsObjectName?: string | null; // GCS path for the snapshot
  resolution?: string | null; // e.g., "1920x1080"

  // Fields that are part of the 'configurations' collection document,
  // but might be denormalized or fetched for UI purposes.
  // Consider if these should always be fetched via currentConfigId.
  // For direct use in CameraCard or list views, some denormalization might be chosen.
  // However, the primary source of truth for these is the configurations collection.
  cameraSceneContext?: string | null;
  aiDetectionTarget?: string | null;
  // Updated vssAlertConfig structure
  vssAlertConfig?: {
    name: string; // The overall VSS Alert Name
    events: string[]; // List of event strings (e.g., ["Fire", "Intrusion"])
  } | null;
  videoChunksValue?: number; // Denormalized for display, sourced from config
  videoChunksUnit?: 'seconds' | 'minutes'; // Denormalized for display
  videoOverlapValue?: number; // Denormalized for display
  videoOverlapUnit?: 'seconds' | 'minutes'; // Denormalized for display
  numFrames?: number; // Denormalized for display
  sceneDescription?: string | null; // AI-generated or user-provided, sourced from config

  // VSS Prompts (stored in configurations, but useful to have in a comprehensive Camera type for context)
  vssBasePrompt?: string | null;
  vssCaptionPrompt?: string | null;
  vssSummaryPrompt?: string | null;

  // UI-specific or temporary state, not directly stored in THIS camera document usually
  imageUrl?: string | null; // Temporary signed URL for display
  dataAiHint?: string;
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
      const url = new URL(value); // Basic URL format check
      return url.protocol === 'rtsp:';
    } catch (e) {
      return false;
    }
  }, { message: "Invalid RTSP URL format. Must start with rtsp://" }),
  rtspUsername: z.string().optional().nullable(),
  rtspPassword: z.string().optional().nullable(),
  group: z.string().optional(),
  newGroupName: z.string().optional(),
  groupDefaultCameraSceneContext: z.string().optional(),
  groupDefaultAiDetectionTarget: z.string().optional(),
  groupDefaultAlertEvents: z.string().optional(),
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
  sceneDescription: z.string().optional().nullable(), // AI-generated or user-edited
  cameraSceneContext: z.string().min(1, "Camera scene context is required."),
});
export type AddCameraStep2Values = z.infer<typeof addCameraStep2Schema>;

// Step 3: AI Configuration & Alert Definition
export const addCameraStep3Schema = z.object({
  aiDetectionTarget: z.string().min(1, "AI detection target is required."),
  // Updated for new VSS Alert structure
  alertName: z.string().min(1, "Alert name is required."),
  events: z.string().min(1, "At least one event is required (comma-separated)."), // Comma-separated string of event names
  
  videoChunksValue: z.string().min(1, "Video chunks value is required.").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Must be a positive number" }),
  videoChunksUnit: z.enum(['seconds', 'minutes']),
  videoOverlapValue: z.string().min(1, "Video overlap value is required.").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, { message: "Must be a non-negative number" }),
  videoOverlapUnit: z.enum(['seconds', 'minutes']),
  numFrames: z.string().min(1, "Number of frames is required.").refine(val => !isNaN(parseInt(val)) && parseInt(val) > 0, { message: "Must be a positive integer" }),
});
export type AddCameraStep3Values = z.infer<typeof addCameraStep3Schema>;

    