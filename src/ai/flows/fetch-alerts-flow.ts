
'use server';
/**
 * @fileOverview AI agent for fetching alerts.
 *
 * - fetchAlerts - A function that fetches alerts.
 * - FetchAlertsInput - The input type for the function.
 * - FetchAlertsOutput - The return type for the function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const AlertSchema = z.object({
  id: z.string().describe('Unique identifier for the alert.'),
  timestamp: z.string().datetime().describe('Timestamp of when the alert occurred.'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).describe('Severity level of the alert.'),
  description: z.string().describe('A brief description of the alert.'),
  source: z.string().describe('Source of the alert (e.g., camera ID, system component).'),
  status: z.enum(['new', 'acknowledged', 'resolved', 'ignored']).describe('Current status of the alert.'),
  details: z.record(z.any()).optional().describe('Any additional details or metadata associated with the alert.')
});

const FetchAlertsInputSchema = z.object({
  filterBySource: z.string().optional().describe('Filter alerts by source (e.g., camera ID).'),
  filterBySeverity: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Filter alerts by severity.'),
  filterByStatus: z.enum(['new', 'acknowledged', 'resolved', 'ignored']).optional().describe('Filter alerts by status.'),
  limit: z.number().int().positive().optional().default(50).describe('Maximum number of alerts to return.'),
  language: z.string().describe('The language for the response (e.g., "en", "es", "pt").').optional().default('en'),
});
export type FetchAlertsInput = z.infer<typeof FetchAlertsInputSchema>;

const FetchAlertsOutputSchema = z.object({
  alerts: z.array(AlertSchema).describe('A list of fetched alerts.'),
  message: z.string().optional().describe('A message summarizing the fetch operation, e.g., if no alerts were found.'),
});
export type FetchAlertsOutput = z.infer<typeof FetchAlertsOutputSchema>;

export async function fetchAlerts(input: FetchAlertsInput): Promise<FetchAlertsOutput> {
  // In a real application, this flow would interact with a database or an external Alert API.
  // For this placeholder, we'll return mock data based on the input.
  // This flow currently doesn't use an LLM prompt as it's primarily for data retrieval.
  // If natural language querying for alerts was needed, a prompt would be defined here.

  console.log("Fetching alerts with input:", input);

  // Mock data - replace with actual data fetching logic
  const mockAlerts: z.infer<typeof AlertSchema>[] = [
    { id: 'alert-001', timestamp: new Date().toISOString(), severity: 'high', description: 'Unauthorized access detected at Main Entrance.', source: 'cam-001', status: 'new', details: { location: 'Building A, Floor 1' } },
    { id: 'alert-002', timestamp: new Date(Date.now() - 3600000).toISOString(), severity: 'medium', description: 'Perimeter breach on West Fence.', source: 'cam-005', status: 'acknowledged', details: { zone: 'Zone D' } },
    { id: 'alert-003', timestamp: new Date(Date.now() - 7200000).toISOString(), severity: 'low', description: 'Low battery on sensor S-102.', source: 'sensor-S-102', status: 'new' },
    { id: 'alert-004', timestamp: new Date(Date.now() - 10800000).toISOString(), severity: 'critical', description: 'System offline: Core Processing Unit.', source: 'system-cpu-1', status: 'resolved', details: { resolutionNotes: 'Restarted unit.' } },
    { id: 'alert-005', timestamp: new Date(Date.now() - 14400000).toISOString(), severity: 'high', description: 'Unattended package found in Lobby.', source: 'cam-002', status: 'new', details: { packageType: 'Backpack' } },
  ];

  let filteredAlerts = mockAlerts;

  if (input.filterBySource) {
    filteredAlerts = filteredAlerts.filter(alert => alert.source === input.filterBySource);
  }
  if (input.filterBySeverity) {
    filteredAlerts = filteredAlerts.filter(alert => alert.severity === input.filterBySeverity);
  }
  if (input.filterByStatus) {
    filteredAlerts = filteredAlerts.filter(alert => alert.status === input.filterByStatus);
  }

  const alertsToReturn = filteredAlerts.slice(0, input.limit);

  let message: string | undefined = undefined;
  if (alertsToReturn.length === 0) {
    let baseMessage = "No alerts found";
    if (input.filterBySource || input.filterBySeverity || input.filterByStatus) {
        baseMessage += " matching your criteria";
    }
    baseMessage += ".";

    if (input.language === 'es') {
        message = "No se encontraron alertas";
        if (input.filterBySource || input.filterBySeverity || input.filterByStatus) {
            message += " que coincidan con sus criterios";
        }
        message += ".";
    } else if (input.language === 'pt') {
        message = "Nenhum alerta encontrado";
        if (input.filterBySource || input.filterBySeverity || input.filterByStatus) {
            message += " correspondente aos seus critérios";
        }
        message += ".";
    } else {
        message = baseMessage;
    }
  }


  return Promise.resolve({ alerts: alertsToReturn, message });
}

// Placeholder for the actual Genkit flow definition.
// Since this is a data retrieval operation and might not directly involve an LLM for simple filtering,
// a full ai.defineFlow and ai.definePrompt might not be strictly necessary unless
// natural language processing is required for the filtering or summarization of alerts.
// For now, the exported async function `fetchAlerts` serves as the entry point.

const fetchAlertsFlow = ai.defineFlow(
  {
    name: 'fetchAlertsFlow',
    inputSchema: FetchAlertsInputSchema,
    outputSchema: FetchAlertsOutputSchema,
  },
  async (input) => {
    // This is where you would integrate with your actual alert system or database.
    // The logic from the `fetchAlerts` function above would be moved or called from here.
    // For simplicity in this example, we're directly calling the mock implementation.
    return fetchAlerts(input);
  }
);
