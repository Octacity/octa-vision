
import firebase_admin
from firebase_functions import https_fn
import google.generativeai as genai
import os
import json
import base64
from auth_helper import verify_firebase_token

# Read the Gemini API key from Firebase Functions config
GEMINI_API_KEY = None
try:
    firebase_config = firebase_admin.functions.config()
    GEMINI_API_KEY = firebase_config.gemini.api_key
except (AttributeError, KeyError):
 # Handle cases where 'gemini' or 'api_key' are not in the config
    print("Warning: Firebase Functions config 'gemini.api_key' not found. Ensure you have set it using 'firebase functions:config:set gemini.api_key=\"YOUR_API_KEY\"'")
    # You might want to raise an exception or handle this more robustly in production


# Helper to handle Gemini API configuration check before model calls.
# This function now uses the GEMINI_API_KEY variable set above.
def get_gemini_model(model_name):
    if not GEMINI_API_KEY:
        return None, "Gemini API key not configured."
    try:
        return genai.GenerativeModel(model_name), None
    except Exception as e:
        return None, f"Failed to initialize Gemini model {model_name}: {e}"

# Configure Gemini API (only once, after GEMINI_API_KEY is determined)
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Read allowed origins from environment variable
allowed_origins_str = os.environ.get('cors_allowed_origins')
if allowed_origins_str:
    ALLOWED_ORIGINS = [origin.strip() for origin in allowed_origins_str.split(',')]
else:
    # Allow all origins if environment variable is not set
    ALLOWED_ORIGINS = True


# --- Suggest Scene Description Function ---
@https_fn.on_request(cors=ALLOWED_ORIGINS)
def suggest_scene_description(req: https_fn.Request) -> https_fn.Response:
    """HTTP Cloud Function to suggest a scene description based on an image."""
    # Authentication logic should be handled by the caller or middleware if not public
    # Authentication logic
    decoded_token, error_message = verify_firebase_token(req)
    if error_message:
        return https_fn.Response(error_message, status=401)

    # Get image data from the request
    # Assuming image data is sent as base64 encoded string in the request body
    request_json = req.get_json(silent=True)
    if request_json is None or 'imageData' not in request_json:
        return https_fn.Response(json.dumps({'error': 'No image data provided'}), status=400, mimetype='application/json')

    image_data = request_json['imageData']

    try:
        # Decode the base64 string
        decoded_image_data = base64.b64decode(image_data)
    except Exception as e: # Catching a general Exception is broad, consider more specific exceptions if known
        return https_fn.Response(json.dumps({'error': f'Failed to decode image data: {e}'}), status=400, mimetype='application/json')

    # Create the content for the model (text prompt + image)
    image_part = {
        "mime_type": "image/jpeg", # Adjust mime type based on your image
        "data": decoded_image_data
    }
    text_part = "Describe the scene in this image in detail, focusing on objects, environment, and potential activities."
    content = [text_part, image_part]

    # Call the Gemini model
    try:
        model, error = get_gemini_model('gemini-pro-vision')
        if error:
            return https_fn.Response(json.dumps({'error': error}), status=500, mimetype='application/json')

        response = model.generate_content(content)
        suggested_description = response.text.strip()
        if not suggested_description:
            suggested_description = "Could not generate a detailed scene description."

    except Exception as e: # Catching a general Exception is broad, consider more specific exceptions if known
        print(f"Gemini API error for scene description: {e}")
        return https_fn.Response(json.dumps({'error': f'Error generating scene description: {e}'}), status=500, mimetype='application/json')

    return https_fn.Response(json.dumps({'sceneDescription': suggested_description}), status=200, mimetype='application/json')


