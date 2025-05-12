
// src/services/vss-api-service.ts

/**
 * @fileOverview Service for interacting with external VSS (Video Search and Summarization) APIs.
 * This module provides functions to call VSS endpoints, such as file uploading, listing, deletion, content retrieval, health checks, and live stream management.
 */

export interface VssFile {
  id: string;
  bytes: number;
  filename: string;
  purpose: string;
  media_type: 'image' | 'video' | string; // Allow string for potential other types
  // Other fields might exist based on the API, such as created_at, updated_at, etc.
}

export interface VssFileListResponse {
  data: VssFile[];
  // Other pagination or metadata fields might exist
}

export interface VssFileUploadResponse {
  id: string;
  filename: string;
  purpose: string;
  media_type: 'image' | 'video';
  // The screenshot for POST /files (page 2) shows a more detailed response, including 'id', 'bytes', 'filename', 'purpose'.
  // Let's assume the response for upload might be similar to VssFile.
  bytes?: number;
}

export interface VssApiErrorResponse {
  code: string; // e.g., "ErrorCode"
  message: string; // e.g., "Detailed error message"
}

export interface VssStreamDetails {
  id: string;
  status: 'processing' | 'completed' | 'failed' | 'pending';
  cameraId?: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  outputUrl?: string;
}

export interface VssLiveStream {
  id: string;
  livestreamUrl: string;
  description?: string;
  chunk_duration: number;
  summary_duration: number;
  // Potentially other fields like createdAt, updatedAt, status etc.
}

export interface VssLiveStreamListResponse {
  // Assuming the API returns an array of live streams directly,
  // or an object with a 'data' property like other list responses.
  // Based on page 10, it seems to be a direct array.
  data: VssLiveStream[]; // If it's wrapped, adjust accordingly
}


const VSS_API_BASE_URL = process.env.NEXT_PUBLIC_VSS_API_BASE_URL;

/**
 * Helper function to parse API error responses.
 * @param response The fetch API Response object.
 * @returns A promise that resolves with an Error object.
 */
async function parseApiError(response: Response): Promise<Error> {
  let errorData: VssApiErrorResponse | { message: string } | string;
  const contentType = response.headers.get("content-type");

  if (contentType && contentType.includes("application/json")) {
    try {
      errorData = await response.json();
    } catch (e) {
      console.error(`VSS API request failed with status ${response.status}: ${response.statusText}. Error response body was valid JSON but failed to parse or structure was unexpected.`, e);
      // Fallback to statusText if JSON parsing of error fails or if errorData is not as expected
      return new Error(`VSS API request failed with status ${response.status}: ${response.statusText}`);
    }
  } else {
    // If not JSON, try to get text, or default to statusText
    try {
      const textError = await response.text();
      console.error(`VSS API request failed with status ${response.status}. Response: ${textError}`);
      return new Error(textError || `VSS API request failed with status ${response.status}: ${response.statusText}`);
    } catch (textErrorErr) {
        console.error(`VSS API request failed with status ${response.status}: ${response.statusText}. Could not parse response body as text.`);
        return new Error(`VSS API request failed with status ${response.status}: ${response.statusText}`);
    }
  }


  const errorMessage = typeof errorData === 'string'
    ? errorData
    : (errorData as VssApiErrorResponse).message || (errorData as { message: string }).message || `VSS API request failed with status ${response.status}`;
  const errorCode = typeof errorData === 'object' && errorData !== null && 'code' in errorData ? (errorData as VssApiErrorResponse).code : 'UnknownError';

  console.error(`VSS API Error (${response.status} - Code: ${errorCode}): ${errorMessage}`, JSON.stringify(errorData, null, 2));
  return new Error(`VSS API Error (${response.status} - Code: ${errorCode}): ${errorMessage}`);
}


/**
 * Uploads a media file to the VSS /files endpoint.
 * @param fileBuffer The buffer containing the file data.
 * @param filename The original name of the file, including extension.
 * @param mediaType The type of the media, either 'image' or 'video'.
 * @param purpose The purpose of the upload, defaults to "vision".
 * @returns A promise that resolves with the VSS API response for file upload.
 * @throws Will throw an error if the VSS_API_BASE_URL is not configured or if the API request fails.
 */
