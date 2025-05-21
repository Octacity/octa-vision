
import cv2
from flask import Flask, request, jsonify
import numpy as np
import firebase_admin
from firebase_admin import credentials, auth, firestore
from google.cloud import storage
import os
import time

app = Flask(__name__)

# Initialize Firebase Admin SDK if not already initialized
# This is only needed if the service itself needs to interact with Firebase (e.g., for auth, which it does).
if not firebase_admin._apps:
    try:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
    except Exception as e:
        print(f"Warning: Failed to initialize Firebase Admin SDK in snapshot service: {e}. This might be an issue if token verification is strictly needed here.")
        # Depending on your auth strategy for this service, this might be critical or not.
        # If called ONLY by your authenticated Next.js backend, the token might have already been verified there.

# db = firestore.client() # Not needed if we remove Firestore updates from this service

# Initialize Google Cloud Storage client
storage_client = storage.Client()

def verify_token(req_headers):
    """Helper to verify Firebase ID token from request headers."""
    auth_header = req_headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        print("Snapshot Service: Authorization header missing or malformed.")
        return None, "Authorization header missing or malformed"
    
    id_token = auth_header.split('Bearer ')[1]
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token, None
    except Exception as e:
        print(f"Snapshot Service: Error verifying token: {e}")
        return None, str(e)

def upload_to_cloud_storage(image_buffer):
    """Uploads the image buffer to Cloud Storage."""
    # IMPORTANT: The Cloud Run service *must* have the STORAGE_BUCKET environment variable set.
    bucket_name = os.environ.get('STORAGE_BUCKET')
    if not bucket_name:
        print("Snapshot Service Error: STORAGE_BUCKET environment variable not set.")
        return None, "STORAGE_BUCKET environment variable not set for the snapshot service."

    bucket = storage_client.bucket(bucket_name)
    timestamp = int(time.time())
    # Using a generic path for snapshots from this service
    blob_name = f"service_snapshots/{timestamp}.jpg" 
    
    try:
        blob = bucket.blob(blob_name)
        blob.upload_from_string(image_buffer, content_type='image/jpeg')
        # Make the blob publicly readable to get a public URL
        # Ensure your bucket/object ACLs allow for public reads if this is intended,
        # or use signed URLs for more secure, temporary access.
        # For simplicity here, making it public.
        blob.make_public() 
        return blob.public_url, None
    except Exception as e:
        print(f"Snapshot Service Error: Error uploading to GCS: {e}")
        return None, str(e)

@app.route('/take-snapshot', methods=['POST'])
def take_snapshot():
    # Verify Firebase token
    decoded_token, token_error = verify_token(request.headers)
    if token_error:
        return jsonify({'status': 'error', 'message': f'Authentication failed: {token_error}'}), 401

    data = request.get_json()
    if not data:
        return jsonify({'status': 'error', 'message': 'Invalid JSON payload'}), 400
        
    rtsp_url = data.get('rtsp_url')

    if not rtsp_url:
        return jsonify({'status': 'error', 'message': 'No RTSP URL provided'}), 400

    cap = None
    try:
        print(f"Snapshot Service: Attempting to open RTSP stream: {rtsp_url}")
        cap = cv2.VideoCapture(rtsp_url)

        if not cap.isOpened():
            print(f"Snapshot Service Error: Could not open video stream for {rtsp_url}")
            return jsonify({'status': 'error', 'message': 'Error opening video stream or file'}), 500

        ret, frame = cap.read()

        if not ret or frame is None:
            print(f"Snapshot Service Error: Could not read frame from stream {rtsp_url}")
            return jsonify({'status': 'error', 'message': 'Error reading frame from stream'}), 500

        # Get image resolution
        height, width, _ = frame.shape
        resolution_str = f'{width}x{height}'

        # Encode frame as JPEG
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 90]
        is_success, image_buffer_cv = cv2.imencode('.jpg', frame, encode_param)

        if not is_success:
            print("Snapshot Service Error: Could not encode image to JPEG")
            return jsonify({'status': 'error', 'message': 'Error encoding image to JPEG'}), 500
        
        image_buffer_bytes = image_buffer_cv.tobytes()

        # Upload to Cloud Storage
        gcs_snapshot_url, upload_error = upload_to_cloud_storage(image_buffer_bytes)
        if upload_error:
            print(f"Snapshot Service Error: {upload_error}")
            return jsonify({'status': 'error', 'message': f'Failed to upload snapshot: {upload_error}'}), 500

        # No longer updating Firestore from here as camera_id is not provided for new cameras.
        # The frontend will save the snapshotUrl and resolution when creating the camera record.

        return jsonify({
            'status': 'success', 
            'message': 'Snapshot taken and saved to GCS', 
            'snapshotUrl': gcs_snapshot_url, 
            'resolution': resolution_str
        }), 200

    except cv2.error as e:
        print(f"Snapshot Service OpenCV Error: {e}")
        return jsonify({'status': 'error', 'message': f'OpenCV error: {str(e)}'}), 500
    except Exception as e:
        print(f"Snapshot Service Unexpected error: {e}")
        return jsonify({'status': 'error', 'message': f'An unexpected error occurred in snapshot service: {str(e)}'}), 500
    finally:
        if cap is not None and cap.isOpened():
            cap.release()
            print(f"Snapshot Service: Released video capture for {rtsp_url}")


if __name__ == '__main__':
    # Ensure the app is run with a proper WSGI server like Gunicorn in production
    # For local testing with Flask's built-in server:
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)), debug=True)
