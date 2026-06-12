import os
import requests
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("Error: GEMINI_API_KEY not found in .env file.")
    exit(1)

model = "gemini-3.5-flash"  # or other model
url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

payload = {
    "contents": [{"parts": [{"text": "Hello, this is a test from the Bitkub bot."}]}],
}

headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}

try:
    r = requests.post(url, headers=headers, json=payload)
    print("Status Code:", r.status_code)
    print("Response Body:")
    print(r.text)
except Exception as e:
    print("Exception:", str(e))
