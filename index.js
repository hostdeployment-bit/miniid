const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require("body-parser");
require('events').EventEmitter.defaultMaxListeners = 500;

// Paths
const __path = process.cwd();

// Pair bot code
const code = require('./pair');

// API Router (CommonJS version)
const apiRouter = require('./api.js');

// Body Parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --------------------------
// 1️⃣ API ROUTES FIRST
// --------------------------
app.use('/api', apiRouter);

// --------------------------
// 2️⃣ Bot code router
// --------------------------
app.use('/code', code);

// --------------------------
// 3️⃣ HTML routes LAST
// --------------------------
app.get('/pair', (req, res) => {
    res.sendFile(path.join(__path, 'pair.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__path, 'main.html'));
});

// --------------------------
// Server listen
// --------------------------
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`
👻 POPKID XD FREE BOT RUNNING....

Server running on http://localhost:${PORT}`);
});

module.exports = app;
