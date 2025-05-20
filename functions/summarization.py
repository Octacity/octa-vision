# cloud_functions/summarization.py

import requests
import os
from firebase_admin import auth
from flask import Flask, request, jsonify
from firebase_functions import https_fn

# Import the necessary functions from main
from main import verify_firebase_token, get_default_vss_base_url


@https_fn.on_request()
def summarize_content(request: https_fn.Request):
    """
    Cloud function to summarize content using the VSS API.
    Requires Firebase authentication.
    """
    if request.method != 'POST':
        return jsonify({"status": "error", "message": "Method Not Allowed"}), 405

    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    request_data = request.get_json()
    if not request_data or 'id' not in request_data or 'prompt' not in request_data or 'model' not in request_data:
        return jsonify({"status": "error", "message": "Missing required fields (id, prompt, or model) in request body"}), 400

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}), 503

    vss_api_url = f"{vss_api_base_url}/summarize"
    try:
        vss_api_response = requests.post(vss_api_url, json=request_data)
        vss_api_response.raise_for_status()
        vss_data = vss_api_response.json()

        return jsonify({"status": "success", "data": vss_data}), 200

    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to summarize content: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to summarize content: {e}"}), 500