const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

// Define the root route
app.get('/', (req, res) => {
    res.json({ message: "Hello world!" });
});

// Define the /api/message route
app.get('/api/message', (req, res) => {
    res.json({ message: "Hello from Express API server!" });
});

// Start the server
const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port: ${PORT}`);
});
