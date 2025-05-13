# cloud_functions/streams.py

import requests
import os
from firebase_admin import auth
from flask import Flask, request, jsonify

# Assuming Flask app and verify_firebase_token are defined in main.py
# We will need to import them in the main.py file and pass the app object
# to this file or use a Blueprint. For now, we assume 'app' and 'verify_firebase_token'
# are accessible (e.g., if this file is imported after they are defined in main.py).
# A better approach would be using Blueprints, but let's stick to the prompt's request
# of importing from main for now. This will require adjustments in main.py later.

# Placeholder for 'app' and 'verify_firebase_token'.
# In a real scenario with separate files, you'd use Flask Blueprints
# or pass the app object. For this exercise, we'll assume they are globally
# available after being defined in main.py and this file is imported.
try:
    from main import app, verify_firebase_token, VSS_API_BASE_URL
except ImportError:
    # This is a fallback for testing or if running this file standalone
    # In the final structure, main.py will provide these.
    app = Flask(__name__)
    VSS_API_BASE_URL = os.environ.get('VSS_API_BASE_URL', 'http://localhost:5000')
    def verify_firebase_token(req):
        # Placeholder verification function
        auth_header = req.headers.get('Authorization')
        if auth_header == 'Bearer mock-token':
            return {'uid': 'mock-user'}, None
        return None, "Mock authentication failed"


@app.route('/start-stream', methods=['POST'])
def start_stream():
    """
    Cloud function to start a live stream with the VSS API.
    Requires Firebase authentication.
    """
    # Verify Firebase authentication
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    # Get data from the request body
    request_data = request.get_json()
    if not request_data:
        return jsonify({"status": "error", "message": "No JSON data provided in the request body"}), 400

    # Call VSS API to start a stream
    vss_api_url = f"{VSS_API_BASE_URL}/streams" # Assuming /streams is the endpoint
    try:
        vss_api_response = requests.post(vss_api_url, json=request_data)
        vss_api_response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)
        vss_data = vss_api_response.json()
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to start stream: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to start stream: {e}"}), 500


@app.route('/stop-stream/<stream_id>', methods=['DELETE'])
def stop_stream(stream_id):
    """
    Cloud function to stop a specific live stream with the VSS API.
    Requires Firebase authentication.
    """
    # Verify Firebase authentication
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    # Call VSS API to stop the stream
    vss_api_url = f"{VSS_API_BASE_URL}/streams/{stream_id}" # Assuming /streams/{stream_id} is the endpoint
    try:
        vss_api_response = requests.delete(vss_api_url)
        vss_api_response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)
        # VSS API might return a success message or empty body on successful deletion
        try:
            vss_data = vss_api_response.json()
        except requests.exceptions.JSONDecodeError:
            vss_data = {"message": "Stream stopped successfully"} # Assume success if no JSON body
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to stop stream {stream_id}: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to stop stream {stream_id}: {e}"}), 500


@app.route('/list-streams', methods=['GET'])
def list_streams():
    """
    Cloud function to list live streams from the VSS API.
    Requires Firebase authentication.
    """
    # Verify Firebase authentication
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    # Call VSS API to list streams
    vss_api_url = f"{VSS_API_BASE_URL}/streams" # Assuming /streams is the endpoint
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)
        vss_data = vss_api_response.json()
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to list streams: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to list streams: {e}"}), 500


@app.route('/get-stream-details/<stream_id>', methods=['GET'])
def get_stream_details(stream_id):
    """
    Cloud function to get details of a specific stream from the VSS API.
    Requires Firebase authentication.
    """
    # Verify Firebase authentication
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    if not stream_id:
        return jsonify({"status": "error", "message": "Stream ID is required"}), 400

    # Call VSS API to get stream details
    vss_api_url = f"{VSS_API_BASE_URL}/streams/{stream_id}"
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)
        vss_data = vss_api_response.json()
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to get stream details for {stream_id}: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to get stream details for {stream_id}: {e}"}), 500


@app.route('/get-live-stream-by-id/<stream_id>', methods=['GET'])
def get_live_stream_by_id(stream_id):
    """
    Cloud function to get details of a specific live stream from the VSS API.
    Requires Firebase authentication.
    """
    # Verify Firebase authentication
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    if not stream_id:
        return jsonify({"status": "error", "message": "Live stream ID is required"}), 400

    # Call VSS API to get live stream details
    vss_api_url = f"{VSS_API_BASE_URL}/live-stream/{stream_id}"
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)
        vss_data = vss_api_response.json()
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to get live stream details for {stream_id}: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to get live stream details for {stream_id}: {e}"}), 500