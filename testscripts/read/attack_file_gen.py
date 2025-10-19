import json

with open('read_scenario.json', 'r') as file:
    data = json.load(file)

with open('attack_targets.txt', 'w') as attack_file:
    for item in data:
        key_value = item['key'].split('_')[1]
        attack_file.write(f"GET http://localhost:8080/short/{key_value}\n")

