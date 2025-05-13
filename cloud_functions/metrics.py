# cloud_functions/metrics.py

import requests
import os
from flask import Flask, request, jsonify, Response # Import Response

# Import necessary components from main
# Assuming main.py is in the same directory or accessible in the Python path
from main import verify_firebase_token, app, VSS_API_BASE_URL # Import app and VSS_API_BASE_URL


@app.route('/get-metrics', methods=['GET'])
def get_metrics():
    """
    Cloud function to get VIA metrics in Prometheus format from the VSS API.
    Requires Firebase authentication.
    """
    # Verify Firebase authentication
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    # Call VSS API /metrics endpoint
    vss_api_url = f"{VSS_API_BASE_URL}/metrics"
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)

        # The /metrics endpoint returns plain text
        metrics_data = vss_api_response.text

        # Return the plain text response with the correct content type
        # Use Flask's Response object to set content type correctly
        return Response(
            metrics_data,
            status=vss_api_response.status_code,
            mimetype="text/plain; version=0.0.4; charset=utf-8" # Standard Prometheus content type
        )
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to get metrics: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to get metrics: {e}"}), 500