# cloud_functions/metrics.py

import requests
import os
from flask import Flask, request, jsonify, Response 

# Import necessary components from main
from .main import verify_firebase_token, app, get_default_vss_base_url


@app.route('/get-metrics', methods=['GET'])
def get_metrics():
    """
    Cloud function to get VIA metrics in Prometheus format from the VSS API.
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
        
    vss_api_url = f"{vss_api_base_url}/metrics"
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status() 

        metrics_data = vss_api_response.text

        return Response(
            metrics_data,
            status=vss_api_response.status_code,
            mimetype="text/plain; version=0.0.4; charset=utf-8" 
        )
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to get metrics: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to get metrics: {e}"}), 500
