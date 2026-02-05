#!/bin/bash
# Nano Banana Image Generation Script
# This script calls the Gemini API to generate images

set -e

# Check for required environment variable
if [ -z "$GEMINI_API_KEY" ]; then
    echo "Error: GEMINI_API_KEY environment variable is not set"
    exit 1
fi

# Get the prompt from the first argument or stdin
PROMPT="${1:-}"
if [ -z "$PROMPT" ]; then
    read -r PROMPT
fi

if [ -z "$PROMPT" ]; then
    echo "Error: No prompt provided"
    exit 1
fi

# API endpoint
API_URL="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent"

# Create the request payload
PAYLOAD=$(cat <<EOF
{
  "contents": [
    {
      "parts": [
        {
          "text": "Generate an image: $PROMPT"
        }
      ]
    }
  ],
  "generationConfig": {
    "responseModalities": ["Text", "Image"]
  }
}
EOF
)

# Make the API call
RESPONSE=$(curl -s -X POST "$API_URL?key=$GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

# Check for errors
if echo "$RESPONSE" | grep -q '"error"'; then
    echo "API Error:"
    echo "$RESPONSE" | jq -r '.error.message // .error'
    exit 1
fi

# Output the response
echo "$RESPONSE"
