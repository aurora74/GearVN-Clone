import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
    stages: [
        { duration: '30s', target: 50 }, // Ramp up to 50 users (Read is usually higher volume)
        { duration: '1m', target: 50 },  // Stay at 50 users
        { duration: '10s', target: 0 },  // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<200'], // 95% of reads should be very fast
    },
};

// Assuming some IDs exist (1 to 100). 
// You might need to populate DB first if empty.
export default function () {
    // Generate random ID between 1 and 100 (assuming integer IDs)
    // Note: The ID generator is sequential, but we verified IDs 1, 2, 4 exists.
    // For more robust testing, we can use a range we know exists or was created by write_test.
    const id = Math.floor(Math.random() * 50) + 1; 
    
    const url = `http://localhost/short/${id}`;

    let res = http.get(url);

    check(res, {
        'status is 200': (r) => r.status === 200,
        // Verify response body has 'origin' key if it's the API returning JSON
        // Based on curl output: {"origin":"..."}
        'has origin': (r) => r.json('origin') !== undefined, 
    });

    sleep(0.5);
}
