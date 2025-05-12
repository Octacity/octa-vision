// src/services/vss-api-service.ts

/**
 * @fileOverview Service for interacting with external VSS (Video Search and Summarization) APIs.
 * This module provides functions to call VSS endpoints, such as file uploading, listing, and deletion.
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
}

export interface VssApiErrorResponse {
  code: string;
  message: string;
}

const VSS_API_BASE_URL = process.env.NEXT_PUBLIC_VSS_API_BASE_URL;

/**
 * Helper function to handle API responses and errors.
 * @param response The fetch API Response object.
 * @returns The JSON parsed response.
 * @throws Will throw an error if the API request failed.
 */
async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: VssApiErrorResponse | { message: string } | string;
    try {
      errorData = await response.json();
    } catch (e) {
      console.error(`VSS API request failed with status ${response.status}: ${response.statusText}. Error response body was not valid JSON.`);
      throw new Error(`VSS API request failed with status ${response.status}: ${response.statusText}`);
    }

    const errorMessage = typeof errorData === 'string'
      ? errorData
      : (errorData as VssApiErrorResponse).message || (errorData as { message: string }).message || `VSS API request failed with status ${response.status}`;
    const errorCode = typeof errorData === 'object' && 'code' in errorData ? (errorData as VssApiErrorResponse).code : 'UnknownError';

    console.error(`VSS API Error (${response.status} - ${errorCode}): ${errorMessage}`, errorData);
    throw new Error(`VSS API Error (${response.status} - ${errorCode}): ${errorMessage}`);
  }

  try {
    const responseData: T = await response.json();
    return responseData;
  } catch (jsonParseError: any) {
    console.error("Failed to parse VSS API success response JSON:", jsonParseError);
    throw new Error(`Failed to parse VSS API response: ${jsonParseError.message}`);
  }
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
  formData.append('filename', filename);

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

  return handleApiResponse<VssFileUploadResponse>(vssApiResponse);
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

  return handleApiResponse<VssFileListResponse>(vssApiResponse);
}

/**
 * Deletes a specific file from the VSS API.
 * @param fileId The ID of the file to delete.
 * @returns A promise that resolves when the file is successfully deleted (typically an empty response or a success message).
 * @throws Will throw an error if the VSS_API_BASE_URL is not configured or if the API request fails.
 */
export async function deleteVssFile(fileId: string): Promise<void> { // Assuming DELETE returns no significant content on 200/204
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
  // The handleApiResponse might need adjustment if DELETE success isn't JSON.
  if (vssApiResponse.status === 200 || vssApiResponse.status === 204) {
    return; // Successfully deleted
  }
  
  // If not 200/204, then treat as an error and try to parse JSON error.
  await handleApiResponse<any>(vssApiResponse); // This will throw if it's an error status with JSON body
}


// Other VSS API client functions can be added here as needed based on other screenshots.
// For example:
// export async function createAlertWithVss(alertData: any): Promise<any> { ... }
// export async function getVssJobStatus(jobId: string): Promise<any> { ... }
