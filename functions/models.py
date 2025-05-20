# cloud_functions/models.py

import requests
import os
from firebase_admin import auth
from flask import Flask, request, jsonify
from firebase_functions import https_fn

# Import necessary components from main
from main import verify_firebase_token, get_default_vss_base_url


@https_fn.on_request()
def list_models(request):
    """
    Cloud function to list models from the VSS API.
    Requires Firebase authentication.
    """
    if request.method != 'GET':
        return jsonify({"status": "error", "message": "Method Not Allowed"}), 405

    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}), 503

    vss_api_url = f"{vss_api_base_url}/models"
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status()
        vss_data = vss_api_response.json()
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to list models: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to list models: {e}"}), 500