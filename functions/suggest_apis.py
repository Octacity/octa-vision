
import firebase_admin
from firebase_functions import https_fn, options
import google.generativeai as genai
import os
import json
import base64
from auth_helper import verify_firebase_token

# --- Gemini API Key Configuration ---
# Read the Gemini API key from Firebase Functions config or environment variable
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')

if not GEMINI_API_KEY:
    print("SUGGEST_APIS.PY: Warning: GEMINI_API_KEY environment variable not found.")
    # Depending on policy, you might want to raise an error or disable functions that use Gemini.
else:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        print("SUGGEST_APIS.PY: Gemini API configured successfully.")
    except Exception as e:
        print(f"SUGGEST_APIS.PY: Error configuring Gemini API: {e}")
        GEMINI_API_KEY = None # Mark as not configured on error

# --- CORS Configuration ---
# Read allowed origins from environment variable for CORS
CORS_ALLOWED_ORIGINS_STR = os.environ.get(
    'CORS_ALLOWED_ORIGINS',
    "http://localhost:9002,https://6000-idx-studio-1745601753440.cluster-iesosxm5fzdewqvhlwn5qivgry.cloudworkstations.dev"
)
if CORS_ALLOWED_ORIGINS_STR:
    allowed_origins_list = [origin.strip() for origin in CORS_ALLOWED_ORIGINS_STR.split(',')]
    print(f"SUGGEST_APIS.PY: CORS allowed origins: {allowed_origins_list}")
else:
    print("SUGGEST_APIS.PY: Warning: CORS_ALLOWED_ORIGINS environment variable not set or empty for suggest_apis. CORS might be restrictive.")
    allowed_origins_list = [] # Fallback to an empty list, making it restrictive by default

cors_options = options.CorsOptions(cors_origins=allowed_origins_list, cors_methods=["get", "post", "options"])


# Helper to handle Gemini API configuration check before model calls.
def get_gemini_model(model_name="gemini-2.0-flash"): # Default to vision model
    GEMINI_MODEL_NAME = os.environ.get('GEMINI_MODEL_NAME', model_name) # Read model name from env, default to provided or gemini-pro-vision
    if not GEMINI_API_KEY:
        print("SUGGEST_APIS.PY: Gemini API key not configured. Cannot get model.")
        return None, "Gemini API key not configured."
    # Assumes genai.configure(api_key=GEMINI_API_KEY) has been called globally
    try:
        return genai.GenerativeModel(model_name), None
    except Exception as e:
        print(f"SUGGEST_APIS.PY: Using Gemini model: {GEMINI_MODEL_NAME}") # Log the model being used
        return genai.GenerativeModel(GEMINI_MODEL_NAME), None
    except Exception as e:
        print(f"SUGGEST_APIS.PY: Failed to initialize Gemini model {GEMINI_MODEL_NAME}: {e}")
        return None, f"Failed to initialize Gemini model {model_name}: {e}"