# --- Suggest Detection Targets Function ---
@https_fn.on_request(cors=ALLOWED_ORIGINS)
def suggest_detection_targets(req: https_fn.Request) -> https_fn.Response:
    """HTTP Cloud Function to suggest detection targets."""

    # Authentication logic
    decoded_token, error_message = verify_firebase_token(req)
    if error_message:
        return https_fn.Response(error_message, status=401)

    # Get input data
    request_json = req.get_json(silent=True)
    if request_json is None or 'cameraSceneContext' not in request_json:
        return https_fn.Response(json.dumps({'error': 'Missing cameraSceneContext in request body'}), status=400, mimetype='application/json')

    camera_scene_context = request_json.get('cameraSceneContext', '')
    scene_description = request_json.get('sceneDescription', '') # Optional: Use sceneDescription if available

    prompt = f"""Given the following context about a camera scene ({camera_scene_context}) and its description ({scene_description if scene_description else 'N/A'}), suggest a comma-separated list of relevant physical objects, people, or vehicles that an AI detection system should focus on detecting.

Suggest a concise comma-separated list of detection targets (e.g., "Person, Vehicle, Package, Animal"). Provide only the comma-separated list in your response, with no other text or formatting.
"""

    try:
        model, error = get_gemini_model('gemini-pro')
        if error:
            return {'error': error}, 500
            return https_fn.Response(json.dumps({'error': error}), status=500, mimetype='application/json')

        response = model.generate_content(prompt)
        suggested_targets_string = response.text.strip()
        # Optional: Basic cleaning of the response if it includes unwanted characters
        suggested_targets_string = suggested_targets_string.replace('"', '').replace("'", '')

    except Exception as e: # Catching a general Exception is broad, consider more specific exceptions if known
        print(f"Gemini API error for detection targets: {e}")
        return https_fn.Response(json.dumps({'error': f'Error generating detection targets: {e}'}), status=500, mimetype='application/json')

    return https_fn.Response(json.dumps({'suggestedTargets': suggested_targets_string}), status=200, mimetype='application/json')

# --- Suggest Alert Events Function ---
@https_fn.on_request(cors=ALLOWED_ORIGINS)
def suggest_alert_events(req: https_fn.Request) -> https_fn.Response:
    """HTTP Cloud Function to suggest alert events."""

    # Authentication logic
    decoded_token, error_message = verify_firebase_token(req)
    if error_message:
        return https_fn.Response(error_message, status=401)

    # Get input data from the request body
    request_json = req.get_json(silent=True)
    if request_json is None or 'cameraSceneContext' not in request_json or 'aiDetectionTarget' not in request_json:
         return {'error': 'Missing required data (cameraSceneContext or aiDetectionTarget) in request body'}, 400

    camera_scene_context = request_json.get('cameraSceneContext', '')
    ai_detection_target = request_json.get('aiDetectionTarget', '')

    # Construct prompt for Gemini to suggest alert events (name and condition pairs)
    prompt = f"""Based on the following camera scene context: "{camera_scene_context}" and AI detection targets: "{ai_detection_target}", suggest a list of relevant alert events. Each alert event should have a clear 'name' (a short title) and a 'condition' (a brief description of what triggers the alert, e.g., "when a person enters the red zone" or "if a vehicle stops in the driveway for more than 5 minutes").

Provide the suggestions as a JSON array of objects, where each object MUST have a 'name' (string) and a 'condition' (string). Ensure the response is valid JSON, and include only the JSON array.

Example format:
[
  {{ "name": "Motion in Zone 1", "condition": "any motion detected in the designated zone" }},
  {{ "name": "Package Drop-off", "condition": "a static object appears near the front door" }},
  {{ "name": "Vehicle Entering", "condition": "a vehicle crosses the property line" }}
]
"""
    try:
        model, error = get_gemini_model('gemini-pro')
        if error:
            return {'error': error}, 500
            return https_fn.Response(json.dumps({'error': error}), status=500, mimetype='application/json')

        response = model.generate_content(prompt)
        response_text = response.text.strip()

        # Attempt to parse the response text as JSON
        try:
            suggested_events = json.loads(response_text)
            # Optional: Add basic validation to ensure it's a list of dictionaries
            if not isinstance(suggested_events, list) or not all(isinstance(item, dict) and 'name' in item and 'condition' in item for item in suggested_events):
                print(f"Warning: Gemini response format unexpected for alert events: {response_text}")
                # Return an error if the AI didn't return the expected JSON structure
                return https_fn.Response(json.dumps({'error': 'AI model did not return the expected JSON format for alert events.'}), status=500, mimetype='application/json')

        except json.JSONDecodeError:
            print(f"Warning: Gemini response was not valid JSON for alert events: {response_text}")
            return https_fn.Response(json.dumps({'error': 'AI model did not return valid JSON for alert events.'}), status=500, mimetype='application/json')

    except Exception as e: # Catching a general Exception is broad, consider more specific exceptions if known
        print(f"Gemini API error for alert events: {e}")
        return https_fn.Response(json.dumps({'error': f'Error generating alert events: {e}'}), status=500, mimetype='application/json')

    return https_fn.Response(json.dumps({'suggestedEvents': suggested_events}), status=200, mimetype='application/json') # Return the parsed JSON array
