
import cv2
from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, auth
from google.cloud import storage
from google.auth import exceptions as auth_exceptions # Renamed to avoid conflict
import os
import base64
import numpy as np
import datetime
import logging

# --- Logging Configuration ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# --- CORS Configuration ---
# Get allowed origins from environment variable
# Fallback to a restrictive default or an empty list if not set in deployed env.
CORS_ALLOWED_ORIGINS_STR = os.environ.get('CORS_ALLOWED_ORIGINS')
allowed_origins_list = []

if CORS_ALLOWED_ORIGINS_STR:
    allowed_origins_list = [origin.strip() for origin in CORS_ALLOWED_ORIGINS_STR.split(',')]
    logger.info(f"Snapshot Service: Using CORS_ALLOWED_ORIGINS from environment: {allowed_origins_list}")
else:
    # Fallback for local development if VAR is not set or if running locally without .env properly sourced
    allowed_origins_list = [
        "https://6000-idx-studio-1745601753440.cluster-iesosxm5fzdewqvhlwn5qivgry.cloudworkstations.dev",
        "http://localhost:9002", # Next.js dev port
        "http://localhost:3000"  # Common React dev port
    ]
    logger.warning(f"Snapshot Service: CORS_ALLOWED_ORIGINS environment variable not set. Defaulting to: {allowed_origins_list}. Ensure this is set in your Cloud Run environment.")

logger.info(f"Snapshot Service: Flask-CORS initializing to allow origins: {allowed_origins_list}")

