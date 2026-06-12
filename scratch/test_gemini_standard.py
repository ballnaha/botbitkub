import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("Error: GEMINI_API_KEY not found in .env file.")
    exit(1)

model = "gemini-3.5-flash"
url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

prompt = "You are a conservative crypto spot-trading signal reviewer for a Bitkub THB bot. Return only JSON that matches the schema."

payload = {
    "contents": [{"parts": [{"text": prompt}]}],
    "generationConfig": {
        "temperature": 0.2,
        "responseMimeType": "application/json",
        "responseSchema": {
            "type": "OBJECT",
            "properties": {
                "decision": {
                    "type": "STRING",
                    "enum": ["buy", "watch", "skip"],
                    "description": "buy if the signal is strong enough, watch if promising but not enough, skip if weak or risky.",
                },
                "score": {
                    "type": "INTEGER",
                    "description": "Opportunity score from 0 to 100.",
                },
                "confidence": {
                    "type": "NUMBER",
                    "description": "Confidence from 0.0 to 1.0.",
                },
                "reason": {
                    "type": "STRING",
                    "description": "Short practical reason for the decision.",
                },
                "replace_candidate": {
                    "type": "STRING",
                    "description": "Weakest current position symbol if a replacement should be considered, otherwise empty string.",
                },
            },
            "required": ["decision", "score", "confidence", "reason", "replace_candidate"],
        },
    },
}

headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}

try:
    r = requests.post(url, headers=headers, json=payload)
    print("Status Code:", r.status_code)
    print("Response Body:")
    print(r.text)
except Exception as e:
    print("Exception:", str(e))
