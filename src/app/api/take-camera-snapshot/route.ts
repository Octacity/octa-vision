
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Next API /take-camera-snapshot: Unauthorized - Missing or invalid token in request to Next.js API route.');
      return NextResponse.json({ status: 'error', message: 'Unauthorized: Missing or invalid token to access this API route.' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];

    let body;
    try {
      body = await req.json();
    } catch (jsonError) {
      console.error('Next API /take-camera-snapshot: Invalid request body - Malformed JSON.', jsonError);
      return NextResponse.json({ status: 'error', message: 'Invalid request body: Malformed JSON.' }, { status: 400 });
    }
    
    const { rtsp_url } = body; 

    if (!rtsp_url) {
      console.error('Next API /take-camera-snapshot: Missing rtsp_url in request body');
      return NextResponse.json({ status: 'error', message: 'Missing rtsp_url in request body' }, { status: 400 });
    }

    const snapshotServiceUrl = process.env.TAKE_SNAPSHOT_CLOUD_RUN_URL; 
    if (!snapshotServiceUrl) {
      console.error("Next API /take-camera-snapshot: TAKE_SNAPSHOT_CLOUD_RUN_URL environment variable is not set on the Next.js server.");
      return NextResponse.json({ status: 'error', message: "Snapshot service configuration error on application server." }, { status: 500 });
    }

    console.log(`Next API /take-camera-snapshot: Calling snapshot service at ${snapshotServiceUrl} for RTSP URL: ${rtsp_url}`);
    
    let serviceResponse;
    try {
        serviceResponse = await fetch(snapshotServiceUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`, // Forward the token to the snapshot service
            },
            body: JSON.stringify({ rtsp_url }), // Only send rtsp_url
            signal: AbortSignal.timeout(30000) // Increased timeout to 30 seconds for snapshot service
        });
    } catch (fetchError: any) {
        console.error(`Next API /take-camera-snapshot: Error fetching from snapshot service ${snapshotServiceUrl}:`, fetchError.message);
        if (fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError') {
            return NextResponse.json({ status: 'error', message: 'Request to snapshot service timed out.' }, { status: 504 });
        }
        return NextResponse.json({ status: 'error', message: `Error communicating with snapshot service: ${fetchError.message}` }, { status: 502 });
    }

    let responseData;
    const responseText = await serviceResponse.text(); 
    console.log(`Next API /take-camera-snapshot: Raw response text from snapshot service ${snapshotServiceUrl} (status: ${serviceResponse.status}):`, responseText);

    try {
        responseData = JSON.parse(responseText); 
        console.log(`Next API /take-camera-snapshot: Parsed JSON response data from snapshot service ${snapshotServiceUrl}:`, responseData);
    } catch (parseError) {
        console.error(`Next API /take-camera-snapshot: Snapshot service (${snapshotServiceUrl}) returned non-JSON response (${serviceResponse.status}). Raw text: ${responseText}`, parseError);
        return NextResponse.json(
            { status: 'error', message: `Snapshot service returned an invalid response format. Status: ${serviceResponse.status}. Check service logs for details.` },
            { status: serviceResponse.status || 502 } 
        );
    }

    if (!serviceResponse.ok) {
      console.error(`Next API /take-camera-snapshot: Snapshot service error (${serviceResponse.status}) from ${snapshotServiceUrl}. Message from service:`, responseData?.message || "No specific message in error response from service.");
      // If the service returns 401, it means the token verification failed there.
      if (serviceResponse.status === 401) {
        return NextResponse.json(
          { status: 'error', message: responseData?.message || `Snapshot service denied access (401). This might be due to token verification issues within the snapshot service. Check snapshot service logs.` },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { status: 'error', message: responseData?.message || `Snapshot service failed with status ${serviceResponse.status}. Check service logs.` },
        { status: serviceResponse.status }
      );
    }

    if (responseData.status === 'success' && (!responseData.snapshotUrl || !responseData.resolution)) {
      console.error(`Next API /take-camera-snapshot: Snapshot service success but missing snapshotUrl or resolution. Response:`, responseData);
      return NextResponse.json(
        { status: 'error', message: 'Snapshot service reported success but did not provide complete image data (URL or resolution). Check service logs.' },
        { status: 500 } 
      );
    }

    return NextResponse.json(responseData, { status: 200 });

  } catch (error: any) {
    console.error('Next API /take-camera-snapshot: Unhandled exception in POST handler:', error);
    let message = 'Internal Server Error while processing snapshot request in Next.js API.';
    if (error.message && !error.message.includes('Internal Server Error')) {
        message = error.message;
    }
    return NextResponse.json({ status: 'error', message }, { status: 500 });
  }
}
