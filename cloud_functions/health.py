# cloud_functions/health.py

import requests
import os
from flask import Flask, request, jsonify
from .main import verify_firebase_token, app # Assuming app and verify_firebase_token are in main.py

# Get VSS API Base URL from environment variables
VSS_API_BASE_URL = os.environ.get('VSS_API_BASE_URL')

if not VSS_API_BASE_URL:
    print("Error: VSS_API_BASE_URL environment variable not set.")
    VSS_API_BASE_URL = "http://localhost:5000" # Default for development, replace with a proper error


@app.route('/check-health', methods=['GET'])
def check_health():
    """
    Cloud function to check the health of the VSS API.
    Requires Firebase authentication.
    """
    # Verify Firebase authentication
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    # Call VSS API health endpoint
    vss_api_url = f"{VSS_API_BASE_URL}/health" # Assuming /health is the endpoint
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)
        vss_data = vss_api_response.json()
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API health check: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API health check: {e}"}), 500