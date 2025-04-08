const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const readline = require('readline');
const { executeExpand } = require('../../utils/fetchTools');


// Endpoint to handle form submission
router.get('/', async (req, res) => {
    let filePath = path.join(__dirname, '../../lib/', path.basename("AllAttributes.csv"));
	console.log('Route ok');

    
    const attributesList = [];
    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => attributesList.push(Object.values(data)[0]))
        .on('end', async () => {
			try{
                const result = await executeExpand([req.query.id], global.tdxwin, attributesList,true);
                res.status(200).type('text').send(result);
            } catch (error) {
                console.error('Expand API error:', error);
                res.status(500).json({ error: 'Failed to complete search' });
            }
		});
});

module.exports = router;
