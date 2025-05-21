
import cv2
from flask import Flask, request, jsonify
import numpy as np
import firebase_admin
from firebase_admin import credentials, auth, firestore
from google.cloud import storage
import os
import time
import base64

app = Flask(__name__)

# Initialize Firebase Admin SDK robustly at global scope
# This should only run once when the Cloud Run instance starts.
if not firebase_admin._apps:
    try:
        print("Snapshot Service: Initializing Firebase Admin SDK...")
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
        print("Snapshot Service: Firebase Admin SDK initialized successfully.")
    except Exception as e:
        # Log a more critical error if initialization fails, as it's fundamental.
        print(f"CRITICAL: Snapshot Service: Failed to initialize Firebase Admin SDK: {e}. Token verification will fail.")
        # Depending on policy, you might want to prevent the app from starting
        # or handle this in a way that makes it clear the service is unhealthy.

def verify_token(req_headers):
    """Helper to verify Firebase ID token from request headers."""
    auth_header = req_headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        print("Snapshot Service: Authorization header missing or malformed.")
        return None, "Authorization header missing or malformed"
    
    id_token = auth_header.split('Bearer ')[1]
    if not firebase_admin._apps:
        print("Snapshot Service: Firebase Admin SDK not initialized. Cannot verify token.")
        return None, "Firebase Admin SDK not initialized on server"
        
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token, None
    except firebase_admin.auth.InvalidIdTokenError:
        print("Snapshot Service: Error verifying token - Invalid ID token.")
        return None, "Invalid ID token"
    except firebase_admin.auth.ExpiredIdTokenError:
        print("Snapshot Service: Error verifying token - Expired ID token.")
        return None, "Expired ID token"
    except firebase_admin.auth.RevokedIdTokenError:
        print("Snapshot Service: Error verifying token - Revoked ID token.")
        return None, "Revoked ID token"
    except Exception as e:
        print(f"Snapshot Service: Error verifying token: {e}")
        return None, str(e)

def upload_to_cloud_storage(image_buffer_cv, filename_on_gcs):
    """Uploads the image buffer to Cloud Storage."""
    bucket_name = os.environ.get('STORAGE_BUCKET')
    if not bucket_name:
        print("Snapshot Service Error: STORAGE_BUCKET environment variable not set.")
        return None, "STORAGE_BUCKET environment variable not set for the snapshot service."

    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    
    try:
        # Encode frame as JPEG directly to bytes
        is_success, image_buffer_bytes = cv2.imencode('.jpg', image_buffer_cv, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
        if not is_success:
            print("Snapshot Service Error: Could not encode image to JPEG for GCS upload.")
            return None, "Error encoding image to JPEG for GCS upload"

        blob = bucket.blob(filename_on_gcs)
        blob.upload_from_string(image_buffer_bytes, content_type='image/jpeg')
        blob.make_public() 
        return blob.public_url, None
    except Exception as e:
        print(f"Snapshot Service Error: Error uploading to GCS: {e}")
        return None, str(e)

@app.route('/take-snapshot', methods=['POST'])
def take_snapshot():
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

        height, width, _ = frame.shape
        resolution_str = f'{width}x{height}'

        # Create a unique filename for GCS
        timestamp = int(time.time())
        gcs_filename = f"snapshots/{timestamp}_{width}x{height}.jpg" # More descriptive filename

        gcs_snapshot_url, upload_error = upload_to_cloud_storage(frame, gcs_filename)
        if upload_error:
            print(f"Snapshot Service Error during GCS upload: {upload_error}")
            # Don't fail the whole request if GCS upload fails, but log it
            # The primary purpose for the "Add Camera" flow is to get the image data back to the frontend
            # However, if GCS upload is critical, you might want to return an error here.
            # For now, we prioritize returning the image data if capture was successful.
            gcs_snapshot_url = None # Indicate GCS upload failed

        # Encode frame as JPEG for base64 data URI (if needed by frontend, or for fallback)
        # This part is removed as the service will now primarily return GCS URL.
        # If base64 is still a desired fallback or primary, it should be re-added here.
        # For now, focusing on GCS URL as per previous iterations.

        # The service's main job for "Add Camera" step 2 is to return the GCS URL and resolution
        return jsonify({
            'status': 'success', 
            'message': 'Snapshot processed.', 
            'snapshotUrl': gcs_snapshot_url, # This is the GCS URL
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
    # This is for local execution only (e.g., python services/snapshot/main.py)
    # When deployed to Cloud Run, Gunicorn or another WSGI server is used as entrypoint.
    # Ensure STORAGE_BUCKET is set in local .env for local testing.
    print("Snapshot Service: Starting Flask development server...")
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)), debug=True)

