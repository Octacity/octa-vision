import requests
import os
import firebase_admin
from firebase_admin import credentials
from main import verify_firebase_token, get_default_vss_base_url
from firebase_functions import https_fn



# SERVICE_ACCOUNT_EMAIL is typically set during deployment configuration
# and not directly used in the decorator in 2nd gen functions.
# Keep this if it's used within the function logic, but remove from decorator.
SERVICE_ACCOUNT_EMAIL = os.environ.get("SERVICE_ACCOUNT_EMAIL")

# Initialize Firebase Admin SDK - Keep this as is or move to global scope if preferred
try:
    if not firebase_admin._apps: # Check if already initialized
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
except ValueError: # Fallback for multiple initializations in some environments
    if not firebase_admin._apps: # Check if already initialized again in fallback
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
    pass # Continue if initialization succeeded elsewhere


from flask import jsonify, request # Import request from flask to access form data
@https_fn.on_request(timeout_sec=540) # Increase timeout for potentially long ingest operations
def ingest_file(req: https_fn.Request) -> https_fn.Response: # Explicit type hints
    """
        Cloud function to ingest a file by uploading it to the VSS API.
        Requires Firebase authentication.
        Refactored for Firebase Functions 2nd gen.
    """
    # Use the verify_firebase_token helper function which should now accept https_fn.Request
    decoded_token, error = verify_firebase_token(req)
    if error:
        return https_fn.Response(jsonify({"status": "error", "message": f"Authentication failed: {error}"}).get_data(as_text=True), status=401, mimetype='application/json')

    # Access files and form data using req.files and req.form
    if 'file' not in req.files:
        return https_fn.Response(jsonify({"status": "error", "message": "No file part in the request"}).get_data(as_text=True), status=400, mimetype='application/json')

    request_data = req.form
    file = req.files['file']
    # Use req.form for form data
    filename = request_data.get('filename')
    purpose = request_data.get('purpose')
    media_type = request_data.get('media_type')
    if not filename or not purpose or not media_type:
        return https_fn.Response(jsonify({"status": "error", "message": "Missing form data: filename, purpose, or media_type"}).get_data(as_text=True), status=400, mimetype='application/json')

    try:
        vss_api_base_url = get_default_vss_base_url() # Assuming this returns a string URL
    except ValueError as e:
        print(f"Configuration Error: {e}")
        flask_response = jsonify({"status": "error", "message": f"VSS API configuration error: {e}"})
        return https_fn.Response(flask_response.get_data(), status=503, headers=dict(flask_response.headers))

    # req.files['file'] provides a FileStorage object similar to Flask
    files_payload = {'file': (filename, file.stream, file.content_type)}
    data_payload = {'filename': filename, 'purpose': purpose, 'media_type': media_type}

    vss_api_url = f"{vss_api_base_url}/files"
    try:
        vss_api_response = requests.post(vss_api_url, files=files_payload, data=data_payload)
        vss_api_response.raise_for_status()
        vss_data = vss_api_response.json()
        return https_fn.Response(jsonify({"status": "success", "data": vss_data}).get_data(as_text=True), status=200, mimetype='application/json')
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API: {e}")
        return https_fn.Response(jsonify({"status": "error", "message": f"Error calling VSS API: {e}"}).get_data(as_text=True), status=500, mimetype='application/json')

@https_fn.on_request() # Use on_request for 2nd gen HTTP functions
def list_files(req: https_fn.Request) -> https_fn.Response:
    decoded_token, error = verify_firebase_token(req)
    if error:
        return https_fn.Response(jsonify({"status": "error", "message": f"Authentication failed: {error}"}).get_data(), status=401, mimetype='application/json')

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return https_fn.Response(jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}).get_data(as_text=True), status=503, mimetype='application/json')

    vss_api_url = f"{vss_api_base_url}/files"
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status()
        vss_data = vss_api_response.json()
        return https_fn.Response(jsonify({"status": "success", "data": vss_data}).get_data(as_text=True), status=200, mimetype='application/json')
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to list files: {e}")
        return https_fn.Response(jsonify({"status": "error", "message": f"Error calling VSS API to list files: {e}"}).get_data(as_text=True), status=500, mimetype='application/json')

