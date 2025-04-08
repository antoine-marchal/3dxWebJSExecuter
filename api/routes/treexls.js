const express = require('express');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const Papa = require('papaparse');
const { pipeline } = require('stream');
const { promisify } = require('util');

const router = express.Router();
const asyncPipeline = promisify(pipeline);

// Route to convert CSV to XLSX and send to the client
router.get('/', async (req, res) => {
    const name = req.query.name || '3DXTREE';
    const filePath = path.join('resources', 'app', '3DXTREE.xlsx');
    
                res.download(filePath, `${name}.xlsx`, err => {
                    if (err) {
                        console.error('Error sending file:', err);
                        res.status(500).send('Error sending file.');
                    }
                   
                });
        
});

module.exports = router;
