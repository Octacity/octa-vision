# cloud_functions/streams.py

import requests
import os
from firebase_admin import auth
from flask import Flask, request, jsonify

# Import necessary components from main
from main import verify_firebase_token, get_default_vss_base_url
from firebase_functions import https_fn


@https_fn.on_request()
def start_stream(request):
    """
    Cloud function to start a live stream with the VSS API.
    Requires Firebase authentication.
    """
    if request.method != 'POST':
        return jsonify({"status": "error", "message": "Method Not Allowed"}), 405

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


@https_fn.on_request()
def stop_stream(request):
    """
    Cloud function to stop a specific live stream with the VSS API.
    Requires Firebase authentication.
    """
    if request.method != 'DELETE':
        return jsonify({"status": "error", "message": "Method Not Allowed"}), 405

    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    # Extract stream_id from the request path
    path_parts = request.path.split('/')
    if len(path_parts) < 3:
         return jsonify({"status": "error", "message": "Stream ID is required in the path"}), 400
    stream_id = path_parts[-1]

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


@https_fn.on_request()
def list_streams(request):
    """
    Cloud function to list live streams from the VSS API.
    Requires Firebase authentication.
    """
    if request.method != 'GET':
        return jsonify({"status": "error", "message": "Method Not Allowed"}), 405

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


@https_fn.on_request()
def get_stream_details(request):
    """
    Cloud function to get details of a specific stream from the VSS API.
    Requires Firebase authentication.
    """
    if request.method != 'GET':
        return jsonify({"status": "error", "message": "Method Not Allowed"}), 405

    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    # Extract stream_id from the request path
    path_parts = request.path.split('/')
    if len(path_parts) < 3:
        return jsonify({"status": "error", "message": "Stream ID is required in the path"}), 400
    stream_id = path_parts[-1]

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


@https_fn.on_request()
def get_live_stream_by_id(request):
    """
    Cloud function to get details of a specific live stream from the VSS API.
    Requires Firebase authentication.
    """
    if request.method != 'GET':
        return jsonify({"status": "error", "message": "Method Not Allowed"}), 405

    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    # Extract stream_id from the request path
    path_parts = request.path.split('/')
    if len(path_parts) < 3:
        return jsonify({"status": "error", "message": "Live stream ID is required in the path"}), 400
    stream_id = path_parts[-1]

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