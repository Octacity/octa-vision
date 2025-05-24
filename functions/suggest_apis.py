
import firebase_admin
from firebase_functions import https_fn, options
import google.generativeai as genai
import os
import json
import base64
import re # Import the regex module
from auth_helper import verify_firebase_token

# --- Gemini API Key Configuration ---
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')

if not GEMINI_API_KEY:
    print("SUGGEST_APIS.PY: Warning: GEMINI_API_KEY environment variable not found.")
else:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        print("SUGGEST_APIS.PY: Gemini API configured successfully.")
    except Exception as e:
        print(f"SUGGEST_APIS.PY: Error configuring Gemini API: {e}")
        GEMINI_API_KEY = None

# --- CORS Configuration ---
CORS_ALLOWED_ORIGINS_STR = os.environ.get(
    'CORS_ALLOWED_ORIGINS',
    "http://localhost:9002,https://6000-idx-studio-1745601753440.cluster-iesosxm5fzdewqvhlwn5qivgry.cloudworkstations.dev"
)
allowed_origins_list = []
if CORS_ALLOWED_ORIGINS_STR:
    allowed_origins_list = [origin.strip() for origin in CORS_ALLOWED_ORIGINS_STR.split(',')]
    print(f"SUGGEST_APIS.PY: CORS allowed origins (from env): {allowed_origins_list}")
else:
    print("SUGGEST_APIS.PY: Warning: CORS_ALLOWED_ORIGINS environment variable not set or empty for suggest_apis. Using restrictive default.")
    # Fallback if not set, ensure your dev environment is covered or set the ENV VAR
    allowed_origins_list = ["http://localhost:9002", "https://6000-idx-studio-1745601753440.cluster-iesosxm5fzdewqvhlwn5qivgry.cloudworkstations.dev"]
    print(f"SUGGEST_APIS.PY: CORS allowed origins (fallback): {allowed_origins_list}")


cors_options_config = options.CorsOptions(
    cors_origins=allowed_origins_list,
    cors_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"] # Ensure Authorization is allowed
)


def get_gemini_model(model_name="gemini-pro-vision"): # Default to vision model
    GEMINI_MODEL_NAME = os.environ.get('GEMINI_MODEL_NAME', model_name)
    if not GEMINI_API_KEY:
        print("SUGGEST_APIS.PY: Gemini API key not configured. Cannot get model.")
        return None, "Gemini API key not configured."
    try:
        print(f"SUGGEST_APIS.PY: Using Gemini model: {GEMINI_MODEL_NAME}")
        return genai.GenerativeModel(GEMINI_MODEL_NAME), None
    except Exception as e:
        print(f"SUGGEST_APIS.PY: Failed to initialize Gemini model {GEMINI_MODEL_NAME}: {e}")
        return None, f"Failed to initialize Gemini model {GEMINI_MODEL_NAME}: {e}"


def clean_gemini_json_response(response_text: str) -> str:
    print(f"SUGGEST_APIS.PY: Raw response for cleaning: '{response_text}'")
    # Try to find JSON within markdown-like code blocks (```json ... ``` or ``` ... ```)
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", response_text, re.DOTALL)
    if match:
        json_text = match.group(1).strip()
        print(f"SUGGEST_APIS.PY: Extracted JSON from markdown: '{json_text}'")
        return json_text
    else:
        # If no markdown fences, try to find the first '{' or '[' and last '}' or ']'
        # This is a bit more aggressive and might be problematic if there's other text
        first_bracket = -1
        last_bracket = -1
        if '{' in response_text and '}' in response_text:
            first_bracket = response_text.find('{')
            last_bracket = response_text.rfind('}')
        elif '[' in response_text and ']' in response_text:
            first_bracket = response_text.find('[')
            last_bracket = response_text.rfind(']')

        if first_bracket != -1 and last_bracket != -1 and first_bracket < last_bracket:
            potential_json = response_text[first_bracket : last_bracket + 1].strip()
            print(f"SUGGEST_APIS.PY: Potential JSON extracted by bracket finding: '{potential_json}'")
            return potential_json
        else:
            print(f"SUGGEST_APIS.PY: No clear JSON structure found, returning stripped original: '{response_text.strip()}'")
            return response_text.strip()


