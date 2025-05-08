
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

export const GenerateGroupAlertEventsInputSchema = z.object({
  aiDetectionTarget: z.string().describe('The text describing what the AI should detect for this group of cameras.'),
});
export type GenerateGroupAlertEventsInput = z.infer<typeof GenerateGroupAlertEventsInputSchema>;

export const GenerateGroupAlertEventsOutputSchema = z.object({
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
    const {output} = await prompt(input);
    if (!output) {
        // Handle the case where output is null or undefined
        return { suggestedAlertEvents: "Error: Could not generate alert events. Model returned no output." };
    }
    return output;
  }
);