export async function uploadFileToVss(
  fileBuffer: Buffer,
  filename: string,
  mediaType: 'image' | 'video',
  purpose: string = "vision"
): Promise<VssFileUploadResponse> {
  if (!VSS_API_BASE_URL) {
    console.error("VSS_API_BASE_URL is not configured. VSS API calls will fail.");
    throw new Error("VSS_API_BASE_URL is not configured.");
  }

  const formData = new FormData();
  formData.append('purpose', purpose);
  formData.append('media_type', mediaType);
  formData.append('file', new Blob([fileBuffer]), filename);
  formData.append('filename', filename); // filename is also expected in the form data as per page 1

  let vssApiResponse;
  try {
    vssApiResponse = await fetch(`${VSS_API_BASE_URL}/files`, {
      method: 'POST',
      body: formData,
      // headers: { 'Authorization': `Bearer ${process.env.VSS_API_KEY}` } // If API key needed
    });
  } catch (networkError: any) {
    console.error("Network error when calling VSS /files API (upload):", networkError);
    throw new Error(`Network error during VSS file upload: ${networkError.message}`);
  }

  if (!vssApiResponse.ok) {
    throw await parseApiError(vssApiResponse);
  }

  try {
    return await vssApiResponse.json() as VssFileUploadResponse;
  } catch (jsonParseError: any) {
    console.error("Failed to parse VSS API success response JSON for upload:", jsonParseError);
    throw new Error(`Failed to parse VSS API upload response: ${jsonParseError.message}`);
  }
}


/**
 * Retrieves a list of files from the VSS API.
 * @param purpose Optional. Filter files by purpose.
 * @returns A promise that resolves with a list of files.
 * @throws Will throw an error if the VSS_API_BASE_URL is not configured or if the API request fails.
 */
export async function getVssFiles(purpose?: string): Promise<VssFileListResponse> {
  if (!VSS_API_BASE_URL) {
    console.error("VSS_API_BASE_URL is not configured. VSS API calls will fail.");
    throw new Error("VSS_API_BASE_URL is not configured.");
  }

  const url = new URL(`${VSS_API_BASE_URL}/files`);
  if (purpose) {
    url.searchParams.append('purpose', purpose);
  }

  let vssApiResponse;
  try {
    vssApiResponse = await fetch(url.toString(), {
      method: 'GET',
      // headers: { 'Authorization': `Bearer ${process.env.VSS_API_KEY}` } // If API key needed
    });
  } catch (networkError: any) {
    console.error("Network error when calling VSS /files API (list):", networkError);
    throw new Error(`Network error during VSS file listing: ${networkError.message}`);
  }

  if (!vssApiResponse.ok) {
    throw await parseApiError(vssApiResponse);
  }

  try {
    return await vssApiResponse.json() as VssFileListResponse;
  } catch (jsonParseError: any) {
    console.error("Failed to parse VSS API success response JSON for file list:", jsonParseError);
    throw new Error(`Failed to parse VSS API file list response: ${jsonParseError.message}`);
  }
}

/**
 * Deletes a specific file from the VSS API.
 * @param fileId The ID of the file to delete.
 * @returns A promise that resolves when the file is successfully deleted.
 * @throws Will throw an error if the VSS_API_BASE_URL is not configured or if the API request fails.
 */
export async function deleteVssFile(fileId: string): Promise<void> {
  if (!VSS_API_BASE_URL) {
    console.error("VSS_API_BASE_URL is not configured. VSS API calls will fail.");
    throw new Error("VSS_API_BASE_URL is not configured.");
  }

  if (!fileId) {
    throw new Error("File ID is required for deletion.");
  }

  let vssApiResponse;
  try {
    vssApiResponse = await fetch(`${VSS_API_BASE_URL}/files/${fileId}`, {
      method: 'DELETE',
      // headers: { 'Authorization': `Bearer ${process.env.VSS_API_KEY}` } // If API key needed
    });
  } catch (networkError: any) {
    console.error(`Network error when calling VSS /files/${fileId} API (delete):`, networkError);
    throw new Error(`Network error during VSS file deletion: ${networkError.message}`);
  }

  // For DELETE, a 200 or 204 No Content is typical for success.
  if (vssApiResponse.status === 200 || vssApiResponse.status === 204) {
    return; // Successfully deleted
  }

  // If not 200/204, then treat as an error.
  throw await parseApiError(vssApiResponse);
}

