# cloud_functions/files.py

import requests
import os
import firebase_admin
from firebase_admin import credentials, auth
from flask import Flask