const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const readline = require('readline');
const { executeSearch } = require('../../utils/fetchTools');

// Configure multer for file uploads
const loadedObjs = { progress: 0, results: [], active: false };
let lastAccessed = Date.now();
let force = false
// Endpoint to handle form submission
router.post('/', async (req, res) => {
    let filePath = path.join(__dirname, '../../lib/', path.basename("AllAttributes.csv"));

    // Reset progress
    loadedObjs.progress = 0;
    
    const attributesList = [];
    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => attributesList.push(Object.values(data)[0]))
        .on('end', async () => {
            try {
                lastAccessed = Date.now();
                loadedObjs.active = true;
                const result = await executeSearch(req.body.query, global.tdxwin, attributesList, "DACBrkRef,VPMReference,ElectricalGeometry,ElectricalBranchGeometry,CreateAssembly,Provide,ElementaryEndItem,CreateMaterial".split(","), loadedObjs,true);
                res.status(200).json(loadedObjs.progress);
            } catch (error) {
                console.error('Search API error:', error);
                res.status(500).json({ error: 'Failed to complete search' });
            }
        });
});
function stop(){
	loadedObjs.active = false;
    loadedObjs.results = [];
}
// Endpoint to check the progress and return data from a specific row to the end
router.get('/force', (req, res) => {
	force=true;
	return res.status(200).json({
                force:true
            });
});
router.get('/unforce', (req, res) => {
	force=false;
	return res.status(200).json({
                force:false
            });
});
router.get('/', (req, res) => {
    const startRow = parseInt(req.query.row, 10);
    const filePath = path.join('resources/app/search_results.csv');
	lastAccessed = Date.now();
    if (isNaN(startRow) || startRow < 0) {
		if(startRow===-2){
			stop();
		}
        return res.status(200).json({
                progress: loadedObjs.progress,
				active : loadedObjs.active
            });
    }

    
    if (!fs.existsSync(filePath)) {
        // File does not exist, return default values
        return res.status(200).json({
            progress: 0,
            header: [],
            data: [],
            totalRows: 0,
			active : loadedObjs.active
        });
    }
    const dataRows = [];
    let header = [];
    let rowIndex = 0;
    let totalRows = 0;

    const readInterface = readline.createInterface({
        input: fs.createReadStream(filePath),
        output: process.stdout,
        console: false
    });

    readInterface.on('line', (line) => {
        if (rowIndex === 0) {
            header = line;
        } else if (rowIndex > startRow) {
            dataRows.push(line);
        }
        rowIndex++;
        totalRows++;
    });

    readInterface.on('close', () => {
  
            res.status(200).json({
                progress: loadedObjs.progress,
                header: header,
                data: dataRows,
				active : loadedObjs.active,
                totalRows: totalRows - 1 // Exclude header row
            });

    });

    readInterface.on('error', (error) => {
        console.error('File reading error:', error);
        res.status(500).json({ error: 'Failed to read the file' });
    });
});

// Periodically check the last access time to update the active status
setInterval(() => {
    if (!force && (Date.now() - lastAccessed > 5000)) {
        stop();
    } else {
        loadedObjs.active = true;
    }
}, 1000);

module.exports = router;
