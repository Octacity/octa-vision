# cloud_functions/config.py

import requests
import os
from flask import Flask, request, jsonify
from firebase_admin import auth

# Import app from main.py and the new function to get VSS base URL
from .main import app, verify_firebase_token, get_default_vss_base_url


@app.route('/get-recommended-config', methods=['POST'])
def get_recommended_config():
    """
    Cloud function to recommend a configuration based on video properties using the VSS API.
    Requires Firebase authentication.
    """
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    request_data = request.get_json()
    if not request_data:
        return jsonify({"status": "error", "message": "No JSON data provided in the request body"}), 400

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}), 503


    vss_api_url = f"{vss_api_base_url}/recommended_config"
    try:
        vss_api_response = requests.post(vss_api_url, json=request_data)
        vss_api_response.raise_for_status() 
        vss_data = vss_api_response.json()
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to get recommended config: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to get recommended config: {e}"}), 500
