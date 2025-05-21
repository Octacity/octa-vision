import requests
import os
# Keep firebase_admin and related imports if needed
import firebase_admin
from firebase_admin import credentials, auth

from firebase_functions import https_fn
from firebase_functions.https_fn import Request, Response
# Import helper functions from main
from main import verify_firebase_token, get_default_vss_base_url

@functions_framework.http
@https_fn.on_request()
def create_summarization_job(req: Request) -> Response:
    """
    Cloud function to create a summarization job in the VSS API.
    Requires Firebase authentication.
    """
    decoded_token, error = verify_firebase_token(req)
    if error:
 return https_fn.Response(jsonify({"status": "error", "message": f"Authentication failed: {error}"}).get_data(as_text=True), status=401, mimetype='application/json')

    try:
        request_data = request.get_json()
        file_ids = request_data.get('file_ids')
        model_id = request_data.get('model_id')
        output_format = request_data.get('output_format', 'text') # Default to text

        if not file_ids or not isinstance(file_ids, list) or not model_id:
 return https_fn.Response(jsonify({"status": "error", "message": "file_ids (list) and model_id are required"}).get_data(as_text=True), status=400, mimetype='application/json')

    except Exception as e:
 return https_fn.Response(jsonify({"status": "error", "message": f"Invalid JSON input: {e}"}).get_data(as_text=True), status=400, mimetype='application/json')

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
 return https_fn.Response(jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}).get_data(as_text=True), status=503, mimetype='application/json')

    vss_api_url = f"{vss_api_base_url}/summarize"
    payload = {
        'file_ids': file_ids,
        'model_id': model_id,
        'output_format': output_format
    }

    try:
        vss_api_response = requests.post(vss_api_url, json=payload)
        vss_api_response.raise_for_status()
        vss_data = vss_api_response.json()
 return https_fn.Response(jsonify({"status": "success", "data": vss_data}).get_data(as_text=True), status=200, mimetype='application/json')
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to create summarization job: {e}")
 return https_fn.Response(jsonify({"status": "error", "message": f"Error calling VSS API to create summarization job: {e}"}).get_data(as_text=True), status=500, mimetype='application/json')

@https_fn.on_request()
def get_summarization_job_status(req: Request) -> Response:
    """
    Cloud function to get the status of a summarization job from the VSS API.
    Requires Firebase authentication.
    """

    decoded_token, error = verify_firebase_token(req)
    if error:
 return https_fn.Response(jsonify({"status": "error", "message": f"Authentication failed: {error}"}).get_data(as_text=True), status=401, mimetype='application/json')

    # Extract job_id from the request URL or parameters
    try:
        job_id = req.args.get('job_id')
        if not job_id:
 return https_fn.Response(jsonify({"status": "error", "message": "Job ID is required"}).get_data(as_text=True), status=400, mimetype='application/json')
    except Exception as e:
 return https_fn.Response(jsonify({"status": "error", "message": f"Error extracting Job ID: {e}"}).get_data(as_text=True), status=400, mimetype='application/json')


    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}), 503

    vss_api_url = f"{vss_api_base_url}/summarize/{job_id}"
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status()
        vss_data = vss_api_response.json()
 return https_fn.Response(jsonify({"status": "success", "data": vss_data}).get_data(as_text=True), status=200, mimetype='application/json')
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to get summarization job status for {job_id}: {e}")
 return https_fn.Response(jsonify({"status": "error", "message": f"Error calling VSS API to get summarization job status for {job_id}: {e}"}).get_data(as_text=True), status=500, mimetype='application/json')

@https_fn.on_request()
def get_summarization_job_result(req: Request) -> Response:
    """
    Cloud function to get the result of a completed summarization job from the VSS API.
    Requires Firebase authentication.
    """
    decoded_token, error = verify_firebase_token(req)
    if error:\n return https_fn.Response(jsonify({"status": "error", "message": f"Authentication failed: {error}"}).get_data(as_text=True), status=401, mimetype='application/json')\n\n    # Extract job_id from the request URL or parameters\n    try:\n        path_segments = req.path.split(\'/\')\n        # Adjusted logic to primarily look for job_id in the path segment before the /result part\n        # and fallback to args if not found in path or path is just /result\n        if len(path_segments) > 2 and path_segments[-1] == 'result':\n            job_id = path_segments[-2]\n        elif len(path_segments) > 1 and path_segments[-1] != 'get-summarization-job-result':\n            job_id = path_segments[-1] # Handle cases where the path might just be /<job_id>/result\n        else:\n            job_id = req.args.get('job_id') # Fallback to query parameter\n\n        if not job_id:\n            return https_fn.Response(jsonify({"status": "error", "message": "Job ID is required"}).get_data(as_text=True), status=400, mimetype='application/json')\n    except Exception as e:\n        return https_fn.Response(jsonify({"status": "error", "message": f"Error extracting Job ID: {e}"}).get_data(as_text=True), status=400, mimetype='application/json')\n\n\n    try:\n        vss_api_base_url = get_default_vss_base_url()\n    except ValueError as e:\n        print(f"Configuration Error: {e}")\n        return https_fn.Response(jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}).get_data(as_text=True), status=503, mimetype='application/json')\n\n    vss_api_url = f"{vss_api_base_url}/summarize/{job_id}/result"\n    try:\n        vss_api_response = requests.get(vss_api_url)\n        vss_api_response.raise_for_status()\n        vss_data = vss_api_response.json()\n        return https_fn.Response(jsonify({"status": "success", "data": vss_data}).get_data(as_text=True), status=200, mimetype='application/json')\n    except requests.exceptions.RequestException as e:\n        print(f"Error calling VSS API to get summarization job result for {job_id}: {e}")\n        return https_fn.Response(jsonify({"status": "error", "message": f"Error calling VSS API to get summarization job result for {job_id}: {e}"}).get_data(as_text=True), status=500, mimetype='application/json')
    # Extract job_id from the request URL or parameters
    try:
        path_segments = request.path.split('/')
        job_id = path_segments[-1] if path_segments[-1] and path_segments[-1] != 'get-summarization-job-result' else request.args.get('job_id')
        if not job_id:
            return jsonify({"status": "error", "message": "Job ID is required"}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": f"Error extracting Job ID: {e}"}), 400


    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}), 503

    vss_api_url = f"{vss_api_base_url}/summarize/{job_id}/result"
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status()
        vss_data = vss_api_response.json()
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to get summarization job result for {job_id}: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to get summarization job result for {job_id}: {e}"}), 500
