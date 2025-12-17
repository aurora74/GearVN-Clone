# `Shorten`: Yet another URL shortener  
`Shorten` is a simple and efficient URL shortening service that allows you to create compact, easy-to-share links from long URLs

## Workflow  
![image](https://github.com/user-attachments/assets/0934bb36-e581-477a-9b57-ea2a2abfebee)
- The system uses a **load balancer** to distribute traffic and route requests to backend servers
- To prioritize fast responses to users, the system employs a **message queue (RabbitMQ)** to:  
  - Store messages and tasks from backend servers
  - Allow **background workers** to process them later
- The system leverages **background workers** to perform tasks such as:  
  - Updating IDs
  - Verifying URLs
- The system uses **PostgreSQL** as a high-performance database to store:  
  - Information about short URLs (e.g., unique IDs, original URLs, suspicious statuses, access counts)
  - The last-used ID within defined ranges
- The system utilizes **Redis** as a highly available cache via Cluster deployment:  
  - Storing frequently accessed URLs
  - Acting as a "temporary memory" for newly created short URLs
## Demo
![image](https://github.com/user-attachments/assets/214dbefc-6e53-4dc4-b161-7deba3fc20e6)
![image](https://github.com/user-attachments/assets/5ad339d5-cc4b-4cb7-b7f7-130cc405232f)
![image](https://github.com/user-attachments/assets/f1db03ed-bcb5-4f18-8db0-f9ed745c9f8d)
