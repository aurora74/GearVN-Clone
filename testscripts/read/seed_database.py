import json
import os
import psycopg2

def load_seed_data():
    data_file_path = 'data.json'
    
    with open(data_file_path, 'r') as file:
        seed_data = json.load(file)
    
    try:
        conn = psycopg2.connect("postgres://dev:123456789@localhost:5433/url")
        cur = conn.cursor()
        
        for data in seed_data:
            cur.execute(
                "INSERT INTO urls (id, original_url) VALUES (%s, %s) ON CONFLICT (id) DO UPDATE SET original_url = EXCLUDED.original_url",
                (data['key'].split('_')[1], data['value'])
            )
        
        conn.commit()
        
    except Exception as e:
        print(f"Error loading seed data: {str(e)}")
    
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()
        
if __name__ == "__main__":
    load_seed_data()