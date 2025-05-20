import requests
import os
import firebase_admin
from firebase_admin import credentials, auth
from flask import Flask, request, jsonify

from .main import app, verify_firebase_token, get_default_vss_base_url


@app.route('/ingest-file', methods=['POST'])
def ingest_file():
    """
    Cloud function to ingest a file by uploading it to the VSS API.
    Requires Firebase authentication.
    """
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "No file part in the request"}), 400

    file = request.files['file']
    filename = request.form.get('filename')
    purpose = request.form.get('purpose')
    media_type = request.form.get('media_type')

    if not filename or not purpose or not media_type:
         return jsonify({"status": "error", "message": "Missing form data: filename, purpose, or media_type"}), 400

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}), 503

    files_payload = {'file': (filename, file.stream, file.content_type)}
    data_payload = {'filename': filename, 'purpose': purpose, 'media_type': media_type}

    vss_api_url = f"{vss_api_base_url}/files"
    try:
        vss_api_response = requests.post(vss_api_url, files=files_payload, data=data_payload)
        vss_api_response.raise_for_status() 
        vss_data = vss_api_response.json()
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API: {e}"}), 500


@app.route('/list-files', methods=['GET'])
def list_files():
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}), 503
    
    vss_api_url = f"{vss_api_base_url}/files"
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status() 
        vss_data = vss_api_response.json()
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to list files: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to list files: {e}"}), 500


@app.route('/get-file-details/<file_id>', methods=['GET'])
def get_file_details(file_id):
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}), 503

    vss_api_url = f"{vss_api_base_url}/files/{file_id}"
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status() 
        vss_data = vss_api_response.json()
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to get file details for {file_id}: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to get file details for {file_id}: {e}"}), 500


@app.route('/delete-file/<file_id>', methods=['DELETE'])
def delete_file(file_id):
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}), 503
        
    vss_api_url = f"{vss_api_base_url}/files/{file_id}"
    try:
        vss_api_response = requests.delete(vss_api_url)
        vss_api_response.raise_for_status() 
        try:
            vss_data = vss_api_response.json()
        except requests.exceptions.JSONDecodeError:
            vss_data = {"message": "File deleted successfully"} 
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to delete file {file_id}: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to delete file {file_id}: {e}"}), 500


@app.route('/get-file-content/<file_id>', methods=['GET'])
def get_file_content(file_id):
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    if not file_id:
        return jsonify({"status": "error", "message": "File ID is required"}), 400

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}), 503

    vss_api_url = f"{vss_api_base_url}/files/{file_id}/content"
    try:
        vss_api_response = requests.get(vss_api_url, stream=True) 
        vss_api_response.raise_for_status() 

        from flask import Response
        return Response(
            vss_api_response.content,
            status=vss_api_response.status_code,
            headers=dict(vss_api_response.headers) 
        )
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to get file content for {file_id}: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to get file content for {file_id}: {e}"}), 500
