import requests
import os
import firebase_admin
from firebase_admin import credentials, auth # Keep firebase_admin and related imports if needed in any function here
from main import verify_firebase_token, get_default_vss_base_url # Import helper functions from main



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
 return https_fn.Response('{"status": "error", "message": "Authentication failed: ' + str(error) + '"}', status=401, mimetype='application/json')

    # Access files and form data using req.files and req.form
    if 'file' not in req.files:
 return https_fn.Response('{"status": "error", "message": "No file part in the request"}', status=400, mimetype='application/json')

    file = req.files['file']
    # Use req.form for form data
    if not filename or not purpose or not media_type:
        flask_response = jsonify({"status": "error", "message": "Missing form data: filename, purpose, or media_type"})
 return https_fn.Response(flask_response.get_data(), status=400, headers=dict(flask_response.headers))
    
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

 return https_fn.Response('{"status": "success", "data": ' + str(vss_data) + '}', status=200, mimetype='application/json')
 except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API: {e}")
 return https_fn.Response('{"status": "error", "message": "Error calling VSS API: ' + str(e) + '"}', status=500, mimetype='application/json')
@https_fn.on_request() # Use on_request for 2nd gen HTTP functions
def list_files(req: https_fn.Request) -> https_fn.Response:
    decoded_token, error = verify_firebase_token(req)
    if error:
        flask_response = jsonify({"status": "error", "message": f"Authentication failed: {error}"})
 return https_fn.Response(response='{"status": "error", "message": "Authentication failed: ' + str(error) + '"}', status=401, mimetype='application/json')

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")

    vss_api_url = f"{vss_api_base_url}/files"
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status()
        vss_data = vss_api_response.json()
 return https_fn.Response(response=jsonify({"status": "success", "data": vss_data}).get_data(), status=200, mimetype='application/json')
 except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to list files: {e}")
 return https_fn.Response('{"status": "error", "message": "Error calling VSS API to list files: ' + str(e) + '"}', status=500, mimetype='application/json')

@https_fn.on_request() # Use on_request for 2nd gen HTTP functions
def get_file_details(req: https_fn.Request) -> https_fn.Response:
    decoded_token, error = verify_firebase_token(req)
    if error:
        flask_response = jsonify({"status": "error", "message": f"Authentication failed: {error}"})
        return https_fn.Response(flask_response.get_data(), status=401, headers=dict(flask_response.headers))

    # Extract file_id from the request URL or parameters as appropriate
    # In Firebase Functions 2nd gen, URL parameters are typically not automatically parsed like in Flask routes.
    file_id = req.args.get('file_id') # Assuming file_id is passed as a query parameter or accessible via req.url

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        flask_response = jsonify({"status": "error", "message": f"VSS API configuration error: {e}"})
        return https_fn.Response(flask_response.get_data(), status=503, headers=dict(flask_response.headers))

    vss_api_url = f"{vss_api_base_url}/files/{file_id}"
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status()
        vss_data = vss_api_response.json()
 return https_fn.Response(response=jsonify({"status": "success", "data": vss_data}).get_data(), status=200, mimetype='application/json')
 except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to get file details for {file_id}: {e}")
 return https_fn.Response('{"status": "error", "message": "Error calling VSS API to get file details for ' + str(file_id) + ': ' + str(e) + '"}', status=500, mimetype='application/json')

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
        flask_response = jsonify({"status": "error", "message": f"VSS API configuration error: {e}"})
        return https_fn.Response(flask_response.get_data(), status=503, headers=dict(flask_response.headers))

    vss_api_url = f"{vss_api_base_url}/files/{file_id}"
    try:
        vss_api_response = requests.delete(vss_api_url)
        vss_api_response.raise_for_status()
        try:
            vss_data = vss_api_response.json()
        except requests.exceptions.JSONDecodeError:
            vss_data = {"message": "File deleted successfully"}
 return https_fn.Response(response=jsonify({"status": "success", "data": vss_data}).get_data(), status=200, mimetype='application/json')
 except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to delete file {file_id}: {e}")
 return https_fn.Response('{"status": "error", "message": "Error calling VSS API to delete file ' + str(file_id) + ': ' + str(e) + '"}', status=500, mimetype='application/json')

    decoded_token, error = verify_firebase_token(req)
    if error:
 return https_fn.Response('{"status": "error", "message": "Authentication failed: ' + str(error) + '"}', status=401, mimetype='application/json')

    # Extract file_id from the request URL or parameters as appropriate
    file_id = req.args.get('file_id') # Assuming file_id is passed as a query parameter
    if not file_id:
        return https_fn.Response(response=jsonify({"status": "error", "message": "File ID is required"}).get_data(), status=400, mimetype='application/json')

    # This try block is misplaced. It should be around the VSS API call.
    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        flask_response = jsonify({"status": "error", "message": f"VSS API configuration error: {e}"})
        return https_fn.Response(flask_response.get_data(), status=503, headers=dict(flask_response.headers))

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
    # This except block is misplaced. It should be around the VSS API call.
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to get file content for {file_id}: {e}")