/**
 * Retrieves the content of a specific file from the VSS API.
 * @param fileId The ID of the file whose content is to be retrieved.
 * @returns A promise that resolves with a Blob containing the file content.
 * @throws Will throw an error if the VSS_API_BASE_URL is not configured or if the API request fails.
 */
export async function getVssFileContent(fileId: string): Promise<Blob> {
  if (!VSS_API_BASE_URL) {
    console.error("VSS_API_BASE_URL is not configured. VSS API calls will fail.");
    throw new Error("VSS_API_BASE_URL is not configured.");
  }

  if (!fileId) {
    throw new Error("File ID is required to get content.");
  }

  let vssApiResponse;
  try {
    vssApiResponse = await fetch(`${VSS_API_BASE_URL}/files/${fileId}/content`, {
      method: 'GET',
      // headers: { 'Authorization': `Bearer ${process.env.VSS_API_KEY}` } // If API key needed
    });
  } catch (networkError: any) {
    console.error(`Network error when calling VSS /files/${fileId}/content API:`, networkError);
    throw new Error(`Network error during VSS file content retrieval: ${networkError.message}`);
  }

  if (!vssApiResponse.ok) {
    throw await parseApiError(vssApiResponse);
  }

  try {
    return await vssApiResponse.blob();
  } catch (blobError: any) {
    console.error("Failed to get VSS API file content as Blob:", blobError);
    throw new Error(`Failed to retrieve VSS API file content: ${blobError.message}`);
  }
}

/**
 * Retrieves metadata for a specific file from the VSS API.
 * @param fileId The ID of the file for which to retrieve metadata.
 * @returns A promise that resolves with the file metadata.
 * @throws Will throw an error if the VSS_API_BASE_URL is not configured or if the API request fails.
 */
export async function getVssFileMetadata(fileId: string): Promise<VssFile> {
  if (!VSS_API_BASE_URL) {
    console.error("VSS_API_BASE_URL is not configured. VSS API calls will fail.");
    throw new Error("VSS_API_BASE_URL is not configured.");
  }

  if (!fileId) {
    throw new Error("File ID is required for metadata retrieval.");
  }

  let vssApiResponse;
  try {
    vssApiResponse = await fetch(`${VSS_API_BASE_URL}/files/${fileId}`, {
      method: 'GET',
      // headers: { 'Authorization': `Bearer ${process.env.VSS_API_KEY}` } // If API key needed
    });
  } catch (networkError: any) {
    console.error(`Network error when calling VSS /files/${fileId} API (metadata):`, networkError);
    throw new Error(`Network error during VSS file metadata retrieval: ${networkError.message}`);
  }

  if (!vssApiResponse.ok) {
    throw await parseApiError(vssApiResponse);
  }

  try {
    return await vssApiResponse.json() as VssFile;
  } catch (jsonParseError: any) {
    console.error("Failed to parse VSS API success response JSON for file metadata:", jsonParseError);
    throw new Error(`Failed to parse VSS API file metadata response: ${jsonParseError.message}`);
  }
}

/**
 * Checks the VSS API health status.
 * @returns A promise that resolves with a string indicating the health status (e.g., "OK").
 * @throws Will throw an error if the VSS_API_BASE_URL is not configured or if the API request fails.
 */
export async function checkVssApiHealth(): Promise<string> {
  if (!VSS_API_BASE_URL) {
    console.error("VSS_API_BASE_URL is not configured. VSS API calls will fail.");
    throw new Error("VSS_API_BASE_URL is not configured.");
  }

  let vssApiResponse;
  try {
    vssApiResponse = await fetch(`${VSS_API_BASE_URL}/health/ready`, {
      method: 'GET',
      // headers: { 'Authorization': `Bearer ${process.env.VSS_API_KEY}` } // If API key needed
    });
  } catch (networkError: any) {
    console.error("Network error when calling VSS /health/ready API:", networkError);
    throw new Error(`Network error during VSS API health check: ${networkError.message}`);
  }

  if (!vssApiResponse.ok) {
    throw await parseApiError(vssApiResponse);
  }

  try {
    // The health check API returns a plain text string according to screenshot page 8
    return await vssApiResponse.text();
  } catch (textParseError: any) {
    console.error("Failed to parse VSS API success response text for health check:", textParseError);
    throw new Error(`Failed to parse VSS API health check response: ${textParseError.message}`);
  }
}

