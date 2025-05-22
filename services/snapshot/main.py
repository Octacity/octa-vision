
import cv2
from flask import Flask, request, jsonify
import logging
import time
from flask_cors import CORS # Ensure this is imported
import firebase_admin
from firebase_admin import credentials, auth, firestore
from google.cloud import storage
import os
import base64
import numpy as np

# --- Logging Configuration ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

logger.info("Snapshot Service: Starting application setup.")

app = Flask(__name__)

# --- CORS Configuration ---
CORS_ALLOWED_ORIGINS_STR = os.environ.get('CORS_ALLOWED_ORIGINS')
allowed_origins_list = []

if CORS_ALLOWED_ORIGINS_STR:
    allowed_origins_list = [origin.strip() for origin in CORS_ALLOWED_ORIGINS_STR.split(',')]
    logger.info(f"Snapshot Service: Using CORS_ALLOWED_ORIGINS from environment: {allowed_origins_list}")
else:
    # Fallback for local development if VAR is not set or if running locally without .env properly sourced
    # Ensure these match the origins your frontend is served from during development
    allowed_origins_list = [
        "http://localhost:9002",
        "https://6000-idx-studio-1745601753440.cluster-iesosxm5fzdewqvhlwn5qivgry.cloudworkstations.dev", "https://9000-idx-studio-1745601753440.cluster-iesosxm5fzdewqvhlwn5qivgry.cloudworkstations.dev"
    ]
    print(f"Warning: CORS_ALLOWED_ORIGINS environment variable not set. Defaulting to: {allowed_origins_list} for development. Ensure this is set in your Cloud Run environment for deployed services.")

CORS(app,
     origins=allowed_origins_list,
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
 allow_headers=["Content-Type", "Authorization"])

# --- Firebase Admin SDK Initialization ---
SERVICE_ACCOUNT_KEY_PATH = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS') # For local dev if set

try:
    if not firebase_admin._apps:
        if SERVICE_ACCOUNT_KEY_PATH:
            cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
            firebase_admin.initialize_app(cred)
        else:
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred)
except Exception as e:
    # Log a more detailed error if initialization fails.
    # This could prevent the app from starting correctly or handling auth.
    logger.critical(f"Failed to initialize Firebase Admin SDK: {e}. This might prevent proper CORS handling and token verification.")


STORAGE_BUCKET = os.environ.get('STORAGE_BUCKET')
if not STORAGE_BUCKET:
    raise ValueError("CRITICAL: STORAGE_BUCKET environment variable is not set.")
else:
    logger.info(f"Configured to use GCS Bucket: {STORAGE_BUCKET}")

def verify_token(req_headers):
    """Helper to verify Firebase ID token from request headers."""
    auth_header = req_headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None, "Authorization header missing or malformed"

    id_token = auth_header.split('Bearer ')[1]
    if not firebase_admin._apps: # Check if SDK was initialized
        logger.error("Firebase Admin SDK not initialized. Cannot verify token.")
        return None, "Firebase Admin SDK not initialized on server"

    try:
        logger.debug("Attempting to verify ID token...")
        decoded_token = auth.verify_id_token(id_token)
        logger.info("Token verified successfully for UID: %s", decoded_token.get('uid'))
        return decoded_token, None
    except auth.InvalidIdTokenError as e:
        logger.warning(f"Error verifying token - Invalid ID token: {e}")
        return None, "Invalid ID token"
    except auth.ExpiredIdTokenError as e:
        logger.warning(f"Error verifying token - Expired ID token: {e}")
        return None, "Expired ID token"
    except auth.RevokedIdTokenError as e:
        logger.warning(f"Error verifying token - Revoked ID token: {e}")
        return None, "Revoked ID token"
    except Exception as e: # Catch any other auth error
        logger.error(f"General error verifying token: {e}")
        return None, f"Token verification failed: {str(e)}"


