
'use server';
/**
 * @fileOverview AI agent for describing an image.
 *
 * - describeImage - A function that generates a description for a given image.
 * - DescribeImageInput - The input type for the describeImage function.
 * - DescribeImageOutput - The return type for the describeImage function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const DescribeImageInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "An image, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  language: z.string().describe('The language for the response (e.g., "en", "es", "pt").').optional().default('en'),
});
export type DescribeImageInput = z.infer<typeof DescribeImageInputSchema>;

const DescribeImageOutputSchema = z.object({
  description: z.string().describe('A textual description of the scene in the image.'),
});
export type DescribeImageOutput = z.infer<typeof DescribeImageOutputSchema>;

const describeImagePrompt = ai.definePrompt({
  name: 'describeImagePrompt_local',
  input: {schema: DescribeImageInputSchema},
  output: {schema: DescribeImageOutputSchema},
  prompt: `You are an AI assistant that describes scenes from images.
Provide a concise and informative description of the scene captured in the following image.
Respond in {{language}}.

Image: {{media url=imageDataUri}}

Scene Description:`,
});

const describeImageFlowInternal = ai.defineFlow(
  {
    name: 'describeImageFlow_local',
    inputSchema: DescribeImageInputSchema,
    outputSchema: DescribeImageOutputSchema,
  },
  async (flowInput) => {
    console.log('describeImageFlowInternal: Input received:', { 
        language: flowInput.language, 
        imageDataUriLength: flowInput.imageDataUri?.length 
    });
    try {
      const {output} = await describeImagePrompt(flowInput);
      console.log('describeImageFlowInternal: Output from AI prompt:', JSON.stringify(output, null, 2));

      if (!output?.description) {
        console.warn('describeImageFlowInternal: AI model did not return expected "description" structure.', output);
        let errorMsg = "Error: AI failed to generate a description.";
        if (flowInput.language === 'es') {
            errorMsg = "Error: La IA no pudo generar una descripción.";
        } else if (flowInput.language === 'pt') {
            errorMsg = "Erro: A IA não conseguiu gerar uma descrição.";
        }
        return { description: errorMsg };
      }
      return output;
    } catch (error: any) {
      console.error('describeImageFlowInternal: Error during AI prompt execution:', error);
      let errorMessage = "Failed to communicate with the AI model for image description.";
      if (error?.message) {
        errorMessage = error.message;
      } else if (flowInput.language === 'es') {
        errorMessage = "Falló la comunicación con el modelo IA para la descripción de la imagen.";
      } else if (flowInput.language === 'pt') {
        errorMessage = "Falha na comunicação com o modelo de IA para descrição da imagem.";
      }
      return { description: `Error: ${errorMessage}` };
    }
  }
);

export async function describeImage(input: DescribeImageInput): Promise<DescribeImageOutput> {
  return describeImageFlowInternal(input);
}
