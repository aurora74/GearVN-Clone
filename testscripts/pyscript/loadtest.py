from locust import HttpUser, task, between
from faker import Faker 
from random import choice
# codes = []



class J4TUser(HttpUser):
    faker = Faker()
    wait_time = between(0.5,1)
    ids = []
    
    @task
    def create_url(self): 
        url = self.faker.url()
        response = self.client.post('/short', json={"origin": url})        
        body = response.json()
        id = body.get('id') 
        self.ids.append(id)
    
    @task(weight=4)
    def get_url(self): 
        if len(self.ids) > 0:
            id = choice(self.ids)
            response = self.client.get(f'/short/{id}')
    
