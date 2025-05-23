import requests
import os

from firebase_functions import https_fn
from firebase_functions.https_fn import Request, Response
from flask import jsonify, request
# Import helper functions from main
from main import verify_firebase_token, get_default_vss_base_url

@https_fn.on_request()
def create_summarization_job(req: Request) -> Response:
    """
    Cloud function to create a summarization job in the VSS API.
    Requires Firebase authentication.
    """
    decoded_token, error = verify_firebase_token(req)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    try:
        request_data = req.get_json(silent=True)
        file_ids = request_data.get('file_ids')
        model_id = request_data.get('model_id')
        output_format = request_data.get('output_format', 'text') # Default to text

        if not file_ids or not isinstance(file_ids, list) or not model_id:
            return https_fn.Response(jsonify({"status": "error", "message": "file_ids (list) and model_id are required"}).get_data(as_text=True), status=400, mimetype='application/json')

    except Exception as e:
        return jsonify({"status": "error", "message": f"Invalid JSON input: {e}"}), 400

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}), 503
    
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
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to create summarization job: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to create summarization job: {e}"}), 500
    
@https_fn.on_request()
def get_summarization_job_status(req: Request) -> Response:
    """
    Cloud function to get the status of a summarization job from the VSS API.
    Requires Firebase authentication.
    """

    decoded_token, error = verify_firebase_token(req)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401
    
    # Extract job_id from the request URL or parameters
    try:
        job_id = req.args.get('job_id')
        if not job_id:
            return jsonify({"status": "error", "message": "Job ID is required"}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": f"Error extracting Job ID: {e}"}), 400


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
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to get summarization job status for {job_id}: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to get summarization job status for {job_id}: {e}"}), 500
    
@https_fn.on_request()
def get_summarization_job_result(req: Request) -> Response:
    """
    Cloud function to get the result of a completed summarization job from the VSS API.
    Requires Firebase authentication.
    """
    # Extract job_id from the request URL or parameters
    decoded_token, error = verify_firebase_token(req)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    try:
        job_id = req.args.get('job_id')
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