/**
 * Retrieves details for a specific VSS stream.
 * @param streamId The ID of the VSS stream.
 * @returns A promise that resolves with the stream details.
 * @throws Will throw an error if the VSS_API_BASE_URL is not configured or if the API request fails.
 */
export async function getVssStreamDetails(streamId: string): Promise<VssStreamDetails> {
  if (!VSS_API_BASE_URL) {
    console.error("VSS_API_BASE_URL is not configured. VSS API calls will fail.");
    throw new Error("VSS_API_BASE_URL is not configured.");
  }

  if (!streamId) {
    throw new Error("Stream ID is required to get stream details.");
  }

  let vssApiResponse;
  try {
    // Assuming an endpoint like /streams/{streamId} based on common API patterns
    vssApiResponse = await fetch(`${VSS_API_BASE_URL}/streams/${streamId}`, {
      method: 'GET',
      // headers: { 'Authorization': `Bearer ${process.env.VSS_API_KEY}` } // If API key needed
    });
  } catch (networkError: any) {
    console.error(`Network error when calling VSS /streams/${streamId} API:`, networkError);
    throw new Error(`Network error during VSS stream details retrieval: ${networkError.message}`);
  }

  if (!vssApiResponse.ok) {
    throw await parseApiError(vssApiResponse);
  }

  try {
    return await vssApiResponse.json() as VssStreamDetails;
  } catch (jsonParseError: any) {
    console.error("Failed to parse VSS API success response JSON for stream details:", jsonParseError);
    throw new Error(`Failed to parse VSS API stream details response: ${jsonParseError.message}`);
  }
}

/**
 * Retrieves a list of all live streams from the VSS API.
 * @returns A promise that resolves with a list of live streams.
 * @throws Will throw an error if the VSS_API_BASE_URL is not configured or if the API request fails.
 */
export async function getVssLiveStreams(): Promise<VssLiveStreamListResponse> {
  if (!VSS_API_BASE_URL) {
    console.error("VSS_API_BASE_URL is not configured. VSS API calls will fail.");
    throw new Error("VSS_API_BASE_URL is not configured.");
  }

  let vssApiResponse;
  try {
    vssApiResponse = await fetch(`${VSS_API_BASE_URL}/live-stream`, {
      method: 'GET',
      // headers: { 'Authorization': `Bearer ${process.env.VSS_API_KEY}` } // If API key needed
    });
  } catch (networkError: any) {
    console.error("Network error when calling VSS /live-stream API (list):", networkError);
    throw new Error(`Network error during VSS live stream listing: ${networkError.message}`);
  }

  if (!vssApiResponse.ok) {
    throw await parseApiError(vssApiResponse);
  }

  try {
    // Page 10 shows the response as a direct array of live stream objects.
    const liveStreamsArray = await vssApiResponse.json() as VssLiveStream[];
    return { data: liveStreamsArray }; // Wrap it in 'data' to match VssLiveStreamListResponse
  } catch (jsonParseError: any) {
    console.error("Failed to parse VSS API success response JSON for live stream list:", jsonParseError);
    throw new Error(`Failed to parse VSS API live stream list response: ${jsonParseError.message}`);
  }
}

// TODO: Implement POST /live-stream - Add a live stream (details for request body needed from next screenshot)
// export async function addVssLiveStream(streamData: any): Promise<VssLiveStream> { /* ... */ }


// TODO: Implement functions for VSS Alert APIs based on pages 3, 4, 5
// Example stubs:
// export async function createVssAlert(alertData: any): Promise<any> { /* ... */ }
// export async function getVssAlerts(filters?: any): Promise<any[]> { /* ... */ }
// export async function getVssAlertById(alertId: string): Promise<any> { /* ... */ }
// export async function updateVssAlert(alertId: string, updateData: any): Promise<any> { /* ... */ }
// export async function deleteVssAlert(alertId: string): Promise<void> { /* ... */ }

// TODO: Implement functions for VSS Job APIs if needed (e.g. page 7 shows /jobs/{job_id})
// export async function getVssJobStatus(jobId: string): Promise<any> { /* ... */ }

