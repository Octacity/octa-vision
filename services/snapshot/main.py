
import cv2
from flask import Flask, request, jsonify
from flask_cors import CORS # Ensure this is imported
import numpy as np
import firebase_admin
from firebase_admin import credentials, auth, firestore
from google.cloud import storage
import os
import time
import base64

app = Flask(__name__)

# --- CORS Configuration ---
# Read allowed origins from environment variable
CORS_ALLOWED_ORIGINS_STR = os.environ.get('CORS_ALLOWED_ORIGINS')

if CORS_ALLOWED_ORIGINS_STR:
    allowed_origins_list = [origin.strip() for origin in CORS_ALLOWED_ORIGINS_STR.split(',')]
    print(f"Snapshot Service: Using CORS_ALLOWED_ORIGINS from environment: {allowed_origins_list}")
else:
    # Fallback for local development if the environment variable is not set
    allowed_origins_list = [
        "http://localhost:9002", # Your Next.js dev port
        "http://localhost:3000", # Common React dev port
        "https://6000-idx-studio-1745601753440.cluster-iesosxm5fzdewqvhlwn5qivgry.cloudworkstations.dev" # Firebase Studio
    ]
    print(f"Snapshot Service: Warning - CORS_ALLOWED_ORIGINS environment variable not set. Using default development origins: {allowed_origins_list}")

# Initialize CORS for the specific endpoint
CORS(app, 
     resources={r"/take-snapshot": {"origins": allowed_origins_list}},
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"], # Ensure OPTIONS is included
     allow_headers=["Content-Type", "Authorization"], # Ensure Authorization is allowed
     supports_credentials=True)
print(f"Snapshot Service: Flask-CORS initialized for /take-snapshot with origins: {allowed_origins_list}, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], headers: ['Content-Type', 'Authorization'], credentials: True")
# --- End CORS Configuration ---


# --- Firebase Admin SDK Initialization ---
SERVICE_ACCOUNT_KEY_PATH = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS') # For local dev if set

try:
    print("Snapshot Service: Attempting to initialize Firebase Admin SDK...")
    if not firebase_admin._apps:
        if SERVICE_ACCOUNT_KEY_PATH:
            print(f"Snapshot Service: Using service account key from GOOGLE_APPLICATION_CREDENTIALS: {SERVICE_ACCOUNT_KEY_PATH}")
            cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
            firebase_admin.initialize_app(cred)
            print("Snapshot Service: Firebase Admin SDK initialized successfully using service account key file.")
        else:
            print("Snapshot Service: GOOGLE_APPLICATION_CREDENTIALS not set, attempting Application Default Credentials (suitable for Cloud Run/Functions).")
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred)
            print("Snapshot Service: Firebase Admin SDK initialized successfully using Application Default Credentials.")
    else:
        print("Snapshot Service: Firebase Admin SDK already initialized.")
except Exception as e:
    print(f"CRITICAL: Snapshot Service: Failed to initialize Firebase Admin SDK: {e}. This might prevent proper CORS handling and token verification.")
# --- End Firebase Admin SDK Initialization ---


# --- Storage Bucket Configuration ---
STORAGE_BUCKET_NAME = os.environ.get('STORAGE_BUCKET')
if not STORAGE_BUCKET_NAME:
    # This is a critical configuration. The application should not start without it.
    # Raising an error here will prevent Flask from starting if the bucket isn't configured.
    print("CRITICAL: STORAGE_BUCKET environment variable is not set. Snapshot service cannot function correctly.")
    raise ValueError("CRITICAL: STORAGE_BUCKET environment variable is not set.")
else:
    print(f"Snapshot Service: Configured to use GCS Bucket: {STORAGE_BUCKET_NAME}")
# --- End Storage Bucket Configuration ---


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
        print("Snapshot Service: Token verified successfully for UID:", decoded_token.get('uid'))
        return decoded_token, None
    except auth.InvalidIdTokenError as e:
        print(f"Snapshot Service: Error verifying token - Invalid ID token: {e}")
        return None, "Invalid ID token"
    except auth.ExpiredIdTokenError as e:
        print(f"Snapshot Service: Error verifying token - Expired ID token: {e}")
        return None, "Expired ID token"
    except auth.RevokedIdTokenError as e:
        print(f"Snapshot Service: Error verifying token - Revoked ID token: {e}")
        return None, "Revoked ID token"
    except auth.UserDisabledError as e:
        print(f"Snapshot Service: Error verifying token - User disabled: {e}")
        return None, "User account has been disabled"
    except Exception as e: 
        print(f"Snapshot Service: General error verifying token: {e}")
        return None, f"Token verification failed: {str(e)}"


