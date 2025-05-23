
'use server';
/**
 * @fileOverview AI agent for suggesting alert events based on camera context and detection targets.
 *
 * - suggestAlertEvents - A function that suggests alert events.
 * - SuggestAlertEventsInputSchema - The input type for the function.
 * - SuggestAlertEventsOutputSchema - The return type for the function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const AlertEventSchema = z.object({
  name: z.string().describe('A concise name for the alert event (e.g., "Unauthorized Entry").'),
  condition: z.string().describe('A brief description of the condition that triggers this alert (e.g., "Person detected in restricted area after hours").')
});

export const SuggestAlertEventsInputSchema = z.object({
  cameraSceneContext: z.string().describe('The general context or purpose of the camera (e.g., "Monitors warehouse loading dock").'),
  aiDetectionTarget: z.string().describe('Comma-separated list of objects or events the AI should primarily detect (e.g., "people, vehicles, packages").'),
  language: z.string().describe('The language for the response (e.g., "en", "es", "pt").').optional().default('en'),
});
export type SuggestAlertEventsInput = z.infer<typeof SuggestAlertEventsInputSchema>;

export const SuggestAlertEventsOutputSchema = z.object({
  suggestedAlerts: z.array(AlertEventSchema).describe('An array of suggested alert events, each with a name and condition.'),
});
export type SuggestAlertEventsOutput = z.infer<typeof SuggestAlertEventsOutputSchema>;

const suggestAlertEventsPrompt = ai.definePrompt({
  name: 'suggestAlertEventsPrompt_local',
  input: {schema: SuggestAlertEventsInputSchema},
  output: {schema: SuggestAlertEventsOutputSchema},
  prompt: `Considering the following camera scene context and the desired AI detection targets, suggest a list of specific events or conditions that should trigger an alert. For each suggested alert, provide a concise name and a brief description of the condition.
Format the output as a JSON array of objects, where each object has 'name' and 'condition' keys. Respond in {{language}}.

Example Output:
[
  {"name": "Unauthorized Entry", "condition": "Detect a person entering the restricted zone after hours"},
  {"name": "Package Left", "condition": "Identify a package left unattended for more than 10 minutes"}
]

Camera Scene Context:
{{{cameraSceneContext}}}

AI Detection Targets:
{{{aiDetectionTarget}}}

Suggested Alert Events (JSON Array):`,
});

const suggestAlertEventsFlowInternal = ai.defineFlow(
  {
    name: 'suggestAlertEventsFlow_local',
    inputSchema: SuggestAlertEventsInputSchema,
    outputSchema: SuggestAlertEventsOutputSchema,
  },
  async (flowInput) => {
    try {
      const {output} = await suggestAlertEventsPrompt(flowInput);
      if (!output || !Array.isArray(output.suggestedAlerts)) {
        console.warn('suggestAlertEventsFlowInternal: AI model did not return expected "suggestedAlerts" array structure.', output);
        let errorMsg = "Error: AI failed to generate suggestions in the expected format.";
         if (flowInput.language === 'es') {
            errorMsg = "Error: La IA no generó sugerencias en el formato esperado.";
        } else if (flowInput.language === 'pt') {
            errorMsg = "Erro: A IA não conseguiu gerar sugestões no formato esperado.";
        }
        return { suggestedAlerts: [{name: errorMsg, condition: ""}] };
      }
      return output;
    } catch (error: any) {
      console.error('suggestAlertEventsFlowInternal: Error during AI prompt execution:', error);
      let errorMessage = "Failed to communicate with the AI model.";
      if (error?.message) {
        errorMessage = error.message;
      } else if (flowInput.language === 'es') {
        errorMessage = "Falló la comunicación con el modelo IA.";
      } else if (flowInput.language === 'pt') {
        errorMessage = "Falha na comunicação com o modelo de IA.";
      }
      return { suggestedAlerts: [{name: `Error: ${errorMessage}`, condition: ""}] };
    }
  }
);

export async function suggestAlertEvents(input: SuggestAlertEventsInput): Promise<SuggestAlertEventsOutput> {
  return suggestAlertEventsFlowInternal(input);
}
