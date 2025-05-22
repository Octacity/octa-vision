// This file is intentionally left blank.
// The frontend now calls the Cloud Run snapshot service directly for taking snapshots.
// This route is no longer used.
export async function POST(req: Request) {
  return new Response(
    JSON.stringify({ message: "This API route is not used. Call the snapshot service directly." }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}
