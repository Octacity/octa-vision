
from firebase_functions import https_fn
import firebase_admin
from auth_helper import verify_firebase_token, get_firestore_client
from firebase_admin import credentials, auth, firestore
from suggest_apis import suggest_scene_description, suggest_detection_targets, suggest_alert_events
import os

firebase_admin.initialize_app()

VSS_API_BASE_URL_CACHE = None
VSS_API_BASE_URL_CACHE_EXPIRY = None
CACHE_TTL_SECONDS = 300

def get_default_vss_base_url():
    global VSS_API_BASE_URL_CACHE, VSS_API_BASE_URL_CACHE_EXPIRY
    current_time = time.time()

    if VSS_API_BASE_URL_CACHE and VSS_API_BASE_URL_CACHE_EXPIRY and current_time < VSS_API_BASE_URL_CACHE_EXPIRY:
        return VSS_API_BASE_URL_CACHE

    try:
        db = get_firestore_client() # Get Firestore client from auth_helper
        servers_ref = db.collection('servers')
        query_ref = servers_ref.where('isSystemDefault', '==', True).limit(1) # Changed from isDefault
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
            print(f"Fetched system default VSS URL from Firestore: {base_url}")
            return base_url
        else:
            print("Error: No system default VSS server found in Firestore or key fields missing.")
            env_url = os.environ.get('VSS_API_BASE_URL') # Fallback, though ideally Firestore is primary
            if env_url:
                print(f"Warning: System default VSS server not found/incomplete in Firestore, using VSS_API_BASE_URL from environment: {env_url}")
                # Ensure env_url also has a scheme if it's just ip:port
                if not env_url.startswith(('http://', 'https://')):
                    env_url = f"http://{env_url}" # Default to http if scheme missing
                return env_url
            raise ValueError("System default VSS server IP/protocol not configured in Firestore and no VSS_API_BASE_URL in env.")
    except Exception as e:
        print(f"Error fetching system default VSS server URL from Firestore: {e}")
        VSS_API_BASE_URL_CACHE = None
        VSS_API_BASE_URL_CACHE_EXPIRY = None
        env_url = os.environ.get('VSS_API_BASE_URL')
        if env_url:
            print(f"Warning: Error fetching from Firestore, using VSS_API_BASE_URL from environment: {env_url}")
            if not env_url.startswith(('http://', 'https://')):
                env_url = f"http://{env_url}"
            return env_url
        raise ValueError(f"Could not retrieve system default VSS server URL: {e}")


# Read allowed origins from environment variable (nested lowercase for Firebase Functions config)
try:
    allowed_origins_str = firebase_admin.functions.config().app.cors_allowed_origins
except AttributeError:
    allowed_origins_str = None # Config not set
allowed_origins = allowed_origins_str.split(',') if allowed_origins_str else True


@https_fn.on_request(cors=allowed_origins)
def helloworld(req: https_fn.Request) -> https_fn.Response:
    print("HelloWorld function invoked")
    return https_fn.Response("Hello, OctaVision world from a 2nd gen Cloud Function in main.py!")

