
'use server';
/**
 * @fileOverview AI agent for suggesting AI detection targets based on camera context.
 *
 * - suggestDetectionTargets - A function that suggests detection targets.
 * - SuggestDetectionTargetsInputSchema - The input type for the function.
 * - SuggestDetectionTargetsOutputSchema - The return type for the function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

export const SuggestDetectionTargetsInputSchema = z.object({
  cameraSceneContext: z.string().describe('The general context or purpose of the camera (e.g., "Monitors warehouse loading dock").'),
  sceneDescription: z.string().optional().describe('A detailed description of the camera\'s current view (e.g., "Image shows three stacked pallets near a closed roller door.").'),
  language: z.string().describe('The language for the response (e.g., "en", "es", "pt").').optional().default('en'),
});
export type SuggestDetectionTargetsInput = z.infer<typeof SuggestDetectionTargetsInputSchema>;

export const SuggestDetectionTargetsOutputSchema = z.object({
  suggestedTargets: z.string().describe('A comma-separated list of suggested AI detection targets (e.g., "people, vehicles, packages, loitering").'),
});
export type SuggestDetectionTargetsOutput = z.infer<typeof SuggestDetectionTargetsOutputSchema>;

const suggestDetectionTargetsPrompt = ai.definePrompt({
  name: 'suggestDetectionTargetsPrompt_local',
  input: {schema: SuggestDetectionTargetsInputSchema},
  output: {schema: SuggestDetectionTargetsOutputSchema},
  prompt: `Based on the following camera scene context and optional scene description, suggest a list of common objects, events, or behaviors that an AI model should typically detect in this environment. Provide the suggestions as a comma-separated list. Respond in {{language}}.

Camera Scene Context:
{{{cameraSceneContext}}}

{{#if sceneDescription}}
Scene Description (from snapshot):
{{{sceneDescription}}}
{{/if}}

Suggested AI Detection Targets (comma-separated list):`,
});

const suggestDetectionTargetsFlowInternal = ai.defineFlow(
  {
    name: 'suggestDetectionTargetsFlow_local',
    inputSchema: SuggestDetectionTargetsInputSchema,
    outputSchema: SuggestDetectionTargetsOutputSchema,
  },
  async (flowInput) => {
    try {
      const {output} = await suggestDetectionTargetsPrompt(flowInput);
      if (!output?.suggestedTargets) {
        console.warn('suggestDetectionTargetsFlowInternal: AI model did not return expected "suggestedTargets" structure.', output);
        let errorMsg = "Error: AI failed to generate suggestions in the expected format.";
        if (flowInput.language === 'es') {
            errorMsg = "Error: La IA no generó sugerencias en el formato esperado.";
        } else if (flowInput.language === 'pt') {
            errorMsg = "Erro: A IA não conseguiu gerar sugestões no formato esperado.";
        }
        return { suggestedTargets: errorMsg };
      }
      return output;
    } catch (error: any) {
      console.error('suggestDetectionTargetsFlowInternal: Error during AI prompt execution:', error);
      let errorMessage = "Failed to communicate with the AI model for detection target suggestions.";
      if (error?.message) {
        errorMessage = error.message;
      } else if (flowInput.language === 'es') {
        errorMessage = "Falló la comunicación con el modelo IA para sugerencias de objetivos de detección.";
      } else if (flowInput.language === 'pt') {
        errorMessage = "Falha na comunicação com o modelo de IA para sugestões de alvos de deteção.";
      }
      return { suggestedTargets: `Error: ${errorMessage}` };
    }
  }
);

export async function suggestDetectionTargets(input: SuggestDetectionTargetsInput): Promise<SuggestDetectionTargetsOutput> {
  return suggestDetectionTargetsFlowInternal(input);
}
