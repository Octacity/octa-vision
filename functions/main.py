
from firebase_functions import https_fn, options
import firebase_admin
from auth_helper import verify_firebase_token
from firebase_admin import credentials, auth, firestore
from suggest_apis import suggest_scene_description, suggest_detection_targets, suggest_alert_events
import os
import time # Import time for time.time()

# Initialize Firebase Admin SDK (only once)
try:
    if not firebase_admin._apps:
        # For local development, GOOGLE_APPLICATION_CREDENTIALS can be set in functions/.env
        # When deployed to Cloud Functions, it uses Application Default Credentials.
        cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_path:
            print(f"MAIN.PY: Initializing Firebase Admin SDK with explicit credentials from: {cred_path}")
            cred = credentials.Certificate(cred_path)
        else:
            print("MAIN.PY: Initializing Firebase Admin SDK with Application Default Credentials.")
            cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
except ValueError:
    print("MAIN.PY: Firebase Admin SDK already initialized or error during initialization.")
    pass


VSS_API_BASE_URL_CACHE = None
VSS_API_BASE_URL_CACHE_EXPIRY = None
CACHE_TTL_SECONDS = 300

def get_firestore_client():
    """Returns a Firestore client instance. Assumes Firebase app is initialized."""
    return firestore.client()

def get_default_vss_base_url():
    global VSS_API_BASE_URL_CACHE, VSS_API_BASE_URL_CACHE_EXPIRY
    current_time = time.time()

    if VSS_API_BASE_URL_CACHE and VSS_API_BASE_URL_CACHE_EXPIRY and current_time < VSS_API_BASE_URL_CACHE_EXPIRY:
        return VSS_API_BASE_URL_CACHE

    try:
        db = get_firestore_client() 
        servers_ref = db.collection('servers')
        query_ref = servers_ref.where('isSystemDefault', '==', True).limit(1)
        results = query_ref.stream()

        default_server_data = None
        for server_doc in results:
            default_server_data = server_doc.to_dict()
            break

        if default_server_data and 'ipAddressWithPort' in default_server_data and 'protocol' in default_server_data:
            protocol = default_server_data['protocol']
            ip_with_port = default_server_data['ipAddressWithPort']
            base_url = f"{protocol}://{ip_with_port}"

            VSS_API_BASE_URL_CACHE = base_url
            VSS_API_BASE_URL_CACHE_EXPIRY = current_time + CACHE_TTL_SECONDS
            print(f"MAIN.PY: Fetched system default VSS URL from Firestore: {base_url}")
            return base_url
        else:
            print("MAIN.PY: Error: No system default VSS server found in Firestore or key fields missing.")
            env_url = os.environ.get('VSS_API_BASE_URL') 
            if env_url:
                print(f"MAIN.PY: Warning: System default VSS server not found/incomplete in Firestore, using VSS_API_BASE_URL from environment: {env_url}")
                if not env_url.startswith(('http://', 'https://')):
                    env_url = f"http://{env_url}" 
                return env_url
            raise ValueError("System default VSS server IP/protocol not configured in Firestore and no VSS_API_BASE_URL in env.")
    except Exception as e:
        print(f"MAIN.PY: Error fetching system default VSS server URL from Firestore: {e}")
        VSS_API_BASE_URL_CACHE = None
        VSS_API_BASE_URL_CACHE_EXPIRY = None
        env_url = os.environ.get('VSS_API_BASE_URL')
        if env_url:
            print(f"MAIN.PY: Warning: Error fetching from Firestore, using VSS_API_BASE_URL from environment: {env_url}")
            if not env_url.startswith(('http://', 'https://')):
                env_url = f"http://{env_url}"
            return env_url
        raise ValueError(f"Could not retrieve system default VSS server URL: {e}")


# Read allowed origins from environment variable for CORS
# Fallback to a restrictive default if not set.
CORS_ALLOWED_ORIGINS_STR = os.environ.get(
    'CORS_ALLOWED_ORIGINS',
    # Default for local development, ensure this is appropriate for production
    "http://localhost:9002,https://6000-idx-studio-1745601753440.cluster-iesosxm5fzdewqvhlwn5qivgry.cloudworkstations.dev"
)
if CORS_ALLOWED_ORIGINS_STR:
    allowed_origins_list = [origin.strip() for origin in CORS_ALLOWED_ORIGINS_STR.split(',')]
    print(f"MAIN.PY: CORS allowed origins: {allowed_origins_list}")
else:
    print("MAIN.PY: Warning: CORS_ALLOWED_ORIGINS environment variable not set or empty. CORS might be restrictive.")
    allowed_origins_list = []


# HTTP function definition for helloworld
# Note: 2nd Gen functions set CORS per function.
@https_fn.on_request(cors=options.CorsOptions(cors_origins=allowed_origins_list, cors_methods=["get", "post", "options"]))
def helloworld(req: https_fn.Request) -> https_fn.Response:
    print("MAIN.PY: HelloWorld function invoked")
    return https_fn.Response("Hello, OctaVision world from a 2nd gen Cloud Function in main.py!")