def upload_to_cloud_storage(image_buffer_cv, filename_on_gcs):
    """Uploads the image buffer (OpenCV image) to Cloud Storage."""
    logger.info(f"Attempting to upload image to GCS: {filename_on_gcs}")

    storage_client = storage.Client()
    bucket = storage_client.bucket(STORAGE_BUCKET)

    try:
        # Encode OpenCV image to JPEG bytes
        is_success, image_buffer_bytes = cv2.imencode('.jpg', image_buffer_cv, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
        if not is_success:
            return None, "Error encoding image to JPEG"

        blob = bucket.blob(filename_on_gcs)

        blob.upload_from_string(image_buffer_bytes.tobytes(), content_type='image/jpeg')
        blob.make_public()

        logger.info(f"Successfully uploaded {filename_on_gcs} to bucket {STORAGE_BUCKET}. Public URL: {blob.public_url}")
        return blob.public_url, None
    except Exception as e:
        logger.error(f"Error uploading to GCS: {e}")
        return None, f"Error uploading to Google Cloud Storage: {str(e)}"


@app.route('/take-snapshot', methods=['POST', 'OPTIONS'])
def take_snapshot():
    logger.info(f"Received request to /take-snapshot, method: {request.method}")

    if request.method == 'POST':
        decoded_token, token_error = verify_token(request.headers)
        if token_error:
            logger.error(f"Authentication failed: {token_error}")
            return jsonify({'status': 'error', 'message': f'Authentication failed: {token_error}'}), 401

        data = request.get_json()
        if not data:
            logger.error("Invalid JSON payload received.")
            return jsonify({'status': 'error', 'message': 'Invalid JSON payload'}), 400

        rtsp_url = data.get('rtsp_url')
        if not rtsp_url:
            logger.error("No RTSP URL provided in payload.")
            return jsonify({'status': 'error', 'message': 'No RTSP URL provided'}), 400
        logger.info(f"Received RTSP URL: {rtsp_url}")

        cap = None
        try:
            cap = cv2.VideoCapture(rtsp_url)

            # Check if stream opened immediately
            if not cap.isOpened():
                # Try to wait a bit for stream to initialize if not opened immediately
                wait_start_time = time.time()
                logger.info("Stream not opened immediately, waiting and retrying...")
                while not cap.isOpened() and (time.time() - wait_start_time < 5): # Wait up to 5s
                    logger.debug(f"Waiting 0.5s, elapsed: {time.time() - wait_start_time:.2f}s")
                    time.sleep(0.5)
                    cap = cv2.VideoCapture(rtsp_url)

                if not cap.isOpened():
                    logger.error(f"Could not open video stream for {rtsp_url} after multiple attempts.")
                    return jsonify({'status': 'error', 'message': f'Could not open video stream for {rtsp_url}'}), 500
            logger.info(f"RTSP stream opened successfully for {rtsp_url}.")

            # Read a frame
            frame = None
            for _ in range(5): # Try up to 5 times
                ret, current_frame = cap.read()
                if ret and current_frame is not None:
                    frame = current_frame
                    logger.info(f"Frame read successfully from {rtsp_url}.")
                    break
                time.sleep(0.2) # Wait a bit between retries

            if frame is None:
                logger.error(f"Could not read a valid frame from stream {rtsp_url}.")
                return jsonify({'status': 'error', 'message': f'Could not read a valid frame from stream {rtsp_url}'}), 500

            height, width, _ = frame.shape
            resolution_str = f'{width}x{height}'

            timestamp = int(time.time())
            gcs_filename = f"snapshots/snap_{timestamp}_{resolution_str}.jpg"

            gcs_snapshot_url, upload_error = upload_to_cloud_storage(frame, gcs_filename)

            if upload_error:
                logger.error(f"Error during GCS upload: {upload_error}")
                return jsonify({'status': 'error', 'message': upload_error}), 500

            return jsonify({
                'status': 'success',
                'message': 'Snapshot taken and saved to Google Cloud Storage.',
                'snapshotUrl': gcs_snapshot_url,
                'resolution': resolution_str
            }), 200

        except cv2.error as e:
            logger.error(f"OpenCV Error: {e}", exc_info=True) # Log exception info
            return jsonify({'status': 'error', 'message': f'OpenCV error processing video stream: {str(e)}'}), 500
        except Exception as e:
            logger.error(f"An unexpected error occurred: {e}", exc_info=True) # Log exception info
            return jsonify({'status': 'error', 'message': f'An unexpected error occurred: {str(e)}'}), 500
        finally:
            if cap is not None and cap.isOpened():
                cap.release()
                logger.info(f"Released video capture for {rtsp_url}")
    else:
        logger.debug("Handling non-POST request (likely OPTIONS). CORS should handle preflight.")
        return jsonify(message="CORS Preflight check OK"), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    logger.info(f"Server running on http://0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)

    
    # Example usage (not part of the Flask app, just for illustration if run directly)
    # test_url = "rtsp://your_test_rtsp_url" 
    # # To test locally:
    # # 1. Set GOOGLE_APPLICATION_CREDENTIALS and STORAGE_BUCKET environment variables
    # # 2. Run this script: python services/snapshot/main.py
    # # 3. Send a POST request to http://localhost:8080/take-snapshot with JSON: {"rtsp_url": "your_rtsp_url_here"}
    # #    using a tool like curl or Postman, including a valid Firebase ID token in Authorization header.
    # 
    # Example Test (manual, if needed):
    # if os.environ.get('FLASK_ENV') == 'development':
    # print("Local dev mode - to test, send POST to /take-snapshot")
    pass

    