def upload_to_cloud_storage(image_buffer_cv, filename_on_gcs):
    """Uploads the image buffer to Cloud Storage."""
    if not STORAGE_BUCKET_NAME:
        print("Snapshot Service Error: STORAGE_BUCKET_NAME is not configured. Cannot upload.")
        # This should ideally be caught by the startup check, but good to have a runtime check too.
        return None, "Storage bucket not configured on server."

    storage_client = storage.Client()
    bucket = storage_client.bucket(STORAGE_BUCKET_NAME)
    
    try:
        is_success, image_buffer_bytes = cv2.imencode('.jpg', image_buffer_cv, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
        if not is_success:
            print("Snapshot Service Error: Could not encode image to JPEG for GCS upload.")
            return None, "Error encoding image to JPEG"

        blob = bucket.blob(filename_on_gcs)
        blob.upload_from_string(image_buffer_bytes.tobytes(), content_type='image/jpeg')
        
        # Make the blob publicly readable for simplicity. Consider signed URLs for production.
        blob.make_public() 
        
        print(f"Snapshot Service: Successfully uploaded {filename_on_gcs} to bucket {STORAGE_BUCKET_NAME}. Public URL: {blob.public_url}")
        return blob.public_url, None
    except Exception as e:
        print(f"Snapshot Service Error: Error uploading to GCS: {e}")
        return None, f"Error uploading to Google Cloud Storage: {str(e)}"


@app.route('/take-snapshot', methods=['POST', 'OPTIONS'])
def take_snapshot():
    print(f"Snapshot Service: Received request to /take-snapshot, method: {request.method}")
    # Flask-CORS handles OPTIONS request if configured for this route and methods.

    # For POST requests
    decoded_token, token_error = verify_token(request.headers)
    if token_error:
        return jsonify({'status': 'error', 'message': f'Authentication failed: {token_error}'}), 401

    data = request.get_json()
    if not data:
        return jsonify({'status': 'error', 'message': 'Invalid JSON payload'}), 400
        
    rtsp_url = data.get('rtsp_url')
    if not rtsp_url:
        return jsonify({'status': 'error', 'message': 'RTSP URL is required in the request body'}), 400

    cap = None
    try:
        print(f"Snapshot Service: Attempting to open RTSP stream: {rtsp_url}")
        cap = cv2.VideoCapture(rtsp_url)

        if not cap.isOpened():
            error_msg = f"Could not open video stream for {rtsp_url}. Check URL and network accessibility."
            print(f"Snapshot Service Error: {error_msg}")
            return jsonify({'status': 'error', 'message': error_msg}), 500

        ret, frame = cap.read()

        if not ret or frame is None:
            error_msg = f"Could not read frame from stream {rtsp_url}. Stream might be unstable or have ended."
            print(f"Snapshot Service Error: {error_msg}")
            return jsonify({'status': 'error', 'message': error_msg}), 500

        height, width, _ = frame.shape
        resolution_str = f'{width}x{height}'
        print(f"Snapshot Service: Frame captured successfully. Resolution: {resolution_str}")

        timestamp = int(time.time())
        gcs_filename = f"snapshots/{timestamp}_{resolution_str}.jpg"

        gcs_snapshot_url, upload_error = upload_to_cloud_storage(frame, gcs_filename)
        if upload_error:
            print(f"Snapshot Service Error during GCS upload: {upload_error}")
            return jsonify({'status': 'error', 'message': upload_error}), 500
        
        return jsonify({
            'status': 'success', 
            'message': 'Snapshot taken and saved to Google Cloud Storage.', 
            'snapshotUrl': gcs_snapshot_url,
            'resolution': resolution_str
        }), 200

    except cv2.error as e:
        print(f"Snapshot Service OpenCV Error: {e}")
        return jsonify({'status': 'error', 'message': f'OpenCV error processing video stream: {str(e)}'}), 500
    except Exception as e:
        print(f"Snapshot Service Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'message': f'An unexpected error occurred: {str(e)}'}), 500
    finally:
        if cap is not None and cap.isOpened():
            cap.release()
            print(f"Snapshot Service: Released video capture for {rtsp_url}")


if __name__ == '__main__':
    print("Snapshot Service: Starting Flask development server for local testing...")
    # For local testing, ensure .env file in this directory has STORAGE_BUCKET and CORS_ALLOWED_ORIGINS.
    # Also, ensure GOOGLE_APPLICATION_CREDENTIALS points to your service account key for local Firebase Admin SDK.
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)), debug=True)

