
import functions_framework
import requests
import os
import firebase_admin
from firebase_admin import credentials, auth, firestore
from flask import Flask, request, jsonify
import time

# Initialize Firebase Admin SDK
try:
    if not firebase_admin._apps: # Check if already initialized
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
except ValueError: # Fallback for multiple initializations in some environments
    if not firebase_admin._apps:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
    pass


db = firestore.client()
app = Flask(__name__)

# Cache for the default VSS base URL
VSS_API_BASE_URL_CACHE = None
VSS_API_BASE_URL_CACHE_EXPIRY = None
CACHE_TTL_SECONDS = 300 # 5 minutes

def get_default_vss_base_url():
    """
    Retrieves the ipAddressWithPort of the default VSS server from Firestore.
    Implements a simple time-based cache to reduce Firestore reads.
    Prepends 'http://' if no scheme is present.
    """
    global VSS_API_BASE_URL_CACHE, VSS_API_BASE_URL_CACHE_EXPIRY

    current_time = time.time()
    if VSS_API_BASE_URL_CACHE and VSS_API_BASE_URL_CACHE_EXPIRY and current_time < VSS_API_BASE_URL_CACHE_EXPIRY:
        return VSS_API_BASE_URL_CACHE

    try:
        servers_ref = db.collection('servers')
        query_ref = servers_ref.where('isDefault', '==', True).limit(1) # Changed from query to query_ref
        results = query_ref.stream()
        
        default_server_data = None
        for server_doc in results:
            default_server_data = server_doc.to_dict()
            break

        if default_server_data and 'ipAddressWithPort' in default_server_data:
            base_url = default_server_data['ipAddressWithPort']
            if not base_url.startswith(('http://', 'https://')):
                 base_url = f"http://{base_url}" # Assume http if not specified

            VSS_API_BASE_URL_CACHE = base_url
            VSS_API_BASE_URL_CACHE_EXPIRY = current_time + CACHE_TTL_SECONDS
            print(f"Fetched default VSS URL from Firestore: {base_url}")
            return base_url
        else:
            print("Error: No default VSS server found in Firestore or 'ipAddressWithPort' missing.")
            raise ValueError("Default VSS server IP not configured in Firestore.")
    except Exception as e:
        print(f"Error fetching default VSS server IP from Firestore: {e}")
        # Clear cache on error to force re-fetch next time
        VSS_API_BASE_URL_CACHE = None
        VSS_API_BASE_URL_CACHE_EXPIRY = None
        raise ValueError(f"Could not retrieve default VSS server IP: {e}")


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

# Import route modules AFTER app and helper functions are defined
from . import files
from . import streams
from . import models
from . import health
from . import metrics
from . import config
from . import summarization
from . import snapshots # Added import for snapshots


@functions_framework.http
def main(request_obj): # Renamed 'request' to 'request_obj' to avoid conflict with flask.request
    """Entry point for the cloud function."""
    with app.request_context(request_obj.environ):
        # flask.request is now available due to app.request_context
        return app.full_dispatch_request()

