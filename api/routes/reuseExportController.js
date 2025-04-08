const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const readline = require('readline');
const { executeExpand } = require('../../utils/fetchTools');

// Endpoint to handle form submission
router.get('/', async (req, res) => {
    let filePath = path.join(__dirname, '../../lib/', path.basename("reuseExportAttributes.csv"));
    console.log('Route ok');

    const attributesList = [];
    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => attributesList.push(Object.values(data)[0]))
        .on('end', async () => {
            try {
                const result = await executeExpand([req.query.id], global.tdxwin, attributesList, true);
                
                // If executeExpand is successful, transform the CSV file
                const inputFile = path.join(__dirname, '../../3DXTREE.csv');
                const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                const outputFile = path.join(__dirname, `../../${today}-REUSEEXPORT.txt`);

                const headerMapping = {
                    "parent": -1,
                    "instance": -1,
                    "id": -1,
                    "label": -1,
                    "DAMArtRefDepExt-DAMCategorie": -1,
                    "Instance_physicalid": -1,
                    "Instance_label": -1,
                    "description": -1
                };

                const inputStream = fs.createReadStream(inputFile);
                const reader = readline.createInterface({ input: inputStream });

                let isFirstLine = true;
                const lines = [];

                for await (const line of reader) {
                    if (isFirstLine) {
                        isFirstLine = false;
                        const header = line.split(',');
                        header.forEach((col, idx) => {
                            if (headerMapping.hasOwnProperty(col)) {
                                headerMapping[col] = idx;
                            }
                        });

                        // Ensure all required columns were found, excluding "DAMArtRefDepExt-DAMCategorie"
                        if (Object.entries(headerMapping).some(([key, value]) => key !== "DAMArtRefDepExt-DAMCategorie" && value === -1)) {
                            throw new Error("Some mandatory required columns are missing from the CSV header.");
                        }

                        // Write header to output file
                        lines.push(Object.keys(headerMapping).join('|'));
                    } else {
                        const fields = line.split(',').map((field) => field.replace(/"/g, ''));
                        const outputFields = [
                            fields[headerMapping["parent"]],
                            fields[headerMapping["instance"]],
                            fields[headerMapping["id"]],
                            fields[headerMapping["label"]],
                            headerMapping["DAMArtRefDepExt-DAMCategorie"] !== -1 ? fields[headerMapping["DAMArtRefDepExt-DAMCategorie"]] : "",
                            fields[headerMapping["Instance_physicalid"]],
                            fields[headerMapping["Instance_label"]],
                            fields[headerMapping["description"]]
                        ];
                        lines.push(outputFields.join('|'));
                    }
                }

                // Write transformed data to the output file
                fs.writeFileSync(outputFile, lines.join('\n'));

                // Download the output file with error handling
                res.download(outputFile, (err) => {
                    if (err) {
                        console.error('File download error:', err);
                        res.status(500).json({ error: 'Failed to download the file' });
                    }
                });
            } catch (error) {
                console.error('Expand API error:', error);
                res.status(500).json({ error: 'Failed to complete search' });
            }
        });
});

module.exports = router;
