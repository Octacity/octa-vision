
'use server';
/**
 * @fileOverview A camera feed analysis AI agent.
 *
 * - analyzeCameraFeed - A function that handles the camera feed analysis process.
 * - AnalyzeCameraFeedInput - The input type for the analyzeCameraFeed function.
 * - AnalyzeCameraFeedOutput - The return type for the analyzeCameraFeed function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const AnalyzeCameraFeedInputSchema = z.object({
  cameraFeedDataUri: z
    .string()
    .describe(
      "A camera feed, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  prompt: z.string().describe('A prompt describing the event or object to detect.'),
  language: z.string().describe('The language for the response (e.g., "en", "es", "pt").').optional().default('en'),
});
export type AnalyzeCameraFeedInput = z.infer<typeof AnalyzeCameraFeedInputSchema>;

const AnalyzeCameraFeedOutputSchema = z.object({
  eventDetected: z.boolean().describe('Whether or not the event was detected.'),
  alertMessage: z.string().describe('A message to alert the user about the event.'),
});
export type AnalyzeCameraFeedOutput = z.infer<typeof AnalyzeCameraFeedOutputSchema>;

export async function analyzeCameraFeed(input: AnalyzeCameraFeedInput): Promise<AnalyzeCameraFeedOutput> {
  const prompt = ai.definePrompt({
    name: 'analyzeCameraFeedPrompt_local',
    input: {
      schema: AnalyzeCameraFeedInputSchema,
    },
    output: {
      schema: AnalyzeCameraFeedOutputSchema,
    },
    prompt: `You are an AI agent specializing in analyzing security camera footage. You will use the camera feed and the user-provided prompt to determine if the event described in the prompt is detected in the camera feed. If the event is detected, set eventDetected to true and provide an appropriate alert message. If the event is not detected, set eventDetected to false and provide a message indicating that the event was not detected. Respond in {{language}}.

User Prompt: {{{prompt}}}
Camera Feed: {{media url=cameraFeedDataUri}}`,
  });

  const analyzeCameraFeedFlow = ai.defineFlow(
    {
      name: 'analyzeCameraFeedFlow_local',
      inputSchema: AnalyzeCameraFeedInputSchema,
      outputSchema: AnalyzeCameraFeedOutputSchema,
    },
    async (flowInput) => {
      const {output} = await prompt(flowInput); // Note: Error handling should be added here
      return output!;
    }
  );
  return analyzeCameraFeedFlow(input);
}
