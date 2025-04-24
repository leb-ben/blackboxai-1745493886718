import requests
import json

def test_scan(base_url, scan_options):
    url = "http://localhost:8001/scan"
    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "base_url": base_url,
        "scan_options": scan_options
    }
    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload))
        response.raise_for_status()
        print("Scan started successfully:")
        print(response.json())
    except requests.exceptions.HTTPError as errh:
        print("HTTP Error:", errh)
        print("Response content:", response.text)
    except requests.exceptions.ConnectionError as errc:
        print("Error Connecting:", errc)
    except requests.exceptions.Timeout as errt:
        print("Timeout Error:", errt)
    except requests.exceptions.RequestException as err:
        print("Error:", err)

if __name__ == "__main__":
    # Example usage
    test_scan("https://example.com", ["full"])
