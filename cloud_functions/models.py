# cloud_functions/models.py

import requests
import os
from firebase_admin import auth # Import auth specifically if needed directly
from flask import Flask, request, jsonify

# Assuming app and verify_firebase_token are defined in main.py and imported
# from .main import app, verify_firebase_token
# Note: This relative import assumes models.py is in a package with main.py.
# For a simple cloud function structure, you might pass app to a function
# in this file or define app in main.py and import routes differently.
# Let's assume for now we can import app and verify_firebase_token.
# In a real cloud function deployment structure, you might initialize app
# in main.py and then register blueprints from these files.

# For demonstration purposes, let's assume app and verify_firebase_token are accessible
# If not, you would need to adjust the import or structure.

# Placeholder for app and verify_firebase_token if not imported directly
# from main import app, verify_firebase_token

# --- Placeholder if direct import is not feasible in your structure ---
# You would typically initialize your Flask app in main.py and then
# import and register blueprints or routes from other files.
# For this response, I will define a placeholder app and verify_firebase_token
# assuming they would be provided or imported in a real scenario.
# In a production cloud function, 'app' would likely be the Flask app instance
# created in your entry point file (main.py).
class MockFlask:
    def route(self, rule, **options):
        def decorator(f):
            # In a real Flask app, this decorator would register the route.
            # For this example, we just return the function.
            # print(f"Registered route: {rule} with options {options}")
            return f
        return decorator

# Replace with actual import from main.py
app = MockFlask() # This is a placeholder. Use the actual app instance.

def verify_firebase_token(req):
    # This is a placeholder. Use the actual verify_firebase_token from main.py.
    print("Placeholder verify_firebase_token called.")
    # In a real scenario, this would verify the token and return decoded_token, error
    # For example:
    # auth_header = req.headers.get('Authorization')
    # if not auth_header:
    #     return None, "Authorization header missing"
    # token = auth_header.split(' ').pop()
    # try:
    #     decoded_token = auth.verify_id_token(token)
    #     return decoded_token, None
    # except Exception as e:
    #     return None, str(e)
    # Assuming token verification passes for this placeholder
    return {"uid": "test_user"}, None
# --- End Placeholder ---


# Get VSS API Base URL from environment variables
VSS_API_BASE_URL = os.environ.get('VSS_API_BASE_URL', 'http://localhost:5000') # Default for development


@app.route('/list-models', methods=['GET'])
def list_models():
    """
    Cloud function to list models from the VSS API.
    Requires Firebase authentication.
    """
    # Verify Firebase authentication
    decoded_token, error = verify_firebase_token(request)
    if error:
        return jsonify({"status": "error", "message": f"Authentication failed: {error}"}), 401

    # Call VSS API to list models
    vss_api_url = f"{VSS_API_BASE_URL}/models" # Assuming /models is the endpoint
    try:
        vss_api_response = requests.get(vss_api_url)
        vss_api_response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)
        vss_data = vss_api_response.json()
        return jsonify({"status": "success", "data": vss_data}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling VSS API to list models: {e}")
        return jsonify({"status": "error", "message": f"Error calling VSS API to list models: {e}"}), 500

# In a real application structure, you would import this route
# or a blueprint containing this route in your main file.
# Example of how you might register this route in main.py:
# from cloud_functions.models import list_models
# app.add_url_rule('/list-models', view_func=list_models, methods=['GET'])