CORS(app,
     resources={
         r"/take-snapshot": {"origins": allowed_origins_list},
         r"/retrieve-snapshot": {"origins": allowed_origins_list}
     },
     methods=["GET", "POST", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization"],
     supports_credentials=True)

logger.info("Snapshot Service: Flask-CORS initialized.")


# --- Firebase Admin SDK Initialization ---
# Attempt to initialize Firebase Admin SDK only if it hasn't been already.
# This is crucial for Cloud Run/Functions where the environment might persist.
SERVICE_ACCOUNT_KEY_PATH = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')

logger.info(f"Snapshot Service: GOOGLE_APPLICATION_CREDENTIALS environment variable value: {SERVICE_ACCOUNT_KEY_PATH}")
try:
    if not firebase_admin._apps:
        logger.info("Snapshot Service: Attempting to initialize Firebase Admin SDK...")
        if SERVICE_ACCOUNT_KEY_PATH:
            logger.info(f"Snapshot Service: Using service account key from GOOGLE_APPLICATION_CREDENTIALS: {SERVICE_ACCOUNT_KEY_PATH}")
            cred_object = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
            firebase_admin.initialize_app(cred_object)
        else:
            logger.info("Snapshot Service: GOOGLE_APPLICATION_CREDENTIALS not set. Using Application Default Credentials (suitable for Cloud Run/Functions).")
            # For Cloud Run, Cloud Functions, GCE, etc., ApplicationDefaultCredentials() works seamlessly.
            firebase_admin.initialize_app(credentials.ApplicationDefault())
        logger.info("Snapshot Service: Firebase Admin SDK initialized successfully.")
    else:
        logger.info("Snapshot Service: Firebase Admin SDK already initialized.")
except Exception as e:
    logger.critical(f"Snapshot Service: CRITICAL - Failed to initialize Firebase Admin SDK: {e}. This will prevent token verification.")


# --- Google Cloud Storage Configuration ---
STORAGE_BUCKET_NAME = os.environ.get('STORAGE_BUCKET')
if not STORAGE_BUCKET_NAME:
    logger.critical("Snapshot Service: CRITICAL - STORAGE_BUCKET environment variable is not set. Snapshot uploads will fail.")
    # Depending on policy, you might want to raise ValueError here to prevent app startup
    # raise ValueError("CRITICAL: STORAGE_BUCKET environment variable is not set.")
else:
    logger.info(f"Snapshot Service: Configured to use GCS Bucket: {STORAGE_BUCKET_NAME}")


def verify_token_from_headers(req_headers):
    """Helper to verify Firebase ID token from request headers."""
    auth_header = req_headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        logger.warning("Snapshot Service: verify_token - Authorization header missing or malformed.")
        return None, "Authorization header missing or malformed"

    id_token = auth_header.split('Bearer ')[1]
    if not firebase_admin._apps: # Check if SDK is initialized
        logger.error("Snapshot Service: verify_token - Firebase Admin SDK not initialized. Cannot verify token.")
        return None, "Firebase Admin SDK not initialized on server"

    try:
        logger.debug("Snapshot Service: verify_token - Attempting to verify ID token...")
        decoded_token = auth.verify_id_token(id_token)
        logger.info(f"Snapshot Service: Token verified successfully for UID: {decoded_token.get('uid')}")
        return decoded_token, None
    except auth_exceptions.FirebaseError as e: # Catch specific Firebase auth errors
        logger.warning(f"Snapshot Service: Error verifying token - Firebase Auth error: {e.code} - {e.message}", exc_info=False) # exc_info=False for brevity on auth errors
        return None, f"Token verification failed: {e.message}"
    except Exception as e: # Catch any other unexpected errors
        logger.error(f"Snapshot Service: General error verifying token: {e}", exc_info=True)
        return None, f"Token verification failed: {str(e)}"

@app.route('/take-snapshot', methods=['POST', 'OPTIONS'])
def take_snapshot_route():
    logger.info(f"Snapshot Service: Received request to /take-snapshot, method: {request.method}")

    # Explicitly handle OPTIONS preflight requests for debugging
    if request.method == 'OPTIONS':
        return app.make_default_options_response()
    if request.method == 'POST':
        decoded_token, token_error = verify_token_from_headers(request.headers)
        if token_error:
            logger.error(f"Snapshot Service: /take-snapshot - Authentication failed: {token_error}")
            return jsonify({'status': 'error', 'message': f'Authentication failed: {token_error}'}), 401

        if not STORAGE_BUCKET_NAME:
             logger.error("Snapshot Service: /take-snapshot - STORAGE_BUCKET not configured.")
             return jsonify({'status': 'error', 'message': 'Server configuration error: Storage bucket not set.'}), 500

        data = request.get_json()
        if not data:
            logger.error("Snapshot Service: /take-snapshot - Invalid JSON payload received.")
            return jsonify({'status': 'error', 'message': 'Invalid JSON payload'}), 400

        rtsp_url = data.get('rtsp_url')
        if not rtsp_url:
            logger.error("Snapshot Service: /take-snapshot - No RTSP URL provided in payload.")
            return jsonify({'status': 'error', 'message': 'No RTSP URL provided'}), 400
        
        logger.info(f"Snapshot Service: /take-snapshot - Processing RTSP URL: {rtsp_url} for user UID: {decoded_token.get('uid') if decoded_token else 'Unknown'}")

        cap = None
        try:
            logger.info(f"Snapshot Service: /take-snapshot - Attempting to open video capture for {rtsp_url}")
            cap = cv2.VideoCapture(rtsp_url)
            if not cap.isOpened():
                logger.error(f"Snapshot Service: /take-snapshot - Could not open video stream for {rtsp_url}")
                return jsonify({'status': 'error', 'message': f'Could not open video stream for {rtsp_url}'}), 500
            logger.info(f"Snapshot Service: /take-snapshot - Video stream opened for {rtsp_url}")

            ret, frame = cap.read()
            if not ret or frame is None:
                logger.error(f"Snapshot Service: /take-snapshot - Could not read frame from stream {rtsp_url}")
                return jsonify({'status': 'error', 'message': f'Could not read frame from stream {rtsp_url}'}), 500
            logger.info(f"Snapshot Service: /take-snapshot - Frame read successfully from {rtsp_url}")

            height, width, _ = frame.shape
            resolution_str = f"{width}x{height}"
            logger.info(f"Snapshot Service: /take-snapshot - Captured frame resolution: {resolution_str}")

            # Encode frame to JPEG bytes
            is_success, image_buffer_bytes = cv2.imencode('.jpg', frame)
            if not is_success:
                logger.error("Snapshot Service: /take-snapshot - Error encoding image to JPEG")
                return jsonify({'status': 'error', 'message': 'Error encoding image to JPEG'}), 500

            # Initialize GCS client
            # For Cloud Run, storage.Client() without arguments will use ADC.
            storage_client = storage.Client()
            bucket = storage_client.bucket(STORAGE_BUCKET_NAME)
            
            # Generate a unique filename for GCS
            timestamp = datetime.datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
            user_uid_part = decoded_token.get('uid', 'unknown_user') if decoded_token else 'unknown_user_snapshot' # Use UID if available
            gcs_filename = f"snapshots/snap_{user_uid_part}_{timestamp}.jpg" # Example path
            
            blob = bucket.blob(gcs_filename)
            
            # Upload the image bytes
            blob.upload_from_string(image_buffer_bytes.tobytes(), content_type='image/jpeg')
            logger.info(f"Snapshot Service: /take-snapshot - Successfully uploaded {gcs_filename} to bucket {STORAGE_BUCKET_NAME}.")

            return jsonify({
                'status': 'success',
                'gcsObjectName': gcs_filename, # Return the GCS object name
                'resolution': resolution_str
            }), 200

        except cv2.error as e:
            logger.error(f"Snapshot Service: /take-snapshot - OpenCV Error: {e}", exc_info=True)
            return jsonify({'status': 'error', 'message': f'OpenCV error processing video stream: {str(e)}'}), 500
        except Exception as e:
            logger.error(f"Snapshot Service: /take-snapshot - An unexpected error occurred: {e}", exc_info=True)
            return jsonify({'status': 'error', 'message': f'An unexpected error occurred: {str(e)}'}), 500
        finally:
            if cap is not None and cap.isOpened():
                cap.release()
                logger.info(f"Snapshot Service: /take-snapshot - Released video capture for {rtsp_url}")
    
    # If not POST, Flask-CORS should handle OPTIONS, or it's an unhandled method
    # For robustness, you might return a 405 Method Not Allowed if it's not OPTIONS handled by CORS
    return jsonify(status="error", message="Unsupported HTTP method for this endpoint"), 405


@app.route('/retrieve-snapshot', methods=['POST', 'OPTIONS'])
def retrieve_snapshot_route():
    logger.info(f"Snapshot Service: Received request to /retrieve-snapshot, method: {request.method}")

    # Explicitly handle OPTIONS preflight requests for debugging
    if request.method == 'OPTIONS':
        return app.make_default_options_response()
    if request.method == 'POST':
        decoded_token, token_error = verify_token_from_headers(request.headers)
        if token_error:
            logger.error(f"Snapshot Service: /retrieve-snapshot - Authentication failed: {token_error}")
            return jsonify({'status': 'error', 'message': f'Authentication failed: {token_error}'}), 401
        
        if not STORAGE_BUCKET_NAME:
             logger.error("Snapshot Service: /retrieve-snapshot - STORAGE_BUCKET not configured.")
             return jsonify({'status': 'error', 'message': 'Server configuration error: Storage bucket not set.'}), 500

        data = request.get_json()
        if not data:
            logger.error("Snapshot Service: /retrieve-snapshot - Invalid JSON payload.")
            return jsonify({'status': 'error', 'message': 'Invalid JSON payload'}), 400

        gcs_object_name = data.get('gcsObjectName')
        if not gcs_object_name:
            logger.error("Snapshot Service: /retrieve-snapshot - No gcsObjectName provided.")
            return jsonify({'status': 'error', 'message': 'No gcsObjectName provided'}), 400

        logger.info(f"Snapshot Service: /retrieve-snapshot - Attempting to generate signed URL for: {gcs_object_name}")
        try:
            # Initialize GCS client. On Cloud Run, this uses ADC.
            storage_client = storage.Client()
            bucket = storage_client.bucket(STORAGE_BUCKET_NAME)
            blob = bucket.blob(gcs_object_name)

            if not blob.exists():
                logger.warning(f"Snapshot Service: /retrieve-snapshot - GCS object {gcs_object_name} not found in bucket {STORAGE_BUCKET_NAME}.")
                return jsonify({'status': 'error', 'message': 'Snapshot object not found'}), 404

            # Generate a v4 signed URL.
            # The service account running this Cloud Run instance needs
            # "Service Account Token Creator" role on itself to sign the URL.
            signed_url = blob.generate_signed_url(
                version="v4",
                expiration=datetime.timedelta(minutes=15), # Example: 15 minutes expiration
                method="GET",
            )
            logger.info(f"Snapshot Service: /retrieve-snapshot - Successfully generated signed URL for {gcs_object_name}")
            return jsonify({'status': 'success', 'signedUrl': signed_url}), 200
        except auth_exceptions.RefreshError as e: # Specifically catch auth RefreshError
            logger.error(
                f"Snapshot Service: /retrieve-snapshot - RefreshError generating signed URL for {gcs_object_name}: {e}. "
                "This often means the Cloud Run service account is missing the 'Service Account Token Creator' role on itself.",
                exc_info=True
            )
            return jsonify({'status': 'error', 'message': f'Error generating signed URL: IAM permission issue (Service Account Token Creator role might be missing). Details: {str(e)}'}), 500
        except Exception as e:
            logger.error(f"Snapshot Service: /retrieve-snapshot - General error generating signed URL for {gcs_object_name}: {e}", exc_info=True)
            return jsonify({'status': 'error', 'message': f'Error generating signed URL: {str(e)}'}), 500
            
    return jsonify(status="error", message="Unsupported HTTP method for this endpoint"), 405


if __name__ == '__main__':
    # PORT environment variable is automatically set by Cloud Run.
    port = int(os.environ.get('PORT', 8080))
    # FLASK_ENV can be set to 'development' for local testing.
    is_development = os.environ.get('FLASK_ENV') == 'development'
    logger.info(f"Snapshot Service: Starting Flask development server on http://0.0.0.0:{port}, debug={is_development}")
    app.run(host='0.0.0.0', port=port, debug=is_development)

