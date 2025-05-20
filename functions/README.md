
# Python Cloud Functions for OctaVision

This directory contains the Python Cloud Functions for the OctaVision application.

## Setup and Deployment

Before deploying these functions, you need to set up a Python virtual environment and install the dependencies. The Firebase CLI expects this virtual environment to be named `venv` and located within this `cloud_functions` directory.

1.  **Navigate to this directory:**
    From your project root:
    ```bash
    cd cloud_functions
    ```

2.  **Create a virtual environment (if it doesn't exist):**
    Use the Python version that matches your function's runtime (specified as `python312` in your `firebase.json`).
    ```bash
    python3.12 -m venv venv
    ```
    *(If `python3.12` isn't directly available, you might use `python3 -m venv venv` or specify the full path to your Python 3.12 interpreter. Ensure the version matches your Firebase Functions runtime.)*

3.  **Activate the virtual environment:**
    *   On macOS and Linux:
        ```bash
        source venv/bin/activate
        ```
    *   On Windows (Git Bash or similar):
        ```bash
        source venv/Scripts/activate
        ```
    *   On Windows (Command Prompt or PowerShell):
        ```bash
        .\venv\Scripts\activate
        ```
    You should see `(venv)` at the beginning of your command prompt after activation.

4.  **Install dependencies:**
    While the virtual environment is activated and you are in the `cloud_functions` directory:
    ```bash
    pip install -r requirements.txt
    ```
    This will install `firebase-admin`, `flask`, `requests`, `opencv-python`, and `numpy` into your virtual environment.

5.  **Deploy functions:**
    After installing dependencies, navigate back to your project's root directory (where `firebase.json` is located).
    ```bash
    cd ..
    ```
    Then, run the deployment command:
    ```bash
    firebase deploy --only functions --project octavision-g28ij
    ```

**Important Notes:**
*   The `venv` directory should generally be added to your `.gitignore` file (if it isn't already) as it's specific to your local development environment and can be large. The `firebase.json` file's `functions.ignore` array already includes `"venv"`, which tells the Firebase CLI not to package the `venv` directory itself during deployment (it uses the installed packages information).
*   If you encounter issues finding `python3.12`, ensure it's installed on your system and added to your system's PATH, or use the appropriate command for your specific Python installation.
