# cloud_functions/health.py

import requests
import os
from firebase_functions import https_fn
from main import verify_firebase_token, get_default_vss_base_url

import json # Import json for manual JSON encoding


@https_fn.on_request()
def check_health(req: https_fn.Request) -> https_fn.Response:
    """
    Cloud function to check the health of the VSS API.
    Requires Firebase authentication.
    Refactored for Firebase Functions 2nd gen to directly return https_fn.Response.
    """
    if req.method != 'GET':
        return https_fn.Response(
            json.dumps({"status": "error", "message": "Method Not Allowed"}),
            status=405,
            mimetype='application/json'
        )

    decoded_token, error = verify_firebase_token(req)
    if error:
        return https_fn.Response(
            json.dumps({"status": "error", "message": f"Authentication failed: {error}"}),
            status=401,
            mimetype='application/json'
        )

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return https_fn.Response(
            json.dumps({"status": "error", "message": f"VSS API configuration error: {e}"}),
            status=503,
            mimetype='application/json'
        )

    vss_api_url = f"{vss_api_base_url}/health"
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status()
        vss_data = vss_api_response.json()
        return https_fn.Response(
            json.dumps({"status": "success", "data": vss_data}),
            status=200,
            mimetype='application/json'
        )
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API health check: {e}")
        return https_fn.Response(
            json.dumps({"status": "error", "message": f"Error calling VSS API health check: {e}"}),
            status=500, # Use 500 for internal server errors
            mimetype='application/json'
        )