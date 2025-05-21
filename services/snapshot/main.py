import cv2
from flask import Flask, request, jsonify
import numpy as np
import firebase_admin
from firebase_admin import credentials, auth, firestore
from google.cloud import storage
import os
import time

app = Flask(__name__)

# Initialize Firebase Admin SDK
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

def upload_to_cloud_storage(image_buffer, camera_id):
    """Uploads the image buffer to Cloud Storage."""
    bucket_name = os.environ.get('STORAGE_BUCKET')
    if not bucket_name:
        return None, "STORAGE_BUCKET environment variable not set"

    bucket = storage_client.bucket(bucket_name)
    timestamp = int(time.time())
    blob_name = f"snapshots/{camera_id}/{timestamp}.jpg"
    blob = bucket.blob(blob_name)
    blob.upload_from_string(image_buffer, content_type='image/jpeg')
    return blob.public_url, None

@app.route('/take-snapshot', methods=['POST'])
def take_snapshot():
    data = request.get_json()
    rtsp_url = data.get('rtsp_url')

    if not rtsp_url:
        return jsonify({'error': 'No RTSP URL provided'}), 400

    cap = cv2.VideoCapture(rtsp_url)

    # Verify user authentication
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401

    token = auth_header.split(' ')[1]
    decoded_token = verify_token(token)
    if not decoded_token:
        return jsonify({'error': 'Unauthorized'}), 401

    if not cap.isOpened():
        return jsonify({'error': 'Error opening video stream or file'}), 500

    ret, frame = cap.read()

    if not ret:
        cap.release()
        return jsonify({'error': 'Error reading frame from stream'}), 500

    cap.release()

    # Encode frame as JPEG
    encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 90]
    is_success, image_buffer = cv2.imencode('.jpg', frame, encode_param)

    if not is_success:
        return jsonify({'error': 'Error encoding image to JPEG'}), 500

    # Upload to Cloud Storage
    camera_id = data.get('camera_id') # Assuming camera_id is provided in the request
    if not camera_id:
         return jsonify({'error': 'No camera_id provided'}), 400
    
    snapshot_url, error = upload_to_cloud_storage(image_buffer.tobytes(), camera_id)
    if error:
        return jsonify({'error': f'Failed to upload snapshot: {error}'}), 500

    # Get image resolution
    height, width, _ = frame.shape

    # Update Firestore with snapshot URL and resolution
    # You'll need to implement the logic to find the correct camera document and update it.
    # For now, let's assume a cameras collection and document with camera_id
    try:
        doc_ref = db.collection('cameras').document(camera_id)
        doc_ref.update({
            'latestSnapshotUrl': snapshot_url,
            'resolution': f'{width}x{height}',
            'lastSnapshotTime': firestore.SERVER_TIMESTAMP # Optional: track snapshot time
        })
    except Exception as e:
        print(f"Error updating Firestore: {e}")
        # Decide how to handle this error - maybe log and continue, or return an error response

    return jsonify({'message': 'Snapshot taken and saved', 'snapshotUrl': snapshot_url}), 200


def update_camera_firestore(camera_id, snapshot_url, resolution):
    """Updates Firestore with the snapshot URL and resolution for a given camera."""
    try:
        doc_ref = db.collection('cameras').document(camera_id)
        doc_ref.update({
            'latestSnapshotUrl': snapshot_url,
            'resolution': resolution
        })
    except Exception as e:
        print(f"Error updating Firestore for camera {camera_id}: {e}")

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8080)