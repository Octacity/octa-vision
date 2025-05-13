# cloud_functions/summarization.py

import requests
import os
from firebase_admin import auth
from flask import Flask, request, jsonify

# Get VSS API Base URL from environment variables
VSS_API_BASE_URL = os.environ.get('VSS_API_BASE_URL')

if not VSS_API_BASE_URL:
    print("Error: VSS_API_BASE_URL environment variable not set.")
    # You might want to raise an exception or handle this differently in production
    VSS_API_BASE_URL = "http://localhost:5000" # Default for development, replace with a proper error

# Assuming verify_firebase_token is defined in main.py and will be imported
# from .main import verify_firebase_token # Uncomment and adjust import path if necessary

# Define a dummy verify_firebase_token for standalone testing or if not importing from main
def verify_firebase_token(req):
    """Verifies the Firebase ID token provided in the request."""
    auth_header = req.headers.get('Authorization')
    if not auth_header:
        return None, "Authorization header missing"

    token = auth_header.split(' ').pop()
    if not token:
        return None, "Token not found"

    # In a real scenario, replace with actual Firebase Admin SDK verification
    try:
        # This is a placeholder. Replace with:
        # decoded_token = auth.verify_id_token(token)
        decoded_token = {"uid": "test_user"} # Dummy decoded token
        return decoded_token, None
    except Exception as e:
        return None, str(e)


# Create a Flask blueprint or a Flask app instance if not using a central app in main.py
# For simplicity and consistency with the likely main.py structure,
# we assume an 'app' Flask instance is available when these routes are registered.
# If using blueprints, you'd define one here:
# summarization_bp = Blueprint('summarization', __name__)

# If using a central app instance defined in main.py, use it directly or pass it
# For now, let's assume 'app' is imported or accessible (common in smaller Flask apps)
# from main import app # Uncomment if 'app' is defined and exported in main.py
app = Flask(__name__) # Dummy app instance for syntax checking and potential standalone use

@app.route('/summarize-content', methods=['POST'])
def summarize_content():
    """
    Cloud function to summarize content using the VSS API.
    Requires Firebase authentication.
    """
    # Verify Firebase authentication
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    # Get data from the request body
    request_data = request.get_json()
    if not request_data or 'id' not in request_data or 'prompt' not in request_data or 'model' not in request_data:
        return jsonify({"status": "error", "message": "Missing required fields (id, prompt, or model) in request body"}), 400

    # Call VSS API to summarize content
    vss_api_url = f"{VSS_API_BASE_URL}/summarize"
    try:
        vss_api_response = requests.post(vss_api_url, json=request_data)
        vss_api_response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)
        vss_data = vss_api_response.json()

        return jsonify({"status": "success", "data": vss_data}), 200

    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to summarize content: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to summarize content: {e}"}), 500

# If using blueprints, you'd register it in main.py like:
# app.register_blueprint(summarization_bp)