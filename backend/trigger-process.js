const axios = require('axios');

async function trigger() {
    try {
        console.log('Triggering processing...');
        const res = await axios.post('http://localhost:3001/api/crashes/process-all');
        console.log('Response:', JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
        if (e.response) {
            console.error('Data:', e.response.data);
        }
    }
}

trigger();
