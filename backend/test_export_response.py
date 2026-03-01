import requests

# Test the export endpoint directly
response = requests.get(
    "http://localhost:8000/api/validation/44/errors/export",
    headers={
        "Authorization": "Bearer YOUR_TOKEN_HERE"  # You'll need to replace this
    }
)

print(f"Status Code: {response.status_code}")
print(f"Headers: {response.headers}")
print(f"Content-Disposition: {response.headers.get('Content-Disposition', 'NOT FOUND')}")
