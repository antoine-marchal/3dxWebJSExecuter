const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { executeSearch } = require('../../utils/fetchTools');

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });
const loadedObjs = {progress:0,results:[], active: false };
let lastAccessed = Date.now();
// Endpoint to handle form submission
router.post('/', upload.single('attributesList'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }

    // Check if the uploaded file's name starts with 'lib/'
    let filePath;
    if (req.file.originalname === "PhysProdAttributes.csv" || req.file.originalname === "MnfArticlesAttributes.csv" ) {
        filePath = path.join(__dirname, '../../lib/', path.basename(req.file.originalname));
    } else {
        filePath = req.file.path;
    }

    progress = 0;
    
    const attributesList = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => attributesList.push(Object.values(data)[0]))
      .on('end', async () => {
        if (!(req.file.originalname === "PhysProdAttributes.csv" || req.file.originalname === "MnfArticlesAttributes.csv")) {
          fs.unlink(req.file.path, (err) => {
            if (err) {
              console.error('Error removing file:', err);
              res.status(500).json({ message: 'Error processing file' });
            }
          });
        }

        try {
           lastAccessed = Date.now();
          loadedObjs.active = true;
          const result = await executeSearch(
            req.body.query, 
            global.tdxwin, 
            attributesList,
            req.body.itemTypes.split(","),
            loadedObjs,
            true,
            req.body.lastVersionOnly === 'on'
          );
          res.status(200).json(loadedObjs.progress);
        } catch (error) {
          console.error('Search API error:', error);
          res.status(500).json({ error: 'Failed to complete search' });
        }
      });
});

// Endpoint to check the progress
router.get('/', (req, res) => {
    lastAccessed = Date.now();
    res.status(200).json(loadedObjs.progress);
});

// Periodically check the last access time to update the active status
setInterval(() => {
    if (Date.now() - lastAccessed > 5000) {
        loadedObjs.active = false;
		loadedObjs.progress = 0;
		loadedObjs.results = [];
    } else {
        loadedObjs.active = true;
    }
}, 1000);

module.exports = router;