# --- Suggest Scene Description Function ---
@https_fn.on_request(cors=cors_options)
def suggest_scene_description(req: https_fn.Request) -> https_fn.Response:
    """HTTP Cloud Function to suggest a scene description based on an image."""
    print("SUGGEST_APIS.PY: suggest_scene_description invoked.")
    decoded_token, error_message = verify_firebase_token(req)
    if error_message:
        print(f"SUGGEST_APIS.PY: Authentication failed for suggest_scene_description: {error_message}")
        return https_fn.Response(json.dumps({'status': 'error', 'message': error_message}), status=401, mimetype='application/json')

    if not GEMINI_API_KEY:
        print("SUGGEST_APIS.PY: Gemini API key not available for suggest_scene_description.")
        return https_fn.Response(json.dumps({'status': 'error', 'message': 'AI service not configured (API Key missing).'}), status=503, mimetype='application/json')

    request_json = req.get_json(silent=True)
    if request_json is None or 'imageData' not in request_json:
        print("SUGGEST_APIS.PY: No image data provided for suggest_scene_description.")
        return https_fn.Response(json.dumps({'status': 'error', 'message': 'No image data provided'}), status=400, mimetype='application/json')

    image_data_base64 = request_json['imageData']

    try:
        # The image data from frontend is already base64, no need to decode here if `genai` handles `data:` prefix
        # Assuming image_data_base64 is 'data:image/jpeg;base64,ACTUAL_BASE64_STRING' or just 'ACTUAL_BASE64_STRING'
        # For Gemini API directly, it often expects just the raw base64 bytes after decoding the string.
        # However, the prompt helper in genai might handle data URIs. Let's assume `genai` expects raw bytes.
        
        # If image_data_base64 includes 'data:image/...;base64,', remove it
        if ',' in image_data_base64:
            header, encoded = image_data_base64.split(",", 1)
            mime_type = header.split(":")[1].split(";")[0] if header.startswith("data:") else "image/jpeg"
            decoded_image_data = base64.b64decode(encoded)
        else: # Assume it's just the base64 string
            decoded_image_data = base64.b64decode(image_data_base64)
            mime_type = "image/jpeg" # Default or determine from actual data if possible

    except Exception as e:
        print(f"SUGGEST_APIS.PY: Failed to decode image data: {e}")
        return https_fn.Response(json.dumps({'status': 'error', 'message': f'Failed to decode image data: {e}'}), status=400, mimetype='application/json')

    image_part = {"mime_type": mime_type, "data": decoded_image_data}
    text_part = "Describe the scene in this image in detail, focusing on objects, environment, and potential activities."
    content = [text_part, image_part]

    try:
        model, error = get_gemini_model()
        if error:
            print(f"SUGGEST_APIS.PY: Error getting Gemini model: {error}")
            return https_fn.Response(json.dumps({'status': 'error', 'message': error}), status=500, mimetype='application/json')

        print("SUGGEST_APIS.PY: Calling Gemini for scene description...")
        response = model.generate_content(content)
        suggested_description = response.text.strip()
        if not suggested_description:
            suggested_description = "Could not generate a detailed scene description."
        
        print(f"SUGGEST_APIS.PY: Gemini response for scene description: {suggested_description[:100]}...") # Log snippet
        return https_fn.Response(json.dumps({'sceneDescription': suggested_description}), status=200, mimetype='application/json')

    except Exception as e:
        print(f"SUGGEST_APIS.PY: Gemini API error for scene description: {e}")
        return https_fn.Response(json.dumps({'status': 'error', 'message': f'Error generating scene description: {e}'}), status=500, mimetype='application/json')


# --- Suggest Detection Targets Function ---
@https_fn.on_request(cors=cors_options)
def suggest_detection_targets(req: https_fn.Request) -> https_fn.Response:
    """HTTP Cloud Function to suggest detection targets."""
    print("SUGGEST_APIS.PY: suggest_detection_targets invoked.")
    decoded_token, error_message = verify_firebase_token(req)
    if error_message:
        print(f"SUGGEST_APIS.PY: Authentication failed for suggest_detection_targets: {error_message}")
        return https_fn.Response(json.dumps({'status': 'error', 'message': error_message}), status=401, mimetype='application/json')

    if not GEMINI_API_KEY:
        print("SUGGEST_APIS.PY: Gemini API key not available for suggest_detection_targets.")
        return https_fn.Response(json.dumps({'status': 'error', 'message': 'AI service not configured (API Key missing).'}), status=503, mimetype='application/json')

    request_json = req.get_json(silent=True)
    if request_json is None or 'cameraSceneContext' not in request_json:
        print("SUGGEST_APIS.PY: Missing cameraSceneContext for suggest_detection_targets.")
        return https_fn.Response(json.dumps({'status': 'error', 'message': 'Missing cameraSceneContext in request body'}), status=400, mimetype='application/json')

    camera_scene_context = request_json.get('cameraSceneContext', '')
    scene_description = request_json.get('sceneDescription', '')

    prompt = f"""Given the following context about a camera scene ({camera_scene_context}) and its description ({scene_description if scene_description else 'N/A'}), suggest a comma-separated list of relevant physical objects, people, or vehicles that an AI detection system should focus on detecting.

Suggest a concise comma-separated list of detection targets (e.g., "Person, Vehicle, Package, Animal"). Provide only the comma-separated list in your response, with no other text or formatting.
"""

    try:
        model, error = get_gemini_model() # Text model for this
        if error:
            print(f"SUGGEST_APIS.PY: Error getting Gemini model: {error}")
            return https_fn.Response(json.dumps({'status': 'error', 'message': error}), status=500, mimetype='application/json')

        print("SUGGEST_APIS.PY: Calling Gemini for detection targets...")
        response = model.generate_content(prompt)
        suggested_targets_string = response.text.strip().replace('"', '').replace("'", '')
        
        print(f"SUGGEST_APIS.PY: Gemini response for detection targets: {suggested_targets_string}")
        return https_fn.Response(json.dumps({'suggestedTargets': suggested_targets_string}), status=200, mimetype='application/json')

    except Exception as e:
        print(f"SUGGEST_APIS.PY: Gemini API error for detection targets: {e}")
        return https_fn.Response(json.dumps({'status': 'error', 'message': f'Error generating detection targets: {e}'}), status=500, mimetype='application/json')