@https_fn.on_request(cors=cors_options_config)
def suggest_scene_description(req: https_fn.Request) -> https_fn.Response:
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
        if ',' in image_data_base64:
            header, encoded = image_data_base64.split(",", 1)
            mime_type = header.split(":")[1].split(";")[0] if header.startswith("data:") else "image/jpeg"
        else:
            encoded = image_data_base64
            mime_type = "image/jpeg"
        decoded_image_data = base64.b64decode(encoded)
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

        print(f"SUGGEST_APIS.PY: Gemini response for scene description: {suggested_description[:100]}...")
        return https_fn.Response(json.dumps({'status': 'success', 'sceneDescription': suggested_description}), status=200, mimetype='application/json')

    except Exception as e:
        print(f"SUGGEST_APIS.PY: Gemini API error for scene description: {e}")
        return https_fn.Response(json.dumps({'status': 'error', 'message': f'Error generating scene description: {e}'}), status=500, mimetype='application/json')


@https_fn.on_request(cors=cors_options_config)
def suggest_detection_targets(req: https_fn.Request) -> https_fn.Response:
    print("SUGGEST_APIS.PY: suggest_detection_targets invoked.")
    decoded_token, error_message = verify_firebase_token(req)
    if error_message:
        print(f"SUGGEST_APIS.PY: Authentication failed: {error_message}")
        return https_fn.Response(json.dumps({'status': 'error', 'message': error_message}), status=401, mimetype='application/json')

    if not GEMINI_API_KEY:
        print("SUGGEST_APIS.PY: Gemini API key not available.")
        return https_fn.Response(json.dumps({'status': 'error', 'message': 'AI service not configured (API Key missing).'}), status=503, mimetype='application/json')

    request_json = req.get_json(silent=True)
    if request_json is None or 'cameraSceneContext' not in request_json:
        print("SUGGEST_APIS.PY: Missing cameraSceneContext.")
        return https_fn.Response(json.dumps({'status': 'error', 'message': 'Missing cameraSceneContext in request body'}), status=400, mimetype='application/json')

    camera_scene_context = request_json.get('cameraSceneContext', '')
    scene_description = request_json.get('sceneDescription', '') # This can be empty

    prompt = f"""Based on the following camera scene context and scene description, suggest a concise comma-separated list of relevant physical objects, people, or vehicles that an AI detection system should focus on detecting. Provide only the comma-separated list, with no other text, labels, or formatting. Example: "Person, Vehicle, Package, Animal".

Camera Scene Context: {camera_scene_context}
Scene Description (if available): {scene_description if scene_description else 'Not provided.'}
"""
    try:
        model, error = get_gemini_model(model_name="gemini-pro") # Text model for this
        if error:
            print(f"SUGGEST_APIS.PY: Error getting Gemini model: {error}")
            return https_fn.Response(json.dumps({'status': 'error', 'message': error}), status=500, mimetype='application/json')

        print("SUGGEST_APIS.PY: Calling Gemini for detection targets...")
        response = model.generate_content(prompt)
        suggested_targets_string = response.text.strip().replace('"', '').replace("'", '')

        print(f"SUGGEST_APIS.PY: Gemini response for detection targets: {suggested_targets_string}")
        return https_fn.Response(json.dumps({'status': 'success', 'suggestedTargets': suggested_targets_string}), status=200, mimetype='application/json')

    except Exception as e:
        print(f"SUGGEST_APIS.PY: Gemini API error for detection targets: {e}")
        return https_fn.Response(json.dumps({'status': 'error', 'message': f'Error generating detection targets: {e}'}), status=500, mimetype='application/json')


