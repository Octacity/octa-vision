
// This file is intentionally left blank or can be deleted.
// The frontend now calls the Cloud Run snapshot service directly.
// Keeping it blank ensures it doesn't interfere if Next.js tries to register it.

export async function POST(req: Request) {
  return new Response(
    JSON.stringify({ message: "This API route is not used. Call the snapshot service directly." }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}

    