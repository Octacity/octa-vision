
# cloud_functions/snapshots.py

import cv2
import base64
from flask import request, jsonify
import numpy as np

from .main import app, verify_firebase_token

@app.route('/take-snapshot', methods=['POST'])
def take_snapshot():
    """
    Cloud function to take a snapshot from an RTSP stream.
    Requires Firebase authentication.
    Expects a JSON body with 'rtsp_url'.
    Returns a base64 encoded JPEG image.
    """
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    request_data = request.get_json()
    if not request_data or 'rtsp_url' not in request_data:
        return jsonify({"status": "error", "message": "Missing 'rtsp_url' in request body"}), 400

    rtsp_url = request_data['rtsp_url']

    cap = None  # Initialize cap to None
    try:
        # Attempt to open the RTSP stream
        # Adding some common flags that might help with problematic streams
        cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
        
        if not cap.isOpened():
            # Try with a different backend if the first fails
            cap.release() # Release previous attempt
            cap = cv2.VideoCapture(rtsp_url, cv2.CAP_GSTREAMER) # Example: try GStreamer if available
            if not cap.isOpened():
                cap.release()
                cap = cv2.VideoCapture(rtsp_url) # Default backend
                if not cap.isOpened():
                    print(f"Error: Could not open RTSP stream: {rtsp_url}")
                    return jsonify({"status": "error", "message": f"Could not open RTSP stream: {rtsp_url}. Check URL and network accessibility."}), 500

        # Set a timeout for reading a frame (e.g., 5 seconds)
        # OpenCV's VideoCapture doesn't have a direct timeout for read() in all backends.
        # A common approach is to try reading a few frames or use a loop with a timer,
        # but for a single snapshot, we'll try a direct read.
        # cap.set(cv2.CAP_PROP_POS_FRAMES, 0) # Go to the first frame, might not be necessary or supported

        ret, frame = cap.read()

        if not ret or frame is None:
            print(f"Error: Could not read frame from RTSP stream: {rtsp_url}")
            return jsonify({"status": "error", "message": "Could not read frame from RTSP stream. The stream might be unresponsive or invalid."}), 500

        # Encode the frame as JPEG
        # Ensure frame is a valid image (not empty)
        if frame.size == 0:
            print(f"Error: Captured frame is empty from RTSP stream: {rtsp_url}")
            return jsonify({"status": "error", "message": "Captured frame is empty."}), 500
            
        is_success, buffer = cv2.imencode(".jpg", frame)
        if not is_success:
            print(f"Error: Could not encode frame to JPEG for RTSP stream: {rtsp_url}")
            return jsonify({"status": "error", "message": "Could not encode frame to JPEG."}), 500

        # Convert buffer to base64
        jpg_as_text = base64.b64encode(buffer).decode('utf-8')
        snapshot_data_uri = f"data:image/jpeg;base64,{jpg_as_text}"

        return jsonify({"status": "success", "snapshot_data_uri": snapshot_data_uri}), 200

    except cv2.error as e:
        print(f"OpenCV error processing RTSP stream {rtsp_url}: {e}")
        return jsonify({"status": "error", "message": f"OpenCV error: {str(e)}"}), 500
    except Exception as e:
        print(f"Unexpected error processing RTSP stream {rtsp_url}: {e}")
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), 500
    finally:
        if cap is not None and cap.isOpened():
            cap.release()
            
