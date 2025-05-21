import requests
import os
# Keep firebase_admin and related imports if needed
import firebase_admin
from firebase_admin import credentials, auth

from flask import jsonify
# Import helper functions from main
from main import verify_firebase_token, get_default_vss_base_url
SERVICE_ACCOUNT_EMAIL = os.environ.get("SERVICE_ACCOUNT_EMAIL")
from firebase_functions import https_fn

@https_fn.on_request()
def create_stream(req: https_fn.Request) -> https_fn.Response:
    """
    Cloud function to create a new stream in the VSS API.
    Requires Firebase authentication.
    """
    decoded_token, error = verify_firebase_token(req)
    if error:
        return https_fn.Response(jsonify({"status": "error", "message": f"Authentication failed: {error}"}).get_data(as_text=True), status=401, mimetype='application/json')

    try:
        request_data = req.get_json()
        name = request_data.get('name')
        description = request_data.get('description')

        if not name:
            return https_fn.Response(jsonify({"status": "error", "message": "Stream name is required"}).get_data(as_text=True), status=400, mimetype='application/json')

    except Exception as e:
        return https_fn.Response(jsonify({"status": "error", "message": f"Invalid JSON input: {e}"}).get_data(as_text=True), status=400, mimetype='application/json')

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return https_fn.Response(jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}).get_data(as_text=True), status=503, mimetype='application/json')
    vss_api_url = f"{vss_api_base_url}/streams"
    payload = {'name': name, 'description': description}

    try:
        vss_api_response = requests.post(vss_api_url, json=payload)
        vss_api_response.raise_for_status()
        vss_data = vss_api_response.json()
        return https_fn.Response(jsonify({"status": "success", "data": vss_data}).get_data(as_text=True), status=200, mimetype='application/json')
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to create stream: {e}")
        return https_fn.Response(jsonify({"status": "error", "message": f"Error calling VSS API to create stream: {e}"}).get_data(as_text=True), status=500, mimetype='application/json')

@https_fn.on_request()
def list_streams(req: https_fn.Request) -> https_fn.Response:
    """
    Cloud function to list streams from the VSS API.
    Requires Firebase authentication.
    """
    decoded_token, error = verify_firebase_token(req)
    if error:
        return https_fn.Response(jsonify({"status": "error", "message": f"Authentication failed: {error}"}).get_data(as_text=True), status=401, mimetype='application/json')
    
    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}), 503

    vss_api_url = f"{vss_api_base_url}/streams"
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status()
        vss_data = vss_api_response.json()
        return https_fn.Response(jsonify({"status": "success", "data": vss_data}).get_data(as_text=True), status=200, mimetype='application/json')
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to list streams: {e}")
        return https_fn.Response(jsonify({"status": "error", "message": f"Error calling VSS API to list streams: {e}"}).get_data(as_text=True), status=500, mimetype='application/json')
@https_fn.on_request()
def get_stream_details(req: https_fn.Request) -> https_fn.Response:
    """
    Cloud function to get details of a specific stream from the VSS API.
    Requires Firebase authentication.
    """
    decoded_token, error = verify_firebase_token(req)
    if error:
        return https_fn.Response(jsonify({"status": "error", "message": f"Authentication failed: {error}"}).get_data(as_text=True), status=401, mimetype='application/json')
    
    # Extract stream_id from the request URL or parameters
    try:
        path_segments = req.path.split('/')
        stream_id = path_segments[-1] if path_segments[-1] and path_segments[-1] != 'get-stream-details' else req.args.get('stream_id')
        if not stream_id:
            return https_fn.Response(jsonify({"status": "error", "message": "Stream ID is required"}).get_data(as_text=True), status=400, mimetype='application/json')
    except Exception as e:
        return https_fn.Response(jsonify({"status": "error", "message": f"Error extracting stream ID: {e}"}).get_data(as_text=True), status=400, mimetype='application/json')

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return https_fn.Response(jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}).get_data(as_text=True), status=503, mimetype='application/json')

    vss_api_url = f"{vss_api_base_url}/streams/{stream_id}"
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status()
        vss_data = vss_api_response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to get stream details for {stream_id}: {e}")
        return https_fn.Response(jsonify({"status": "error", "message": f"Error calling VSS API to get stream details for {stream_id}: {e}"}).get_data(as_text=True), status=500, mimetype='application/json')
@https_fn.on_request()
def delete_stream(req: https_fn.Request) -> https_fn.Response:
    """
    Cloud function to delete a stream in the VSS API.
    Requires Firebase authentication.
    """
    decoded_token, error = verify_firebase_token(req)
    if error:
        return https_fn.Response(jsonify({"status": "error", "message": f"Authentication failed: {error}"}).get_data(as_text=True), status=401, mimetype='application/json')

    # Extract stream_id from the request URL or parameters
    try:
        path_segments = req.path.split('/')
        stream_id = path_segments[-1] if path_segments[-1] and path_segments[-1] != 'delete-stream' else req.args.get('stream_id')
        if not stream_id:
            return https_fn.Response(jsonify({"status": "error", "message": "Stream ID is required"}).get_data(as_text=True), status=400, mimetype='application/json')

    except Exception as e:
        return https_fn.Response(jsonify({"status": "error", "message": f"Error extracting stream ID: {e}"}).get_data(as_text=True), status=400, mimetype='application/json')

    try:

        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}), 503

    vss_api_url = f"{vss_api_base_url}/streams/{stream_id}"
    try:
        vss_api_response = requests.delete(vss_api_url)
        vss_api_response.raise_for_status()
        try:
            vss_data = vss_api_response.json()
        except requests.exceptions.JSONDecodeError:
            vss_data = {"message": "Stream deleted successfully"}

        return https_fn.Response(jsonify({"status": "success", "data": vss_data}).get_data(as_text=True), status=200, mimetype='application/json')
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to delete stream {stream_id}: {e}")
        return https_fn.Response(jsonify({"status": "error", "message": f"Error calling VSS API to delete stream {stream_id}: {e}"}).get_data(as_text=True), status=500, mimetype='application/json')
