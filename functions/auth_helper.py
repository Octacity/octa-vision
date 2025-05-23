import firebase_admin
from firebase_admin import auth, credentials, firestore
from firebase_functions import https_fn

def verify_firebase_token(req: https_fn.Request):
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
    except Exception as e:
        print(f"Token verification failed: {e}")
        return None, f"Token verification failed: {e}"