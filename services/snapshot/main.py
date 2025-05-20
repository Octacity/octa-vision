import cv2
import base64
from flask import Flask, request, jsonify
import numpy as np

app = Flask(__name__)

@app.route('/take-snapshot', methods=['POST'])
def take_snapshot():
    """
    Takes a snapshot from an RTSP stream and returns it as a base64 encoded image.
    """
    data = request.get_json()
    rtsp_url = data.get('rtsp_url')

    if not rtsp_url:
        return jsonify({'error': 'No RTSP URL provided'}), 400

    cap = cv2.VideoCapture(rtsp_url)

    if not cap.isOpened():
        return jsonify({'error': 'Error opening video stream or file'}), 500

    ret, frame = cap.read()

    if not ret:
        cap.release()
        return jsonify({'error': 'Error reading frame from stream'}), 500

    cap.release()

    # Encode frame as JPEG
    encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 90]
    is_success, buffer = cv2.imencode('.jpg', frame, encode_param)

    if not is_success:
        return jsonify({'error': 'Error encoding image to JPEG'}), 500

    # Convert to base64
    jpg_as_text = base64.b64encode(buffer).decode('utf-8')

    # Return as data URI
    data_uri = f"data:image/jpeg;base64,{jpg_as_text}"

    return jsonify({'snapshot': data_uri}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8080)