# --- Suggest Alert Events Function ---
@https_fn.on_request(cors=cors_options)
def suggest_alert_events(req: https_fn.Request) -> https_fn.Response:
    """HTTP Cloud Function to suggest alert events."""
    print("SUGGEST_APIS.PY: suggest_alert_events invoked.")
    decoded_token, error_message = verify_firebase_token(req)
    if error_message:
        print(f"SUGGEST_APIS.PY: Authentication failed for suggest_alert_events: {error_message}")
        return https_fn.Response(json.dumps({'status': 'error', 'message': error_message}), status=401, mimetype='application/json')

    if not GEMINI_API_KEY:
        print("SUGGEST_APIS.PY: Gemini API key not available for suggest_alert_events.")
        return https_fn.Response(json.dumps({'status': 'error', 'message': 'AI service not configured (API Key missing).'}), status=503, mimetype='application/json')

    request_json = req.get_json(silent=True)
    if request_json is None or 'cameraSceneContext' not in request_json or 'aiDetectionTarget' not in request_json:
         print("SUGGEST_APIS.PY: Missing required data for suggest_alert_events.")
         return https_fn.Response(json.dumps({'status': 'error', 'message': 'Missing required data (cameraSceneContext or aiDetectionTarget) in request body'}), status=400, mimetype='application/json')

    camera_scene_context = request_json.get('cameraSceneContext', '')
    ai_detection_target = request_json.get('aiDetectionTarget', '')

    prompt = f"""Based on the following camera scene context: "{camera_scene_context}" and AI detection targets: "{ai_detection_target}", suggest a list of relevant alert events. Each alert event should have a clear 'name' (a short title) and a 'condition' (a brief description of what triggers the alert, e.g., "when a person enters the red zone" or "if a vehicle stops in the driveway for more than 5 minutes").

Provide the suggestions as a JSON array of objects, where each object MUST have a 'name' (string) and a 'condition' (string). Ensure the response is valid JSON, and include only the JSON array.

Example format:
[
  {{"name": "Motion in Zone 1", "condition": "any motion detected in the designated zone"}},
  {{"name": "Package Drop-off", "condition": "a static object appears near the front door"}},
  {{"name": "Vehicle Entering", "condition": "a vehicle crosses the property line"}}
]
"""
    try:
        model, error = get_gemini_model() # Text model
        if error:
            print(f"SUGGEST_APIS.PY: Error getting Gemini model: {error}")
            return https_fn.Response(json.dumps({'status': 'error', 'message': error}), status=500, mimetype='application/json')

        print("SUGGEST_APIS.PY: Calling Gemini for alert events...")
        response = model.generate_content(prompt)
        response_text = response.text.strip()

        try:
            suggested_events = json.loads(response_text)
            if not isinstance(suggested_events, list) or not all(isinstance(item, dict) and 'name' in item and 'condition' in item for item in suggested_events):
                print(f"SUGGEST_APIS.PY: Warning: Gemini response format unexpected for alert events: {response_text}")
                return https_fn.Response(json.dumps({'status': 'error', 'message': 'AI model did not return the expected JSON format for alert events.'}), status=500, mimetype='application/json')
            
            print(f"SUGGEST_APIS.PY: Gemini response for alert events (parsed): {suggested_events}")
            return https_fn.Response(json.dumps({'suggestedEvents': suggested_events}), status=200, mimetype='application/json')

        except json.JSONDecodeError:
            print(f"SUGGEST_APIS.PY: Warning: Gemini response was not valid JSON for alert events: {response_text}")
            return https_fn.Response(json.dumps({'status': 'error', 'message': 'AI model did not return valid JSON for alert events.'}), status=500, mimetype='application/json')

    except Exception as e:
        print(f"SUGGEST_APIS.PY: Gemini API error for alert events: {e}")
        return https_fn.Response(json.dumps({'status': 'error', 'message': f'Error generating alert events: {e}'}), status=500, mimetype='application/json')
