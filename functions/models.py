import requests
import os
# Keep firebase_admin and related imports if needed
import firebase_admin
from firebase_admin import credentials, auth

# Import jsonify from flask
from flask import jsonify
from firebase_functions import https_fn
from firebase_functions.https_fn import Request, Response

from main import verify_firebase_token, get_default_vss_base_url # Import helper functions from main

@functions_framework.http
def list_models(request):
    """
    Cloud function to list available models from the VSS API.
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

    vss_api_url = f"{vss_api_base_url}/models"
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status()
        vss_data = vss_api_response.json()
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to list models: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to list models: {e}"}), 500

@functions_framework.http(service_account=SERVICE_ACCOUNT_EMAIL)
def get_model_details(request):
    """
    Cloud function to get details of a specific model from the VSS API.
    Requires Firebase authentication.
    """
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    # Extract model_id from the request URL or parameters
    try:
        path_segments = request.path.split('/')
        model_id = path_segments[-1] if path_segments[-1] and path_segments[-1] != 'get-model-details' else request.args.get('model_id')
        if not model_id:
            return jsonify({"status": "error", "message": "Model ID is required"}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": f"Error extracting model ID: {e}"}), 400

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}), 503

    vss_api_url = f"{vss_api_base_url}/models/{model_id}"
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status()
        vss_data = vss_api_response.json()
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to get model details for {model_id}: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to get model details for {model_id}: {e}"}), 500
