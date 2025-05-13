import functions_framework
import requests
import os
import firebase_admin
from firebase_admin import credentials, auth
from flask import Flask, request, jsonify

# Import routes from separate files
from .files import files_bp
from .streams import streams_bp
from .models import models_bp
from .health import health_bp
from .metrics import metrics_bp
from .config import config_bp

from .summarization import summarization_bp

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
    print("Error: VSS_API_BASE_URL environment variable not set.")
    # You might want to raise an exception or handle this differently in production
    VSS_API_BASE_URL = "http://localhost:5000" # Default for development, replace with a proper error


def verify_firebase_token(req):
    """Verifies the Firebase ID token provided in the request."""
    auth_header = req.headers.get('Authorization')
    if not auth_header:
        return None, "Authorization header missing"

    token = auth_header.split(' ').pop()
    if not token:
        return None, "Token not found"

    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token, None
    except Exception as e:
        return None, str(e)


# Register blueprints from separate files
app.register_blueprint(files_bp)
app.register_blueprint(streams_bp)
app.register_blueprint(models_bp)
app.register_blueprint(health_bp)
app.register_blueprint(summarization_bp)
app.register_blueprint(metrics_bp)
app.register_blueprint(config_bp)





@functions_framework.http
def main(request):
    """Entry point for the cloud function."""
    with app.request_context(request.environ):
        return app.full_dispatch_request()