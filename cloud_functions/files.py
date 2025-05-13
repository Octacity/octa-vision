import requests
import os
import firebase_admin
from firebase_admin import credentials, auth
from flask import Flask, request, jsonify

# Initialize Firebase Admin SDK (needed if this file could be an entry point,
# but in this case, it's initialized in main.py)
# try:
#     firebase_admin.get_app()
# except ValueError:
#     cred = credentials.ApplicationDefault()
#     firebase_admin.initialize_app(cred)

# Assuming 'app' and 'verify_firebase_token' are defined in main.py and imported
from main import app, verify_firebase_token

# Get VSS API Base URL from environment variables
VSS_API_BASE_URL = os.environ.get('VSS_API_BASE_URL')

if not VSS_API_BASE_URL:
    print("Error: VSS_API_BASE_URL environment variable not set.")
    VSS_API_BASE_URL = "http://localhost:5000" # Default for development, replace with a proper error


@app.route('/ingest-file', methods=['POST'])
def ingest_file():
    """
    Cloud function to ingest a file by uploading it to the VSS API.
    Requires Firebase authentication.
    """
    # Verify Firebase authentication
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    # Get file and other data from the request
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "No file part in the request"}), 400

    file = request.files['file']
    filename = request.form.get('filename')
    purpose = request.form.get('purpose')
    media_type = request.form.get('media_type')

    if not filename or not purpose or not media_type:
         return jsonify({"status": "error", "message": "Missing form data: filename, purpose, or media_type"}), 400

    # Prepare data for VSS API
    files = {'file': (filename, file.stream, file.content_type)}
    data = {'filename': filename, 'purpose': purpose, 'media_type': media_type}


    # Call VSS API
    vss_api_url = f"{VSS_API_BASE_URL}/files"
    try:
        vss_api_response = requests.post(vss_api_url, files=files, data=data)
        vss_api_response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)
        vss_data = vss_api_response.json()
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API: {e}"}), 500


@app.route('/list-files', methods=['GET'])
def list_files():
    """
    Cloud function to list files from the VSS API.
    Requires Firebase authentication.
    """
    # Verify Firebase authentication
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    # Call VSS API to list files
    vss_api_url = f"{VSS_API_BASE_URL}/files"
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)
        vss_data = vss_api_response.json()
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to list files: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to list files: {e}"}), 500


@app.route('/get-file-details/<file_id>', methods=['GET'])
def get_file_details(file_id):
    """
    Cloud function to get details of a specific file from the VSS API.
    Requires Firebase authentication.
    """
    # Verify Firebase authentication
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    # Call VSS API to get file details
    vss_api_url = f"{VSS_API_BASE_URL}/files/{file_id}"
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)
        vss_data = vss_api_response.json()
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to get file details for {file_id}: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to get file details for {file_id}: {e}"}), 500


@app.route('/delete-file/<file_id>', methods=['DELETE'])
def delete_file(file_id):
    """
    Cloud function to delete a specific file from the VSS API.
    Requires Firebase authentication.
    """
    # Verify Firebase authentication
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    # Call VSS API to delete the file
    vss_api_url = f"{VSS_API_BASE_URL}/files/{file_id}"
    try:
        vss_api_response = requests.delete(vss_api_url)
        vss_api_response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)
        # VSS API might return a success message or empty body on successful deletion
        try:
            vss_data = vss_api_response.json()
        except requests.exceptions.JSONDecodeError:
            vss_data = {"message": "File deleted successfully"} # Assume success if no JSON body
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to delete file {file_id}: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to delete file {file_id}: {e}"}), 500


# Note: @functions_framework.http decorator is typically used on the main entry point (e.g., main function in main.py)
# and not on individual route handlers within the Flask app.
@app.route('/get-file-content/<file_id>', methods=['GET'])
def get_file_content(file_id):
    """
    Cloud function to get the content of a specific file from the VSS API.
    Requires Firebase authentication.
    """
    # Verify Firebase authentication
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    if not file_id:
        return jsonify({"status": "error", "message": "File ID is required"}), 400

    # Call VSS API to get file content
    vss_api_url = f"{VSS_API_BASE_URL}/files/{file_id}/content"
    try:
        vss_api_response = requests.get(vss_api_url, stream=True) # Use stream=True to handle potentially large files
        vss_api_response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)

        # Return the content directly as a response
        # Note: This direct return of requests.Response might behave differently
        # depending on the Cloud Functions framework version and how the main app
        # dispatches requests. Using Flask's send_file or a custom response
        # might be more robust. For simplicity and direct translation,
        # we'll try returning requests.Response first.
        from flask import Response
        return Response(
            vss_api_response.content,
            status=vss_api_response.status_code,
            headers=dict(vss_api_response.headers) # Copy headers, especially Content-Type
        )

    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to get file content for {file_id}: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to get file content for {file_id}: {e}"}), 500