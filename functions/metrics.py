import requests
import os
# Keep firebase_admin and related imports if needed
from firebase_functions import https_fn
import json

# Import helper functions from main (only if needed in this file)
from main import get_default_vss_base_url


@https_fn.on_request()
def get_metrics(req: https_fn.Request) -> https_fn.Response:
    """
    Cloud function to get system metrics from the VSS API.
    Does NOT require Firebase authentication.
    """

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}), 503

    # No authentication needed for metrics, directly proceed to API call

    vss_api_url = f"{vss_api_base_url}/metrics"
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status()
        vss_data = vss_api_response.json()
        response_data = {"status": "success", "data": vss_data}
        return https_fn.Response(json.dumps(response_data), status=200, mimetype='application/json')
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API metrics: {e}")
        response_data = {"status": "error", "message": f"Error calling VSS API metrics: {e}"}
        return https_fn.Response(json.dumps(response_data), status=500, mimetype='application/json')