@https_fn.on_request() # Use on_request for 2nd gen HTTP functions
def get_file_details(req: https_fn.Request) -> https_fn.Response:
    decoded_token, error = verify_firebase_token(req)
    if error:
        return https_fn.Response(jsonify({"status": "error", "message": f"Authentication failed: {error}"}).get_data(), status=401, mimetype='application/json')

    # Extract file_id from the request URL or parameters as appropriate
    # In Firebase Functions 2nd gen, URL parameters are typically not automatically parsed like in Flask routes.
    file_id = req.args.get('file_id') # Assuming file_id is passed as a query parameter or accessible via req.url

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}") # Keep this print for logging
        return https_fn.Response(jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}).get_data(as_text=True), status=503, mimetype='application/json')

    vss_api_url = f"{vss_api_base_url}/files/{file_id}"
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status()
        vss_data = vss_api_response.json()
        return https_fn.Response(jsonify({"status": "success", "data": vss_data}).get_data(as_text=True), status=200, mimetype='application/json')
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to get file details for {file_id}: {e}")
        return https_fn.Response(jsonify({"status": "error", "message": f"Error calling VSS API to get file details for {file_id}: {e}"}).get_data(as_text=True), status=500, mimetype='application/json')

@https_fn.on_request()
def delete_file(req: https_fn.Request) -> https_fn.Response:
    decoded_token, error = verify_firebase_token(req)
    if error:
        flask_response = jsonify({"status": "error", "message": f"Authentication failed: {error}"})
        return https_fn.Response(flask_response.get_data(), status=401, headers=dict(flask_response.headers))

    # Extract file_id from the request URL or parameters as appropriate
    file_id = req.args.get('file_id') # Use req.args to get query parameters

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return https_fn.Response(jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}).get_data(as_text=True), status=503, mimetype='application/json')
    
    vss_api_url = f"{vss_api_base_url}/files/{file_id}"
    try:
        vss_api_response = requests.delete(vss_api_url)
        vss_api_response.raise_for_status()
        try:
            vss_data = vss_api_response.json()
        except requests.exceptions.JSONDecodeError:
            vss_data = {"message": "File deleted successfully"}
        return https_fn.Response(jsonify({"status": "success", "data": vss_data}).get_data(as_text=True), status=200, mimetype='application/json')
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to delete file {file_id}: {e}")
        return https_fn.Response(jsonify({"status": "error", "message": f"Error calling VSS API to delete file {file_id}: {e}"}).get_data(as_text=True), status=500, mimetype='application/json')

@https_fn.on_request()
def get_file_content(req: https_fn.Request) -> https_fn.Response:
    decoded_token, error = verify_firebase_token(req)
    if error:
        return https_fn.Response(jsonify({"status": "error", "message": f"Authentication failed: {error}"}).get_data(as_text=True), status=401, mimetype='application/json')
    
    # Extract file_id from the request URL or parameters as appropriate
    file_id = req.args.get('file_id') # Assuming file_id is passed as a query parameter
    if not file_id:
        return https_fn.Response(jsonify({"status": "error", "message": "File ID is required"}).get_data(as_text=True), status=400, mimetype='application/json')

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        flask_response = jsonify({"status": "error", "message": f"VSS API configuration error: {e}"})
        return https_fn.Response(jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}).get_data(as_text=True), status=503, mimetype='application/json')
    
    vss_api_url = f"{vss_api_base_url}/files/{file_id}/content"
    try:
        vss_api_response = requests.get(vss_api_url, stream=True)
        vss_api_response.raise_for_status()

        # Use https_fn.Response for returning the file content
        return https_fn.Response(
            vss_api_response.content,
            status=vss_api_response.status_code,
            headers=dict(vss_api_response.headers)
        )
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to get file content for {file_id}: {e}")
        return https_fn.Response(jsonify({"status": "error", "message": f"Error calling VSS API to get file content for {file_id}: {e}"}).get_data(as_text=True), status=500, mimetype='application/json')