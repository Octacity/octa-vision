
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
  type: z.string().optional().describe('Category or type of the alert (e.g., "theft", "safety_violation", "system_error").'),
  location: z.string().optional().describe('Geographic or descriptive location of the alert event.'),
  details: z.record(z.any()).optional().describe('Any additional details or metadata associated with the alert.')
});
export type Alert = z.infer<typeof AlertSchema>;

const FetchAlertsInputSchema = z.object({
  filterBySource: z.string().optional().describe('Filter alerts by source (e.g., camera ID).'),
  filterBySeverity: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Filter alerts by severity.'),
  filterByStatus: z.enum(['new', 'acknowledged', 'resolved', 'ignored']).optional().describe('Filter alerts by status.'),
  dateFrom: z.string().datetime().optional().describe('Filter alerts occurring on or after this ISO datetime string.'),
  dateTo: z.string().datetime().optional().describe('Filter alerts occurring on or before this ISO datetime string.'),
  sortBy: z.enum(['timestamp', 'severity', 'source', 'status']).optional().default('timestamp').describe('Field to sort alerts by.'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc').describe('Sort order for alerts.'),
  limit: z.number().int().positive().optional().default(50).describe('Maximum number of alerts to return.'),
  language: z.string().describe('The language for the response (e.g., "en", "es", "pt").').optional().default('en'),
});
export type FetchAlertsInput = z.infer<typeof FetchAlertsInputSchema>;

const FetchAlertsOutputSchema = z.object({
  alerts: z.array(AlertSchema).describe('A list of fetched alerts.'),
  totalAlerts: z.number().int().describe('Total number of alerts matching the criteria before applying the limit.'),
  message: z.string().optional().describe('A message summarizing the fetch operation, e.g., if no alerts were found.'),
});
export type FetchAlertsOutput = z.infer<typeof FetchAlertsOutputSchema>;


// Mock data - replace with actual data fetching logic
const mockAlerts: Alert[] = [
    { id: 'alert-001', timestamp: new Date().toISOString(), severity: 'high', description: 'Unauthorized access detected at Main Entrance.', source: 'cam-001', status: 'new', type: 'security', location: 'Building A, Floor 1', details: { userInvolved: 'unknown' } },
    { id: 'alert-002', timestamp: new Date(Date.now() - 3600000).toISOString(), severity: 'medium', description: 'Perimeter breach on West Fence.', source: 'cam-005', status: 'acknowledged', type: 'security', location: 'Zone D', details: { responseTeam: 'Unit B' } },
    { id: 'alert-003', timestamp: new Date(Date.now() - 7200000).toISOString(), severity: 'low', description: 'Low battery on sensor S-102.', source: 'sensor-S-102', status: 'new', type: 'system', location: 'Server Room Rack 3' },
    { id: 'alert-004', timestamp: new Date(Date.now() - 10800000).toISOString(), severity: 'critical', description: 'System offline: Core Processing Unit.', source: 'system-cpu-1', status: 'resolved', type: 'system', location: 'Data Center Core', details: { resolutionNotes: 'Restarted unit.' } },
    { id: 'alert-005', timestamp: new Date(Date.now() - 14400000).toISOString(), severity: 'high', description: 'Unattended package found in Lobby.', source: 'cam-002', status: 'new', type: 'safety', location: 'Main Lobby Reception', details: { packageType: 'Backpack' } },
    { id: 'alert-006', timestamp: new Date(Date.now() - 2 * 24 * 3600000).toISOString(), severity: 'medium', description: 'Safety equipment (helmet) not detected.', source: 'cam-010', status: 'new', type: 'safety_violation', location: 'Construction Site Sector 2' },
    { id: 'alert-007', timestamp: new Date(Date.now() - 3 * 24 * 3600000).toISOString(), severity: 'high', description: 'Loud noise detected after hours.', source: 'mic-array-01', status: 'ignored', type: 'security', location: 'Warehouse Loading Bay 3' },
    { id: 'alert-008', timestamp: new Date(Date.now() - 1 * 3600000).toISOString(), severity: 'critical', description: 'Fire alarm activated in Building C.', source: 'fire-alarm-C', status: 'new', type: 'emergency', location: 'Building C, Floor 2', details: { evacuationStatus: 'in_progress' } },
];

export async function fetchAlerts(input: FetchAlertsInput): Promise<FetchAlertsOutput> {
  // In a real application, this flow would interact with a database or an external Alert API.
  console.log("Fetching alerts with input:", input);

  let filteredAlerts = mockAlerts;

  if (input.filterBySource) {
    filteredAlerts = filteredAlerts.filter(alert => alert.source.toLowerCase().includes(input.filterBySource!.toLowerCase()));
  }
  if (input.filterBySeverity) {
    filteredAlerts = filteredAlerts.filter(alert => alert.severity === input.filterBySeverity);
  }
  if (input.filterByStatus) {
    filteredAlerts = filteredAlerts.filter(alert => alert.status === input.filterByStatus);
  }
  if (input.dateFrom) {
    filteredAlerts = filteredAlerts.filter(alert => new Date(alert.timestamp) >= new Date(input.dateFrom!));
  }
  if (input.dateTo) {
    filteredAlerts = filteredAlerts.filter(alert => new Date(alert.timestamp) <= new Date(input.dateTo!));
  }

  const totalAlerts = filteredAlerts.length;

  // Sorting
  if (input.sortBy) {
    filteredAlerts.sort((a, b) => {
      let valA: any = a[input.sortBy!];
      let valB: any = b[input.sortBy!];

      if (input.sortBy === 'timestamp') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      } else if (typeof valA === 'string' && typeof valB === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }
      // For severity, we might want a custom sort order (e.g., critical > high > medium > low)
      // For simplicity, basic string/number comparison is used here.

      if (valA < valB) return input.sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return input.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }


  const alertsToReturn = filteredAlerts.slice(0, input.limit);

  let message: string | undefined = undefined;
  if (alertsToReturn.length === 0) {
    let baseMessage = "No alerts found";
    const criteriaApplied = input.filterBySource || input.filterBySeverity || input.filterByStatus || input.dateFrom || input.dateTo;
    if (criteriaApplied) {
        baseMessage += " matching your criteria";
    }
    baseMessage += ".";

    if (input.language === 'es') {
        message = "No se encontraron alertas";
        if (criteriaApplied) {
            message += " que coincidan con sus criterios";
        }
        message += ".";
    } else if (input.language === 'pt') {
        message = "Nenhum alerta encontrado";
        if (criteriaApplied) {
            message += " correspondente aos seus critérios";
        }
        message += ".";
    } else {
        message = baseMessage;
    }
  }

  return Promise.resolve({ alerts: alertsToReturn, totalAlerts, message });
}


const fetchAlertsFlow = ai.defineFlow(
  {
    name: 'fetchAlertsFlow',
    inputSchema: FetchAlertsInputSchema,
    outputSchema: FetchAlertsOutputSchema,
  },
  async (input) => {
    // This is where you would integrate with your actual alert system or database.
    // The logic from the `fetchAlerts` function above would be moved or called from here.
    return fetchAlerts(input); // Directly call the refined mock implementation
  }
);

// No need to export fetchAlerts directly if it's only used by the flow.
// However, keeping it exported might be useful for testing or direct use in server components
// if that pattern is desired, but typically flows are the primary interface.
// For now, we'll assume the flow `fetchAlertsFlow` is the main callable.
// If you were to use `fetchAlerts` directly (e.g., in a server component):
// export { fetchAlerts };

// Or, to make the flow itself directly callable with the simpler name `fetchAlerts`:
// export async function fetchAlerts(input: FetchAlertsInput): Promise<FetchAlertsOutput> {
//   return fetchAlertsFlow(input);
// }
// This is a common pattern if you prefer not to export the flow object itself.
// For this update, we'll keep the current structure where `fetchAlerts` is exported and called by the flow.
// The primary entry point for external calls would be the flow if using Genkit's flow invocation mechanisms.
// If called directly as a server action from a component, the exported `fetchAlerts` function is used.
// The original request was to implement a flow, so the `fetchAlertsFlow` definition and calling `fetchAlerts` within it is correct.

// To ensure the flow itself can be called as if it's the `fetchAlerts` function,
// you can re-export the flow execution if desired, though the current structure is valid.
// Example of re-exporting the flow:
// const callableFetchAlertsFlow = async (input: FetchAlertsInput): Promise<FetchAlertsOutput> => {
//   return fetchAlertsFlow(input);
// };
// export { callableFetchAlertsFlow as fetchAlerts };
// For now, the original structure is fine and the `fetchAlerts` function remains exported and used by the flow.
// The primary function to be called from UI (as a server action) would be `fetchAlerts`.
// Let's ensure `dev.ts` imports this file so the flow is registered with Genkit.
// This is already done in the existing `dev.ts`.
