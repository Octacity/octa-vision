
// Note: The Camera interface/type is now defined in cameras/types.ts
// For this file, we'll assume the necessary data structure is passed in.

interface VssPromptData {
  cameraSceneContext?: string | null;
  aiDetectionTarget?: string | null;
  // alertEvents is now an array of event name strings for VSS API.
  alertEvents?: string[] | null;
  sceneDescription?: string | null;
}

export const vssBasePromptTemplate = ({
  cameraSceneContext,
  aiDetectionTarget,
  alertEvents, // This is now expected to be string[]
  sceneDescription,
}: VssPromptData): string => {
  const alertEventNames = alertEvents?.join(', ') || 'relevant events';
  const sceneContext = cameraSceneContext || 'a typical scene';
  const detectionTarget = aiDetectionTarget || 'objects and events of interest';
  // sceneDescription might not be directly used in this specific base prompt if
  // the goal is dense captioning primarily based on live feed and configured alerts/targets.
  // However, it can be added if it provides useful grounding.

  return `Write a concise and clear dense caption for the provided video feed of a scene in ${sceneContext}. Focus on identifying and describing events related to ${detectionTarget}, particularly those that could be classified as ${alertEventNames}. Pay exceptionally granular details, describing actions, object states, and interactions precisely for any situations that might indicate these alerts. Include timestamps for the start and end of each distinct observation or activity in the format HH:MM:SS.ms.`;
};

export const vssCaptionPromptTemplate = ({
  cameraSceneContext,
  aiDetectionTarget,
  alertEvents, // string[]
  sceneDescription,
}: VssPromptData): string => {
  const alertEventNames = alertEvents?.join(', ') || 'relevant events';
  const sceneContext = cameraSceneContext || 'a typical scene';
  const detectionTarget = aiDetectionTarget || 'objects and events of interest';
  // sceneDescription can provide context if available.

  return `Summarize the events observed in the video segments from ${sceneContext} based on the detailed descriptions. Format each summary as a bullet point in the format start_time:end_time:detailed_event_description. Use timestamps in the format HH.MM.SS.ms. Focus specifically on irregular or notable activities related to ${detectionTarget} or matching the conditions of ${alertEventNames}. Ignore routine or regular activities. Do not return anything else except the bullet points.`;
};

export const vssSummaryPromptTemplate = ({
  cameraSceneContext,
  // aiDetectionTarget, // Not directly used in this summary prompt as per original spec
  // alertEvents,       // Not directly used in this summary prompt as per original spec
  // sceneDescription,  // Not directly used in this summary prompt as per original spec
}: VssPromptData): string => {
    const sceneContext = cameraSceneContext || 'a typical scene';

  return `You are a monitoring system for a ${sceneContext}. Given the captions in the format start_time:end_time:caption, aggregate and summarize these events. If an event description is the same across multiple captions, aggregate them in the format start_time1:end_time1,...,start_timek:end_timek:event_description. If any two adjacent end times and start times are within a few tenths of a second, merge the captions in the format start_time1:end_time2. The output should only contain bullet points. Cluster the output into the following categories: Unsafe Behavior, Operational Inefficiencies, Potential Equipment Damage, and Unauthorized Personnel. Assign each aggregated event to the most relevant category.`;
};

    