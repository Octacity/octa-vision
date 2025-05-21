
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];

    let body;
    try {
      body = await req.json();
    } catch (jsonError) {
      console.error('Error parsing JSON body for snapshot API:', jsonError);
      return NextResponse.json({ status: 'error', message: 'Invalid request body: Malformed JSON.' }, { status: 400 });
    }
    
    const { rtsp_url } = body;

    if (!rtsp_url) {
      return NextResponse.json({ status: 'error', message: 'Missing rtsp_url in request body' }, { status: 400 });
    }

    const snapshotServiceUrl = process.env.TAKE_SNAPSHOT_CLOUD_RUN_URL; 
    if (!snapshotServiceUrl) {
      console.error("TAKE_SNAPSHOT_CLOUD_RUN_URL environment variable is not set.");
      return NextResponse.json({ status: 'error', message: "Snapshot service configuration error on server." }, { status: 500 });
    }

    // Make the actual call to the snapshot service (Cloud Run or Cloud Function)
    const response = await fetch(snapshotServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`, // Forward the token
      },
      body: JSON.stringify({ rtsp_url }),
      // Consider adding a timeout for fetch if the snapshot service might be slow
      // signal: AbortSignal.timeout(15000) // Example: 15 second timeout
    });

    let responseData;
    try {
        responseData = await response.json(); 
    } catch (parseError) {
        console.error(`Snapshot service (${snapshotServiceUrl}) returned non-JSON response (${response.status}):`, await response.text().catch(() => "Could not read response text."));
        return NextResponse.json(
            { status: 'error', message: `Snapshot service returned an invalid response format. Status: ${response.status}` },
            { status: response.status }
        );
    }

    if (!response.ok) {
      console.error(`Snapshot service error (${response.status}) from ${snapshotServiceUrl}:`, responseData?.message || response.statusText);
      return NextResponse.json(
        { status: 'error', message: responseData?.message || `Snapshot service failed with status ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json(responseData, { status: 200 });

  } catch (error: any) {
    console.error('Error in /api/take-camera-snapshot POST handler:', error);
    let message = 'Internal Server Error while processing snapshot request.';
    if (error.name === 'AbortError') {
        message = 'Request to snapshot service timed out.';
    } else if (error.message) {
        message = error.message;
    }
    return NextResponse.json({ status: 'error', message }, { status: 500 });
  }
}

