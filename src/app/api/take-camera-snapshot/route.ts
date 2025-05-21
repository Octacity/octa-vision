
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Snapshot API Error: Unauthorized - Missing or invalid token');
      return NextResponse.json({ status: 'error', message: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];

    let body;
    try {
      body = await req.json();
    } catch (jsonError) {
      console.error('Snapshot API Error: Invalid request body - Malformed JSON.', jsonError);
      return NextResponse.json({ status: 'error', message: 'Invalid request body: Malformed JSON.' }, { status: 400 });
    }
    
    const { rtsp_url } = body;

    if (!rtsp_url) {
      console.error('Snapshot API Error: Missing rtsp_url in request body');
      return NextResponse.json({ status: 'error', message: 'Missing rtsp_url in request body' }, { status: 400 });
    }

    const snapshotServiceUrl = process.env.TAKE_SNAPSHOT_CLOUD_RUN_URL; 
    if (!snapshotServiceUrl) {
      console.error("Snapshot API Error: TAKE_SNAPSHOT_CLOUD_RUN_URL environment variable is not set.");
      return NextResponse.json({ status: 'error', message: "Snapshot service configuration error on server." }, { status: 500 });
    }

    console.log(`Snapshot API: Calling snapshot service at ${snapshotServiceUrl} for RTSP URL: ${rtsp_url}`);

    const response = await fetch(snapshotServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`, // Forward the token
      },
      body: JSON.stringify({ rtsp_url }),
      // signal: AbortSignal.timeout(15000) // Example: 15 second timeout (optional)
    });

    let responseData;
    const responseText = await response.text(); // Get text first for robust logging
    console.log(`Snapshot API: Raw response text from ${snapshotServiceUrl} (status: ${response.status}):`, responseText);

    try {
        responseData = JSON.parse(responseText); 
        console.log(`Snapshot API: Parsed JSON response data from ${snapshotServiceUrl}:`, responseData);
    } catch (parseError) {
        console.error(`Snapshot API Error: Snapshot service (${snapshotServiceUrl}) returned non-JSON response (${response.status}). Raw text: ${responseText}`, parseError);
        return NextResponse.json(
            { status: 'error', message: `Snapshot service returned an invalid response format. Status: ${response.status}. Check server logs for details.` },
            { status: response.status || 502 } // Use 502 for Bad Gateway if original status is missing
        );
    }

    if (!response.ok) {
      console.error(`Snapshot API Error: Snapshot service error (${response.status}) from ${snapshotServiceUrl}. Message:`, responseData?.message || "No message in error response.");
      return NextResponse.json(
        { status: 'error', message: responseData?.message || `Snapshot service failed with status ${response.status}.` },
        { status: response.status }
      );
    }

    // Ensure the expected fields are present for a successful response
    if (responseData.status === 'success' && !responseData.snapshot_data_uri) {
      console.error(`Snapshot API Error: Snapshot service returned success status but missing snapshot_data_uri. Response:`, responseData);
      return NextResponse.json(
        { status: 'error', message: 'Snapshot service reported success but did not provide image data.' },
        { status: 500 }
      );
    }


    return NextResponse.json(responseData, { status: 200 });

  } catch (error: any) {
    console.error('Snapshot API Error: Unhandled exception in /api/take-camera-snapshot POST handler:', error);
    let message = 'Internal Server Error while processing snapshot request.';
    let statusCode = 500;

    if (error.name === 'AbortError') {
        message = 'Request to snapshot service timed out.';
        statusCode = 504; // Gateway Timeout
    } else if (error.message) {
        // Avoid exposing too much internal detail if it's a generic error
        message = 'An unexpected error occurred while contacting the snapshot service.';
    }
    return NextResponse.json({ status: 'error', message }, { status: statusCode });
  }
}
