
# Use an official Python runtime as a parent image
# Choose a Python version compatible with your dependencies and Cloud Run (e.g., 3.10, 3.11, 3.12)
FROM python:3.12-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container at /app
# This ensures that requirements are installed before copying the rest of the app code,
# leveraging Docker layer caching.
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
# --no-cache-dir reduces image size.
# --system ensures packages are installed system-wide in the container,
# which is fine for this single-application container.
RUN pip install --no-cache-dir --system -r requirements.txt

# Copy the rest of the application code (main.py and any other .py files)
# into the container at /app
COPY . .

# Make port 8080 available to the world outside this container.
# Cloud Run will automatically map requests to this port if not specified otherwise.
# The application inside the container (Gunicorn) must listen on this port.
EXPOSE 8080

# Define environment variable for the Gunicorn server to listen on.
# Cloud Run injects the PORT environment variable (defaulting to 8080).
# Gunicorn will bind to 0.0.0.0 to accept connections from any interface.
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "main:app"]
# "main:app" assumes your Flask app instance is named 'app' in a file named 'main.py'.
# Adjust if your Flask app instance or filename is different.
