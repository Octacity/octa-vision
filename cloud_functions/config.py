# cloud_functions/config.py

import requests
import os
from flask import Flask, request, jsonify
from firebase_admin import auth

# Assuming app and VSS_API_BASE_URL are available or imported from main
# For now, let's assume they are imported or handled by the main entry point
# You might need to adjust the import of 'app' and 'VSS_API_BASE_URL'
# based on how you structure the main application in main.py

# Define app and VSS_API_BASE_URL here for standalone testing or import them
app = Flask(__name__)
VSS_API_BASE_URL = os.environ.get('VSS_API_BASE_URL', 'http://localhost:5000')


def verify_firebase_token(req):
    """Verifies the Firebase ID token provided in the request."""
    auth_header = req.headers.get('Authorization')
    if not auth_header:
        return None, "Authorization header missing"

    token = auth_header.split(' ').pop()
    if not token:
        return None, "Token not found"

    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token, None
    except Exception as e:
        return None, str(e)


@app.route('/get-recommended-config', methods=['POST'])
def get_recommended_config():
    """
    Cloud function to recommend a configuration based on video properties using the VSS API.
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

    # You might want to validate the structure of request_data based on the VSS API expectations
    # For example, checking for 'video_length', 'target_response_time', 'max_event_duration'
    # if 'video_length' not in request_data or 'target_response_time' not in request_data or 'max_event_duration' not in request_data:
    #      return jsonify({"status": "error", "message": "Missing required fields in request body"}), 400

    # Call VSS API to get recommended config
    vss_api_url = f"{VSS_API_BASE_URL}/recommended_config"
    try:
        vss_api_response = requests.post(vss_api_url, json=request_data)
        vss_api_response.raise_for_status()  # Raise an HTTPError for bad responses (4xx or 5xx)
        vss_data = vss_api_response.json()
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to get recommended config: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to get recommended config: {e}"}), 500

# Note: The `main` function and `functions_framework.http` decorator should remain in main.py
# to serve as the entry point for the cloud function. The routes defined here
# will be registered with the Flask app instance managed in main.py.