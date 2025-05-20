# cloud_functions/health.py

import requests
import os
from flask import Flask, request, jsonify
# Import app from main.py and the new function to get VSS base URL
from .main import app, verify_firebase_token, get_default_vss_base_url


@app.route('/check-health', methods=['GET'])
def check_health():
    """
    Cloud function to check the health of the VSS API.
    Requires Firebase authentication.
    """
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}), 503

    vss_api_url = f"{vss_api_base_url}/health" 
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status() 
        vss_data = vss_api_response.json()
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API health check: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API health check: {e}"}), 500
