
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
  language: z.string().describe('The language for the response (e.g., "en", "es", "pt").').optional().default('en'),
});
export type GenerateGroupAlertEventsInput = z.infer<typeof GenerateGroupAlertEventsInputSchema>;

const GenerateGroupAlertEventsOutputSchema = z.object({
  suggestedAlertEvents: z.string().describe('A comma-separated string of suggested alert event types, e.g., "safety: ppe violation, security: unauthorized access".'),
});
export type GenerateGroupAlertEventsOutput = z.infer<typeof GenerateGroupAlertEventsOutputSchema>;

export async function generateGroupAlertEvents(input: GenerateGroupAlertEventsInput): Promise<GenerateGroupAlertEventsOutput> {
  const prompt = ai.definePrompt({
    name: 'generateGroupAlertEventsPrompt_local',
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

Provide your suggested alert events below in {{language}}:`,
  });

  const generateGroupAlertEventsFlow = ai.defineFlow(
    {
      name: 'generateGroupAlertEventsFlow_local',
      inputSchema: GenerateGroupAlertEventsInputSchema,
      outputSchema: GenerateGroupAlertEventsOutputSchema,
    },
    async (flowInput) => {
      try {
        const {output} = await prompt(flowInput);
        if (!output?.suggestedAlertEvents) {
          console.warn('AI model did not return expected "suggestedAlertEvents" structure.', output);
          let errorMsg = "Error: AI failed to generate suggestions in the expected format.";
          if (flowInput.language === 'es') {
              errorMsg = "Error: La IA no generó sugerencias en el formato esperado.";
          } else if (flowInput.language === 'pt') {
              errorMsg = "Erro: A IA não conseguiu gerar sugestões no formato esperado.";
          }
          return { suggestedAlertEvents: errorMsg };
        }
        return output;
      } catch (error: any) {
        console.error('generateGroupAlertEventsFlow: Error during AI prompt execution:', error);
        let errorMessage = "Failed to communicate with the AI model.";
        if (error?.message) {
          errorMessage = error.message;
        } else if (flowInput.language === 'es') {
          errorMessage = "Falló la comunicación con el modelo IA.";
        } else if (flowInput.language === 'pt') {
          errorMessage = "Falha na comunicação com o modelo de IA.";
        }
        return { suggestedAlertEvents: `Error: ${errorMessage}` };
      }
    }
  );
  return generateGroupAlertEventsFlow(input);
}
