
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
if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred)

db = firestore.client()

# Initialize Google Cloud Storage client
storage_client = storage.Client()

def verify_token(token):
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        print(f"Error verifying token: {e}")
        return None

def upload_to_cloud_storage(image_buffer, camera_id_for_path):
    """Uploads the image buffer to Cloud Storage."""
    bucket_name = os.environ.get('STORAGE_BUCKET')
    if not bucket_name:
        print("Error: STORAGE_BUCKET environment variable not set")
        return None, "STORAGE_BUCKET environment variable not set"

    bucket = storage_client.bucket(bucket_name)
    timestamp = int(time.time())
    # Use a generic path if camera_id_for_path is not available (e.g., for new cameras)
    path_prefix = camera_id_for_path if camera_id_for_path else "temp_snapshots"
    blob_name = f"snapshots/{path_prefix}/{timestamp}.jpg"
    
    try:
        blob = bucket.blob(blob_name)
        blob.upload_from_string(image_buffer, content_type='image/jpeg')
        return blob.public_url, None
    except Exception as e:
        print(f"Error uploading to GCS: {e}")
        return None, str(e)

@app.route('/take-snapshot', methods=['POST'])
def take_snapshot():
    data = request.get_json()
    if not data:
        return jsonify({'status': 'error', 'message': 'Invalid JSON payload'}), 400
        
    rtsp_url = data.get('rtsp_url')
    camera_id_from_request = data.get('camera_id') # This is optional for new cameras

    if not rtsp_url:
        return jsonify({'status': 'error', 'message': 'No RTSP URL provided'}), 400

    # Verify user authentication (optional, depending on how this service is secured)
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        print("Warning: No Authorization header, proceeding assuming internal call.")
        # For direct external calls, strict auth would be needed.
        # If this service is ONLY called by your trusted Next.js backend which has already verified the token,
        # this check could be considered redundant but acts as a defense in depth.
        # return jsonify({'status': 'error', 'message': 'Unauthorized - Missing or invalid token'}), 401
    else:
        token = auth_header.split('Bearer ')[1]
        decoded_token = verify_token(token)
        if not decoded_token:
            return jsonify({'status': 'error', 'message': 'Unauthorized - Invalid token'}), 401

    cap = None
    try:
        print(f"Attempting to open RTSP stream: {rtsp_url}")
        cap = cv2.VideoCapture(rtsp_url)

        if not cap.isOpened():
            print(f"Error: Could not open video stream for {rtsp_url}")
            return jsonify({'status': 'error', 'message': 'Error opening video stream or file'}), 500

        ret, frame = cap.read()

        if not ret or frame is None:
            print(f"Error: Could not read frame from stream {rtsp_url}")
            return jsonify({'status': 'error', 'message': 'Error reading frame from stream'}), 500

        # Get image resolution
        height, width, _ = frame.shape
        resolution_str = f'{width}x{height}'

        # Encode frame as JPEG
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 90]
        is_success, image_buffer_cv = cv2.imencode('.jpg', frame, encode_param)

        if not is_success:
            print("Error: Could not encode image to JPEG")
            return jsonify({'status': 'error', 'message': 'Error encoding image to JPEG'}), 500
        
        image_buffer_bytes = image_buffer_cv.tobytes()

        # Upload to Cloud Storage (use camera_id_from_request for path if available)
        snapshot_gcs_url, upload_error = upload_to_cloud_storage(image_buffer_bytes, camera_id_from_request)
        if upload_error:
            print(f"Error uploading to GCS: {upload_error}")
            return jsonify({'status': 'error', 'message': f'Failed to upload snapshot: {upload_error}'}), 500

        # If camera_id_from_request was provided, update Firestore for that existing camera
        # This part is less relevant for the "add new camera" flow's first snapshot,
        # as camera_id doesn't exist yet. But it's useful if this endpoint is reused.
        if camera_id_from_request:
            try:
                doc_ref = db.collection('cameras').document(camera_id_from_request)
                doc_ref.update({
                    'snapshotUrl': snapshot_gcs_url, 
                    'resolution': resolution_str,
                    'lastSnapshotTime': firestore.SERVER_TIMESTAMP
                })
                print(f"Firestore updated for camera {camera_id_from_request}")
            except Exception as e:
                print(f"Error updating Firestore for camera {camera_id_from_request}: {e}")
                # Log the error but don't fail the snapshot request if Firestore update fails here,
                # as the primary goal is to return the snapshot URL and resolution.

        return jsonify({
            'status': 'success', 
            'message': 'Snapshot taken and saved to GCS', 
            'snapshotUrl': snapshot_gcs_url, 
            'resolution': resolution_str
        }), 200

    except cv2.error as e:
        print(f"OpenCV Error: {e}")
        return jsonify({'status': 'error', 'message': f'OpenCV error: {str(e)}'}), 500
    except Exception as e:
        print(f"Unexpected error in take_snapshot: {e}")
        return jsonify({'status': 'error', 'message': f'An unexpected error occurred: {str(e)}'}), 500
    finally:
        if cap is not None and cap.isOpened():
            cap.release()
            print(f"Released video capture for {rtsp_url}")


if __name__ == '__main__':
    # Ensure the app is run with a proper WSGI server like Gunicorn in production
    # For local testing with Flask's built-in server:
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)), debug=True)

