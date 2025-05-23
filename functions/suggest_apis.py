# functions/suggest_apis.py

import functions_framework
import firebase_admin
from firebase_admin import credentials, auth
import google.generativeai as genai
import os
import json
import base64
from .main import verify_firebase_token # Assuming verify_firebase_token is in main.py

# Initialize Firebase Admin SDK (only once)
# Important: Initialize before accessing functions.config()
try:
    if not firebase_admin._apps:
        # Use ApplicationDefaultCredentials for Cloud Functions environment
        cred = firebase_admin.credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
except ValueError:
    # Handle case where app is already initialized (e.g., in local testing)
    pass

# Initialize Firebase Admin SDK (only once)
try:
    if not firebase_admin._apps:
        # Use ApplicationDefaultCredentials for Cloud Functions environment
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
except ValueError:
    # Handle case where app is already initialized (e.g., in local testing)
    pass

# Access the nested environment variable set by Firebase CLI
# and assign it to the uppercase GEMINI_API_KEY variable.
GEMINI_API_KEY = None
try:
    firebase_config = firebase_admin.functions.config()
    # Access the nested key gemini.api_key
    GEMINI_API_KEY = firebase_config.gemini.api_key
except AttributeError:
    # Handle the case where the config is not set (e.g., in local development)
    print("Warning: Firebase Functions config 'gemini.api_key' not found. Ensure you have set it using 'firebase functions:config:set gemini.api_key=\"YOUR_API_KEY\"'")

# Helper to handle Gemini API configuration check before model calls
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


# --- Suggest Scene Description Function ---
@functions_framework.http
def suggest_scene_description(request):
    """HTTP Cloud Function to suggest a scene description based on an image."""

    # Authentication logic
    decoded_token, error_message = verify_firebase_token(request)
    if error_message:
        return functions_framework.Response(error_message, status=401)

    # Get image data from the request
    # Assuming image data is sent as base64 encoded string in the request body
    request_json = request.get_json(silent=True)
    if request_json is None or 'imageData' not in request_json:
        return {'error': 'No image data provided'}, 400

    image_data = request_json['imageData']

    try:
        # Decode the base64 string
        decoded_image_data = base64.b64decode(image_data)
    except Exception as e:
        return {'error': f'Failed to decode image data: {e}'}, 400

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
            return {'error': error}, 500

        response = model.generate_content(content)
        suggested_description = response.text.strip()
        if not suggested_description:
            suggested_description = "Could not generate a detailed scene description."

    except Exception as e:
        print(f"Gemini API error for scene description: {e}")
        return {'error': f'Error generating scene description: {e}'}, 500

    return {'sceneDescription': suggested_description}, 200


# --- Suggest Detection Targets Function ---
@functions_framework.http
def suggest_detection_targets(request):
    """HTTP Cloud Function to suggest detection targets."""

    # Authentication logic
    decoded_token, error_message = verify_firebase_token(request)
    if error_message:
        return functions_framework.Response(error_message, status=401)

    # Get input data
    request_json = request.get_json(silent=True)
    if request_json is None or 'cameraSceneContext' not in request_json:
        return {'error': 'Missing cameraSceneContext in request body'}, 400

    camera_scene_context = request_json.get('cameraSceneContext', '')
    scene_description = request_json.get('sceneDescription', '') # Optional: Use sceneDescription if available

    prompt = f"""Given the following context about a camera scene ({camera_scene_context}) and its description ({scene_description if scene_description else 'N/A'}), suggest a comma-separated list of relevant physical objects, people, or vehicles that an AI detection system should focus on detecting.

Suggest a concise comma-separated list of detection targets (e.g., "Person, Vehicle, Package, Animal"). Provide only the comma-separated list in your response, with no other text or formatting.
"""

    try:
        model, error = get_gemini_model('gemini-pro')
        if error:
            return {'error': error}, 500

        response = model.generate_content(prompt)
        suggested_targets_string = response.text.strip()
        # Optional: Basic cleaning of the response if it includes unwanted characters
        suggested_targets_string = suggested_targets_string.replace('"', '').replace("'", '')

    except Exception as e:
        print(f"Gemini API error for detection targets: {e}")
        return {'error': f'Error generating detection targets: {e}'}, 500

    return {'suggestedTargets': suggested_targets_string}, 200


# --- Suggest Alert Events Function ---
@functions_framework.http
def suggest_alert_events(request):
    """HTTP Cloud Function to suggest alert events."""

    # Authentication logic
    decoded_token, error_message = verify_firebase_token(request)
    if error_message:
        return functions_framework.Response(error_message, status=401)

    # Get input data
    request_json = request.get_json(silent=True)
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

        response = model.generate_content(prompt)
        response_text = response.text.strip()

        # Attempt to parse the response text as JSON
        try:
            suggested_events = json.loads(response_text)
            # Optional: Add basic validation to ensure it's a list of dictionaries
            if not isinstance(suggested_events, list) or not all(isinstance(item, dict) and 'name' in item and 'condition' in item for item in suggested_events):
                print(f"Warning: Gemini response format unexpected for alert events: {response_text}")
                # Return an error if the AI didn't return the expected JSON structure
                return {'error': 'AI model did not return the expected JSON format for alert events.'}, 500

        except json.JSONDecodeError:
            print(f"Warning: Gemini response was not valid JSON for alert events: {response_text}")
            return {'error': 'AI model did not return valid JSON for alert events.'}, 500

    except Exception as e:
        print(f"Gemini API error for alert events: {e}")
        return {'error': f'Error generating alert events: {e}'}, 500

    return {'suggestedEvents': suggested_events}, 200 # Return the parsed JSON array