@https_fn.on_request(cors=cors_options_config)
def suggest_alert_events(req: https_fn.Request) -> https_fn.Response:
    print("SUGGEST_APIS.PY: suggest_alert_events invoked.")
    decoded_token, error_message = verify_firebase_token(req)
    if error_message:
        print(f"SUGGEST_APIS.PY: Authentication failed: {error_message}")
        return https_fn.Response(json.dumps({'status': 'error', 'message': error_message}), status=401, mimetype='application/json')

    if not GEMINI_API_KEY:
        print("SUGGEST_APIS.PY: Gemini API key not available.")
        return https_fn.Response(json.dumps({'status': 'error', 'message': 'AI service not configured (API Key missing).'}), status=503, mimetype='application/json')

    request_json = req.get_json(silent=True)
    if request_json is None or 'cameraSceneContext' not in request_json or 'aiDetectionTarget' not in request_json:
        print("SUGGEST_APIS.PY: Missing required data (cameraSceneContext or aiDetectionTarget).")
        return https_fn.Response(json.dumps({'status': 'error', 'message': 'Missing required data (cameraSceneContext or aiDetectionTarget) in request body'}), status=400, mimetype='application/json')

    camera_scene_context = request_json.get('cameraSceneContext', '')
    ai_detection_target = request_json.get('aiDetectionTarget', '')

    prompt = f"""Considering the following camera scene context and the desired AI detection targets, suggest:
1. A concise overall 'Alert Name' for a VSS alert configuration (e.g., "Warehouse Zone A Monitoring").
2. A list of specific, concise 'Event Names' (strings, like 'Fire', 'Person Detected', or 'Vehicle Idling Too Long') that should be included in this alert's event array for the VSS API. These event names should be suitable for direct use in an API that expects an array of event strings like ["Fire", "More than 5 people"].

Format the output as a JSON object with 'suggestedAlertName' (string) and 'suggestedEventNames' (array of strings) keys.

Example Output:
{{
  "suggestedAlertName": "Security Breach Alert",
  "suggestedEventNames": ["Unauthorized Entry", "Forced Door", "Broken Window"]
}}

Camera Scene Context: {camera_scene_context}
AI Detection Targets: {ai_detection_target}
"""
    try:
        model, error = get_gemini_model(model_name="gemini-pro") # Text model
        if error:
            print(f"SUGGEST_APIS.PY: Error getting Gemini model: {error}")
            return https_fn.Response(json.dumps({'status': 'error', 'message': error}), status=500, mimetype='application/json')

        print("SUGGEST_APIS.PY: Calling Gemini for alert events (VSS format)...")
        response = model.generate_content(prompt)
        raw_response_text = response.text.strip()
        print(f"SUGGEST_APIS.PY: Raw Gemini response for alert events: '{raw_response_text}'")

        json_text_to_parse = clean_gemini_json_response(raw_response_text)
        print(f"SUGGEST_APIS.PY: Text to parse as JSON for alert events: '{json_text_to_parse}'")

        try:
            parsed_response = json.loads(json_text_to_parse)
            # Validate the structure of the parsed response
            if not isinstance(parsed_response, dict) or \
               'suggestedAlertName' not in parsed_response or not isinstance(parsed_response['suggestedAlertName'], str) or \
               'suggestedEventNames' not in parsed_response or not isinstance(parsed_response['suggestedEventNames'], list) or \
               not all(isinstance(item, str) for item in parsed_response['suggestedEventNames']):
                print(f"SUGGEST_APIS.PY: Warning: Gemini response format unexpected for VSS alert events: {json_text_to_parse}")
                raise ValueError("AI model did not return the expected JSON structure (suggestedAlertName: string, suggestedEventNames: array of strings).")

            print(f"SUGGEST_APIS.PY: Gemini response for alert events (parsed): {parsed_response}")
            return https_fn.Response(json.dumps({'status': 'success', **parsed_response}), status=200, mimetype='application/json')

        except json.JSONDecodeError as e:
            print(f"SUGGEST_APIS.PY: Warning: Gemini response was not valid JSON for alert events: {json_text_to_parse}. Error: {e}")
            # Try to provide a more helpful error message if parsing fails
            error_message = f"AI model did not return valid JSON. Raw output: '{raw_response_text[:200]}...'"
            return https_fn.Response(json.dumps({'status': 'error', 'message': error_message}), status=500, mimetype='application/json')
        except ValueError as e: # Catch our custom ValueError for structure validation
             print(f"SUGGEST_APIS.PY: Error validating Gemini response structure: {e}")
             return https_fn.Response(json.dumps({'status': 'error', 'message': str(e)}), status=500, mimetype='application/json')


    except Exception as e:
        print(f"SUGGEST_APIS.PY: Gemini API error for alert events: {e}")
        return https_fn.Response(json.dumps({'status': 'error', 'message': f'Error generating alert events: {e}'}), status=500, mimetype='application/json')

    