
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Next API /take-camera-snapshot: Unauthorized - Missing or invalid token');
      return NextResponse.json({ status: 'error', message: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];

    let body;
    try {
      body = await req.json();
    } catch (jsonError) {
      console.error('Next API /take-camera-snapshot: Invalid request body - Malformed JSON.', jsonError);
      return NextResponse.json({ status: 'error', message: 'Invalid request body: Malformed JSON.' }, { status: 400 });
    }
    
    // The snapshot service no longer expects camera_id for taking a generic snapshot
    const { rtsp_url } = body; 

    if (!rtsp_url) {
      console.error('Next API /take-camera-snapshot: Missing rtsp_url in request body');
      return NextResponse.json({ status: 'error', message: 'Missing rtsp_url in request body' }, { status: 400 });
    }

    const snapshotServiceUrl = process.env.TAKE_SNAPSHOT_CLOUD_RUN_URL; 
    if (!snapshotServiceUrl) {
      console.error("Next API /take-camera-snapshot: TAKE_SNAPSHOT_CLOUD_RUN_URL environment variable is not set.");
      return NextResponse.json({ status: 'error', message: "Snapshot service configuration error on server." }, { status: 500 });
    }

    console.log(`Next API /take-camera-snapshot: Calling snapshot service at ${snapshotServiceUrl} for RTSP URL: ${rtsp_url}`);

    // Prepare payload for the snapshot service (no camera_id needed for snapshot capture)
    const servicePayload: { rtsp_url: string; } = { rtsp_url };
    
    let serviceResponse;
    try {
        serviceResponse = await fetch(snapshotServiceUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`, // Forward the token
            },
            body: JSON.stringify(servicePayload),
            signal: AbortSignal.timeout(20000) // 20 second timeout for snapshot service
        });
    } catch (fetchError: any) {
        console.error(`Next API /take-camera-snapshot: Error fetching from snapshot service ${snapshotServiceUrl}:`, fetchError.message);
        if (fetchError.name === 'AbortError') {
            return NextResponse.json({ status: 'error', message: 'Request to snapshot service timed out.' }, { status: 504 });
        }
        return NextResponse.json({ status: 'error', message: `Error communicating with snapshot service: ${fetchError.message}` }, { status: 502 }); // Bad Gateway
    }


    let responseData;
    const responseText = await serviceResponse.text(); 
    console.log(`Next API /take-camera-snapshot: Raw response text from ${snapshotServiceUrl} (status: ${serviceResponse.status}):`, responseText);

    try {
        responseData = JSON.parse(responseText); 
        console.log(`Next API /take-camera-snapshot: Parsed JSON response data from ${snapshotServiceUrl}:`, responseData);
    } catch (parseError) {
        console.error(`Next API /take-camera-snapshot: Snapshot service (${snapshotServiceUrl}) returned non-JSON response (${serviceResponse.status}). Raw text: ${responseText}`, parseError);
        return NextResponse.json(
            { status: 'error', message: `Snapshot service returned an invalid response format. Status: ${serviceResponse.status}. Check service logs.` },
            { status: serviceResponse.status || 502 } 
        );
    }

    if (!serviceResponse.ok) {
      console.error(`Next API /take-camera-snapshot: Snapshot service error (${serviceResponse.status}) from ${snapshotServiceUrl}. Message:`, responseData?.message || "No message in error response.");
      return NextResponse.json(
        { status: 'error', message: responseData?.message || `Snapshot service failed with status ${serviceResponse.status}.` },
        { status: serviceResponse.status }
      );
    }

    // Expect "status": "success", "snapshotUrl": "...", "resolution": "..."
    if (responseData.status === 'success' && (!responseData.snapshotUrl || !responseData.resolution)) {
      console.error(`Next API /take-camera-snapshot: Snapshot service success but missing snapshotUrl or resolution. Response:`, responseData);
      return NextResponse.json(
        { status: 'error', message: 'Snapshot service reported success but did not provide complete image data (URL or resolution).' },
        { status: 500 } // Or 502 if considering it a bad response from upstream
      );
    }

    return NextResponse.json(responseData, { status: 200 });

  } catch (error: any) {
    console.error('Next API /take-camera-snapshot: Unhandled exception in POST handler:', error);
    let message = 'Internal Server Error while processing snapshot request.';
    let statusCode = 500;

    if (error.message && !error.message.includes('Internal Server Error')) { // Avoid overly generic messages
        message = error.message;
    }
    return NextResponse.json({ status: 'error', message }, { status: statusCode });
  }
}
