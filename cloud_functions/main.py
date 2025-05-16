import functions_framework
import requests
import os
import firebase_admin
from firebase_admin import credentials, auth
from flask import Flask, request, jsonify

# Import routes from separate files
# Ensure these imports are correct based on your file structure.
# If files.py, streams.py, etc., are in the same directory as main.py,
# the imports like `from .files import ...` should work.
# However, the original code had `from .files import files_bp` which implies blueprints.
# For simplicity, let's assume direct import or that blueprints are correctly set up in those files.

# If you are using Blueprints as implied by `files_bp`, etc., make sure those
# files define and export the blueprints. Example in files.py:
# files_bp = Blueprint('files', __name__)
# @files_bp.route('/ingest-file', methods=['POST'])
# def ingest_file_route(): ...
# Then, in main.py, you register them: app.register_blueprint(files_bp)

# For now, let's assume the existing structure aims to import and register routes.
# The provided snippets for files.py etc. directly use `@app.route`.
# This means `app` needs to be defined before those files are imported if they are to use it.

# Initialize Firebase Admin SDK
try:
    firebase_admin.get_app()
except ValueError:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred)


app = Flask(__name__)

# Get VSS API Base URL from environment variables
VSS_API_BASE_URL = os.environ.get('VSS_API_BASE_URL')

if not VSS_API_BASE_URL:
    print("Error: VSS_API_BASE_URL environment variable not set. Using default http://localhost:5000")
    # You might want to raise an exception or handle this differently in production
    VSS_API_BASE_URL = "http://localhost:5000" # Default for development


def verify_firebase_token(req):
    """Verifies the Firebase ID token provided in the request."""
    auth_header = req.headers.get('Authorization')
    if not auth_header:
        return None, "Authorization header missing"

    id_token = auth_header.split('Bearer ').pop()
    if not id_token:
        return None, "Token not found in Authorization header"

    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token, None
    except Exception as e:
        return None, str(e)

# Import route modules AFTER app and VSS_API_BASE_URL are defined,
# so they can use `app.route` decorator and access VSS_API_BASE_URL.
# This is crucial if those modules directly define routes on `app`.
from . import files  # Assuming files.py contains routes using 'app'
from . import streams
from . import models
from . import health
from . import metrics
from . import config
from . import summarization


@functions_framework.http
def main(request):
    """Entry point for the cloud function."""
    # Flask's app.run() is not used in Cloud Functions.
    # Instead, the functions_framework handles invoking the app.
    # The app instance itself needs to be the callable.
    with app.request_context(request.environ):
        return app.full_dispatch_request()

# Note: If you were using Blueprints, the registration would look like:
# from .files import files_bp # Assuming files_bp is a Blueprint object
# app.register_blueprint(files_bp)
# And so on for other blueprints.
# The current structure with direct @app.route in other files means those
# files effectively extend the `app` object defined here.
