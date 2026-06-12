import urllib.request

url = "https://upload.wikimedia.org/wikipedia/commons/9/95/DeepSeek-icon.svg"
try:
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
    )
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
    print("--- DIRECT SVG CONTENT ---")
    for i in range(0, len(html), 80):
        print(html[i:i+80])
    print("--------------------------")
except Exception as e:
    print(f"Error fetching URL: {e}")
