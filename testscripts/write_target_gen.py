import json

# Output file for Vegeta targets
output_file = 'write_targets.txt'
base_url = 'http://localhost:80/short'
total_requests = 10000

with open(output_file, 'w') as f:
    for i in range(total_requests):
        # Vegeta target format:
        # POST http://url
        # [Header]
        # [Body]
        
        payload = json.dumps({"origin": f"https://example.com/write_test/{i}"})
        
        f.write(f"POST {base_url}\n")
        f.write("Content-Type: application/json\n")
        f.write(f"@body_{i}.json\n") # This is tricky, vegeta usually expects inline body or ONE body file.
        
        # ALTERNATIVE: Vegeta stdin format for JSON body is simpler if we construct it properly.
        # But standard format allows base64 or file. 
        # Actually, simpler approach: use one 'jq' or similar to feed vegeta, OR just write the body inline?
        # Vegeta doesn't support inline body in targets file easily without base64.
        
        # ACTUALLY, BEST WAY:
        # Use `jq` to generate JSONs and pipe to `vegeta attack -format=json`?
        # Or simple target format:
        # POST url
        # Content-Type: ...
        # [Empty Line]
        # Body
        
        # Let's try the standard format with inline body logic manually? No, risky.
        pass

# REVISION:
# Better approach for dynamic body in Vegeta:
# Generate a JSON file with lines of JSON bodies, and use `jq` to wrap them?
# NO.
# Let's use the 'json' format for targets which is more robust.
# { "method": "POST", "url": "...", "header": {...}, "body": "base64..." }

import base64

with open('write_targets.json', 'w') as f:
    for i in range(total_requests):
        body = json.dumps({"origin": f"https://example.com/write_test/{i}"}).encode('utf-8')
        b64_body = base64.b64encode(body).decode('utf-8')
        
        target = {
            "method": "POST",
            "url": base_url,
            "header": {"Content-Type": ["application/json"]},
            "body": b64_body
        }
        f.write(json.dumps(target) + "\n")

print(f"Generated {total_requests} targets to write_targets.json")
