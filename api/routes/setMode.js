const express = require('express');
const router = express.Router();

// Global variable to store the current mode
let currentMode = 'OPER'; // Default mode

// POST endpoint to set the mode
router.post('/', async (req, res) => {
    const { mode } = req.body;
    try {
        if (mode === 'QA' || mode === 'OPER') {
            if (mode !== currentMode) {
                if (mode === 'QA' && global.URL.slice(-3) === '.fr') {
                    global.URL = global.URL.replace('.fr', '.val');
                } else if (mode === 'OPER' && global.URL.slice(-4) === '.val') {
                    global.URL = global.URL.replace('.val', '.fr');
                }
                await tdxwin.loadURL(`${global.URL}/3dspace/resources/AppsMngt/api/pull/self`);
                currentMode = mode;
                res.json({ message: `Changed to ${mode}`, newURL: global.URL });
            } else {
                res.json({ message: `Already in ${mode} mode` });
            }
        } else {
            res.status(400).json({ error: 'Invalid mode specified' });
        }
    } catch (error) {
        console.error('Error switching mode:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET endpoint to retrieve the current mode
router.get('/', (req, res) => {
    res.json({ currentMode });
});

module.exports = router;