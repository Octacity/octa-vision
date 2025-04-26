from firebase_admin import credentials, initialize_app, auth, firestore
from flask import jsonify

# Initialize Firebase Admin SDK
cred = credentials.ApplicationDefault()
initialize_app(cred)

db = firestore.client()
