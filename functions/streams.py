# cloud_functions/streams.py

import requests
import os
from firebase_admin import auth
from flask import Flask, request, jsonify

# Import app from main.py and the new function to get VSS base URL
from .main import app, verify_firebase_token, get_default_vss_base_url


@app.route('/start-stream', methods=['POST'])
def start_stream():
    """
    Cloud function to start a live stream with the VSS API.
    Requires Firebase authentication.
    """
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    request_data = request.get_json()
    if not request_data:
        return jsonify({"status": "error", "message": "No JSON data provided in the request body"}), 400

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}), 503

    vss_api_url = f"{vss_api_base_url}/streams" 
    try:
        vss_api_response = requests.post(vss_api_url, json=request_data)
        vss_api_response.raise_for_status() 
        vss_data = vss_api_response.json()
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to start stream: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to start stream: {e}"}), 500


@app.route('/stop-stream/<stream_id>', methods=['DELETE'])
def stop_stream(stream_id):
    """
    Cloud function to stop a specific live stream with the VSS API.
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

    vss_api_url = f"{vss_api_base_url}/streams/{stream_id}" 
    try:
        vss_api_response = requests.delete(vss_api_url)
        vss_api_response.raise_for_status() 
        try:
            vss_data = vss_api_response.json()
        except requests.exceptions.JSONDecodeError:
            vss_data = {"message": "Stream stopped successfully"} 
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to stop stream {stream_id}: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to stop stream {stream_id}: {e}"}), 500


@app.route('/list-streams', methods=['GET'])
def list_streams():
    """
    Cloud function to list live streams from the VSS API.
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

    vss_api_url = f"{vss_api_base_url}/streams" 
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status() 
        vss_data = vss_api_response.json()
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to list streams: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to list streams: {e}"}), 500


@app.route('/get-stream-details/<stream_id>', methods=['GET'])
def get_stream_details(stream_id):
    """
    Cloud function to get details of a specific stream from the VSS API.
    Requires Firebase authentication.
    """
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    if not stream_id:
        return jsonify({"status": "error", "message": "Stream ID is required"}), 400

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}), 503

    vss_api_url = f"{vss_api_base_url}/streams/{stream_id}"
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status() 
        vss_data = vss_api_response.json()
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to get stream details for {stream_id}: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to get stream details for {stream_id}: {e}"}), 500


@app.route('/get-live-stream-by-id/<stream_id>', methods=['GET'])
def get_live_stream_by_id(stream_id):
    """
    Cloud function to get details of a specific live stream from the VSS API.
    Requires Firebase authentication.
    """
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    if not stream_id:
        return jsonify({"status": "error", "message": "Live stream ID is required"}), 400

    try:
        vss_api_base_url = get_default_vss_base_url()
    except ValueError as e:
        print(f"Configuration Error: {e}")
        return jsonify({"status": "error", "message": f"VSS API configuration error: {e}"}), 503

    vss_api_url = f"{vss_api_base_url}/live-stream/{stream_id}"
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status() 
        vss_data = vss_api_response.json()
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to get live stream details for {stream_id}: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to get live stream details for {stream_id}: {e}"}), 500
