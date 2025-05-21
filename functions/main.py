
from firebase_functions import https_fn
import firebase_admin
from firebase_admin import credentials, auth, firestore
import time
import os
import requests # Ensure requests is imported if get_default_vss_base_url or verify_firebase_token might need it indirectly (though current impl doesn't directly)

# Initialize Firebase Admin SDK
# This should ideally be done once. The try-except block handles potential re-initialization issues in some environments.
try:
    if not firebase_admin._apps: # Check if already initialized
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
except ValueError: # Fallback for multiple initializations in some environments
    if not firebase_admin._apps:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
    pass # Continue if initialization succeeded elsewhere

db = firestore.client()

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
        # Ensure you have an index on 'isDefault' for this query if the collection grows large
        query_ref = servers_ref.where('isDefault', '==', True).limit(1)
        results = query_ref.stream()

        default_server_data = None
        for server_doc in results:
            default_server_data = server_doc.to_dict()
            break # We only need the first one

        if default_server_data and 'ipAddressWithPort' in default_server_data:
            base_url = default_server_data['ipAddressWithPort']
            # Ensure the URL has a scheme
            if not base_url.startswith(('http://', 'https://')):
                 base_url = f"http://{base_url}" # Assume http if not specified

            VSS_API_BASE_URL_CACHE = base_url
            VSS_API_BASE_URL_CACHE_EXPIRY = current_time + CACHE_TTL_SECONDS
            print(f"Fetched default VSS URL from Firestore: {base_url}")
            return base_url
        else:
            print("Error: No default VSS server found in Firestore or 'ipAddressWithPort' missing.")
            # Fallback to environment variable if Firestore setup is missing or incomplete
            # This part can be removed if Firestore is the sole source of truth and must be configured.
            env_url = os.environ.get('VSS_API_BASE_URL')
            if env_url:
                print(f"Warning: Default VSS server not found in Firestore, using VSS_API_BASE_URL from environment: {env_url}")
                if not env_url.startswith(('http://', 'https://')):
                    env_url = f"http://{env_url}"
                return env_url
            raise ValueError("Default VSS server IP not configured in Firestore and no VSS_API_BASE_URL in env.")
    except Exception as e:
        print(f"Error fetching default VSS server IP from Firestore: {e}")
        # Clear cache on error to force re-fetch next time
        VSS_API_BASE_URL_CACHE = None
        VSS_API_BASE_URL_CACHE_EXPIRY = None
        # Fallback to environment variable on any exception during Firestore fetch
        env_url = os.environ.get('VSS_API_BASE_URL')
        if env_url:
            print(f"Warning: Error fetching from Firestore, using VSS_API_BASE_URL from environment: {env_url}")
            if not env_url.startswith(('http://', 'https://')):
                env_url = f"http://{env_url}"
            return env_url
        raise ValueError(f"Could not retrieve default VSS server IP: {e}")


def verify_firebase_token(req: https_fn.Request):
    """
    Verifies the Firebase ID token provided in the request's Authorization header.
    Accepts a firebase_functions.https_fn.Request object.
    Returns a tuple: (decoded_token, error_message_string_or_None).
    """
    auth_header = req.headers.get('Authorization')
    if not auth_header:
        return None, "Authorization header missing"

    id_token_parts = auth_header.split('Bearer ')
    if len(id_token_parts) < 2 or not id_token_parts[1]:
        return None, "Bearer token not found or malformed in Authorization header"
    
    id_token = id_token_parts[1]

    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token, None
    except auth.InvalidIdTokenError as e:
        print(f"Invalid ID token: {e}")
        return None, f"Invalid ID token: {e}"
    except auth.ExpiredIdTokenError as e:
        print(f"Expired ID token: {e}")
        return None, f"Expired ID token: {e}"
    except auth.RevokedIdTokenError as e:
        print(f"Revoked ID token: {e}")
        return None, f"Revoked ID token: {e}"
    except auth.UserDisabledError as e:
        print(f"User disabled: {e}")
        return None, f"User account has been disabled: {e}"
    except Exception as e: # Catch any other Firebase auth exceptions
        print(f"Token verification failed: {e}")
        return None, f"Token verification failed: {e}"

# Example 2nd gen Cloud Function (can be removed if not needed as an example)
@https_fn.on_request()
def helloworld(req: https_fn.Request) -> https_fn.Response:
    """A simple HelloWorld function for testing deployment."""
    print("HelloWorld function invoked") # Add a log
    # Example of using verify_firebase_token
    # decoded_token, error = verify_firebase_token(req)
    # if error:
    #    return https_fn.Response(f"Authentication Error: {error}", status=401)
    # print(f"Authenticated user: {decoded_token.get('uid')}")
    return https_fn.Response("Hello, OctaVision world from a 2nd gen Cloud Function in main.py!")

# Note: Do NOT add Flask app instantiation (app = Flask(__name__)) here
# if other files like files.py, streams.py are defining their own
# Cloud Functions using functions_framework.http or https_fn.on_request.
# This main.py should primarily provide shared utilities.
