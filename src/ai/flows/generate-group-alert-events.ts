'use server';
/**
 * @fileOverview AI agent for generating suggested alert events for a camera group.
 *
 * - generateGroupAlertEvents - A function that suggests alert events based on an AI detection target.
 * - GenerateGroupAlertEventsInput - The input type for the function.
 * - GenerateGroupAlertEventsOutput - The return type for the function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const GenerateGroupAlertEventsInputSchema = z.object({
  aiDetectionTarget: z.string().describe('The text describing what the AI should detect for this group of cameras.'),
});
export type GenerateGroupAlertEventsInput = z.infer<typeof GenerateGroupAlertEventsInputSchema>;

const GenerateGroupAlertEventsOutputSchema = z.object({
  suggestedAlertEvents: z.string().describe('A comma-separated string of suggested alert event types, e.g., "safety: ppe violation, security: unauthorized access".'),
});
export type GenerateGroupAlertEventsOutput = z.infer<typeof GenerateGroupAlertEventsOutputSchema>;

export async function generateGroupAlertEvents(input: GenerateGroupAlertEventsInput): Promise<GenerateGroupAlertEventsOutput> {
  return generateGroupAlertEventsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateGroupAlertEventsPrompt',
  input: {schema: GenerateGroupAlertEventsInputSchema},
  output: {schema: GenerateGroupAlertEventsOutputSchema},
  prompt: `You are an AI assistant helping to configure security camera alerts.
Based on the following "AI Detection Target" provided by the user, suggest a list of relevant "Alert Events".
The "Alert Events" should be specific and actionable.
Format the output as a comma-separated string. Each event should be concise and use a prefix like "safety:" or "security:".
For example, if the detection target is "people entering a restricted warehouse zone after hours without authorization",
suggested alert events might be: "security: unauthorized zone entry, security: after-hours activity, safety: potential trespassing".

AI Detection Target:
{{{aiDetectionTarget}}}

Provide your suggested alert events below:`,
});

const generateGroupAlertEventsFlow = ai.defineFlow(
  {
    name: 'generateGroupAlertEventsFlow',
    inputSchema: GenerateGroupAlertEventsInputSchema,
    outputSchema: GenerateGroupAlertEventsOutputSchema,
  },
  async (input) => {
    try {
      const {output} = await prompt(input);
      // The prompt is expected to return an object matching GenerateGroupAlertEventsOutputSchema.
      // If the model doesn't adhere, 'output' might be null or not have the expected fields.
      if (!output?.suggestedAlertEvents) {
        console.warn('AI model did not return expected "suggestedAlertEvents" structure.', output);
        return { suggestedAlertEvents: "Error: AI failed to generate suggestions in the expected format." };
      }
      return output;
    } catch (error: any) {
      // This case means the call to the model (prompt(input)) failed.
      // This could be due to API key issues, network problems, or other API errors.
      console.error('generateGroupAlertEventsFlow: Error during AI prompt execution:', error);
      const errorMessage = error?.message || "Failed to communicate with the AI model.";
      return { suggestedAlertEvents: `Error: ${errorMessage}` };
    }
  }
);