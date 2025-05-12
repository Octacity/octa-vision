// src/services/vss-api-service.ts

/**
 * @fileOverview Service for interacting with external VSS (Video Search and Summarization) APIs.
 * This module provides functions to call VSS endpoints, such as file uploading.
 */

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
  // The API expects 'file' as the field name for the file binary, and 'filename' as a separate field.
  formData.append('file', new Blob([fileBuffer]), filename); // Pass filename for the Blob object
  formData.append('filename', filename); // Send filename as a separate field as per API spec

  let vssApiResponse;
  try {
    vssApiResponse = await fetch(`${VSS_API_BASE_URL}/files`, {
      method: 'POST',
      body: formData,
      // Headers for multipart/form-data are usually set automatically by fetch when using FormData.
      // If an API key or specific headers are needed, add them here.
      // e.g., headers: { 'Authorization': `Bearer ${process.env.VSS_API_KEY}` }
    });
  } catch (networkError: any) {
    console.error("Network error when calling VSS /files API:", networkError);
    throw new Error(`Network error during VSS file upload: ${networkError.message}`);
  }
  

  if (!vssApiResponse.ok) {
    let errorData: VssApiErrorResponse | { message: string } | string;
    try {
      errorData = await vssApiResponse.json();
    } catch (e) {
      // If parsing error response fails, use status text.
      console.error(`VSS API request failed with status ${vssApiResponse.status}: ${vssApiResponse.statusText}. Error response body was not valid JSON.`);
      throw new Error(`VSS API request failed with status ${vssApiResponse.status}: ${vssApiResponse.statusText}`);
    }
    
    const errorMessage = typeof errorData === 'string' 
      ? errorData 
      : (errorData as VssApiErrorResponse).message || (errorData as {message: string}).message || `VSS API request failed with status ${vssApiResponse.status}`;
    const errorCode = typeof errorData === 'object' && 'code' in errorData ? (errorData as VssApiErrorResponse).code : 'UnknownError';
    
    console.error(`VSS API Error (${vssApiResponse.status} - ${errorCode}): ${errorMessage}`, errorData);
    throw new Error(`VSS API Error (${vssApiResponse.status} - ${errorCode}): ${errorMessage}`);
  }

  try {
    const responseData: VssFileUploadResponse = await vssApiResponse.json();
    return responseData;
  } catch (jsonParseError: any) {
    console.error("Failed to parse VSS /files API success response JSON:", jsonParseError);
    throw new Error(`Failed to parse VSS API response: ${jsonParseError.message}`);
  }
}

// Other VSS API client functions can be added here as needed based on other screenshots.
// For example:
// export async function createAlertWithVss(alertData: any): Promise<any> { ... }
// export async function getVssJobStatus(jobId: string): Promise<any> { ... }
