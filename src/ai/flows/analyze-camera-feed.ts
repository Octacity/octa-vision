
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
  const analyzeCameraFeedPrompt_local = ai.definePrompt({
    name: 'analyzeCameraFeedPrompt_local_action', // Unique name for this action context
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

  const analyzeCameraFeedFlow_local_action = ai.defineFlow(
    {
      name: 'analyzeCameraFeedFlow_local_action', // Unique name
      inputSchema: AnalyzeCameraFeedInputSchema,
      outputSchema: AnalyzeCameraFeedOutputSchema,
    },
    async (flowInput) => {
      try {
          const {output} = await analyzeCameraFeedPrompt_local(flowInput);
          if (!output) {
              console.warn('analyzeCameraFeedFlow: AI model did not return any output.');
              let errorMsg = "Error: AI model returned no output.";
              if (flowInput.language === 'es') errorMsg = "Error: El modelo de IA no devolvió ningún resultado.";
              else if (flowInput.language === 'pt') errorMsg = "Erro: O modelo de IA não retornou nenhuma saída.";
              return { eventDetected: false, alertMessage: errorMsg };
          }
          return output;
      } catch (error: any) {
          console.error('analyzeCameraFeedFlow: Error during AI prompt execution:', error);
          let errorMessage = "Failed to communicate with the AI model.";
          if (error?.message) {
              errorMessage = error.message;
          } else if (flowInput.language === 'es') {
              errorMessage = "Falló la comunicación con el modelo IA.";
          } else if (flowInput.language === 'pt') {
              errorMessage = "Falha na comunicação com o modelo de IA.";
          }
          return { eventDetected: false, alertMessage: `Error: ${errorMessage}` };
      }
    }
  );
  return analyzeCameraFeedFlow_local_action(input);
}
