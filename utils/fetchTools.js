const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const ExcelJS = require('exceljs');

async function executeFetchInWindow(win, url, fetchOptions) {
    const fetchOptionsStr = JSON.stringify(fetchOptions);
    const script = `
        fetch("${url}", ${fetchOptionsStr})
        .then(response => response.json())
        .then(data => {
            console.log('Fetch successful');
            return data;
        })
        .catch(err => {
            console.error('Fetch error');
            return { error: 'Fetch failed' };
        });
    `;
    try {
        const result = await win.webContents.executeJavaScript(script);
        return result;
    } catch (error) {
        console.error('Error executing fetch script:', error);
        return { error: 'Execution failed', details: error };
    }
}
// Function to read and parse JSON from a file
function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

async function processPathsAndGenerateRelJson(generateXlsx = false) {
    const collectionPath = path.join('resources/app/3DXTREE_PATHS.json');
    const relcolPath = path.join('resources/app/3DXTREE_REL.json');
    const datacolPath = path.join('resources/app/3DXTREE_DATA.json');
    const csvFilePath = path.join('resources/app/3DXTREE.csv');
    const xlsxFilePath = generateXlsx ? path.join('resources/app/3DXTREE.xlsx') : null;
    
    fs.writeFileSync(relcolPath, "["); // Clear the relcol file at the beginning

    const documents = readJson(collectionPath);

    const first = {};
    const last = {};
    const paths = [];

    documents.forEach(doc => {
        const pathArray = doc.incomplete_path.split(",");
        if (!first[pathArray[0]]) first[pathArray[0]] = [];
        if (!last[pathArray[pathArray.length - 1]]) last[pathArray[pathArray.length - 1]] = [];

        first[pathArray[0]].push(pathArray);
        last[pathArray[pathArray.length - 1]].push(pathArray);
        paths.push(pathArray);
    });

    const rootDids = [];
    for (const key of Object.keys(first)) {
        if (!last[key]) rootDids.push(key);
    }

	const complete = new Set();
	const completeS = new Set();
	function lookForNewBranchAndAdd(path, first, last, complete,completeS) {
		const branches = first[path[path.length - 1]] || [];
		if (branches.length === 0) {
			const pathKey = JSON.stringify(path); // Convert path to a string
			if (!completeS.has(pathKey)) {
				complete.add(path);
				completeS.add(pathKey);
			}
		} else {
			branches.map(branch => path.concat(branch.slice(1))).forEach(newPath => {
				lookForNewBranchAndAdd(newPath, first, last, complete,completeS);
			});
		}
	}

    rootDids.forEach(root => {
        lookForNewBranchAndAdd([root], first, last, complete,completeS);
    });

    const allrows = new Set();
	const allrowsS = new Set();
    let docstoinsert = [];

    complete.forEach(pathArray => {
		//console.log(pathArray);
        for (let i = 0; i < pathArray.length; i += 2) {
            const partialPath = pathArray.slice(0, i + 1);
            if (!allrowsS.has(JSON.stringify(partialPath.join(',')))) {
				allrowsS.add(JSON.stringify(partialPath.join(',')));
                allrows.add(partialPath.join(','));
				//console.log(partialPath.join(','));
                const level = Math.floor((partialPath.length - 1) / 2) + 1;
                const entry = {
                    level: level.toString(),
                    parent: partialPath.length > 1 ? partialPath[partialPath.length - 3].toString() : "#",
                    instance: partialPath.length > 1 ? partialPath[partialPath.length - 2].toString() : "#",
                    id: partialPath[partialPath.length - 1].toString(),
                    path: partialPath.join(','),
                    children: (partialPath !== pathArray)
                };
                docstoinsert.push(entry);

                if (docstoinsert.length % 1000 === 0) {
                    fs.appendFileSync(relcolPath, JSON.stringify(docstoinsert, null, 2).slice(1, -1)+',');
                    docstoinsert = [];
                }
            }
        }
    });

    fs.appendFileSync(relcolPath, JSON.stringify(docstoinsert, null, 2).slice(1, -1)+']'); // Final save
    console.log('REL DONE');
    docstoinsert = [];

    // Load datacol and relcol JSON
const datacol = readJson(datacolPath);
const relcol = readJson(relcolPath);

// Generate headers
const headerR = [];
const headerI = [];

for (const v of Object.keys(datacol)) {
    for (const key of Object.keys(datacol[v])) {
        if (datacol[v]['ds6w:type'] !== 'VPMInstance' && !headerR.includes(key)) {
            headerR.push(key);
        } else if ((datacol[v]['ds6w:type'] === 'VPMInstance' || datacol[v]['ds6w:type'] === 'VPMRepInstance' || datacol[v]['ds6w:type'] === 'DELFmiFunctionIdentifiedInstance') && !headerI.includes(key)) {
            headerI.push(key);
        }
    }
}

const headerRMap = Object.fromEntries(headerR.map(key => [key, key.split(':').pop()]));
const headerIMap = Object.fromEntries(headerI.map(key => [key, `Instance_${key.split(':').pop()}`]));
const header = [...Object.keys(relcol[0]), ...Object.values(headerRMap), ...Object.values(headerIMap)];
//const header = ["level","physicalid","type", "project", "responsible", "label", "description", "identifier", "current", "organization", "revision", "PLMReference-V_versionComment"];
//console.log(header);
let csvResult = "";

// Write CSV header
csvResult += header.join(',') + '\n';
fs.writeFileSync(csvFilePath, csvResult);

// Setup XLSX if needed
let workbook, worksheet;
if (generateXlsx) {
    workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        filename: xlsxFilePath,
        useStyles: true,
        useSharedStrings: true
    });
    worksheet = workbook.addWorksheet('Search Results');
    worksheet.columns = header.map(h => ({ header: h, key: h, width: 15 }));

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell(cell => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFBFBFBF' }
        };
        cell.font = { bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    worksheet.autoFilter = {
        from: 'A1',
        to: worksheet.getRow(1).getCell(header.length).address
    };
}

for (let i = 0; i < relcol.length; i++) {
    const r = relcol[i];
    const d = { ...r, ...Object.fromEntries(Object.entries(headerRMap).map(([k, v]) => [v, datacol[r.id]?.[k]])) };

    if (datacol[r.instance]) {
        Object.assign(d, Object.fromEntries(Object.entries(headerIMap).map(([k, v]) => [v, datacol[r.instance]?.[k]])));
    }

    // Ensure all headers are accounted for, inserting empty strings for missing fields
    const cleanedData = header.reduce((acc, h) => {
        acc[h] = d[h] ? d[h].toString().replace(/\n/g, ' ').replace(/,/g, '-') : '';
        return acc;
    }, {});

    // Convert to CSV line
    const csvLine = header.map(h => `"${cleanedData[h]}"`).join(',') + '\n';
    csvResult += csvLine;
    fs.appendFileSync(csvFilePath, csvLine);

    // Write to XLSX if needed
	if (generateXlsx) {
		let rowData = header.map(h => cleanedData[h] || '');
		const level = cleanedData['level']; // Assuming 'level' is part of cleanedData
		const row = worksheet.addRow(rowData);
		row.eachCell((cell) => cell.alignment = { indent: level-1 });
		row.commit();
	}

}

// Finalize XLSX if needed
if (generateXlsx) {
    await workbook.commit();
	//await deleteEmptyColumns(xlsxFilePath);
}

return csvResult;

}
async function executeExpand(bids, win, sp = '',generateXlsx=false) {
	try{
		const fetchOptions = (bidsChunk,wid) => ({
			method: 'POST',
			body: JSON.stringify({
				"select_rel": [
					"physicalid",
					"ds6w:type",
					"ds6w:label",
					"matrixtxt",
					"ro.plminstance.V_treeorder",
					"ds6w:globalType",
					"ds6wg:DAMArtInstDepExt.DAMEnvoiERP"
				],
				"compute_select_bo": [],
				"no_type_filter_rel": [],
				"label": wid,
				"tenant": "OnPremise",
				"root_path_physicalid": bidsChunk,
				"expand_iter": "3",
				"q.iterative_filter_query_bo": "[ds6w:globalType]:\"ds6w:Document\" OR [ds6w:globalType]:\"ds6w:Part\" OR [type]:\"CreateAssembly\" OR [type]:\"ElementaryEndItem\" OR [type]:\"Provide\"",
				"select_bo": ['physicalid','resourceid',...sp]
			}),
			headers: {
				'Content-Type': 'application/json; charset=UTF-8',
				'SecurityContext': global.sc.SecurityContext 
			}
		});

		const pop100 = (list) => {
			const result = [];
			while (result.length < 1000 && list.length > 0) {
				result.push(list.pop());
			}
			return result;
		};

		const pidsScanned = new Set();
		const didsRecorded = new Set();
		const pathsRecorded = new Set();
		const documentsData = {};
		const documentsPaths = [];
		
		const datacolPath = path.join('resources/app/3DXTREE_DATA.json');
		const pathcolPath = path.join('resources/app/3DXTREE_PATHS.json');

		const saveData = () => {
			const saveJson = (filePath, data, isCollection = false) => {
				const fileExists = fs.existsSync(filePath);
				const fileEmpty = fileExists ? fs.statSync(filePath).size === 0 : true;

				if (fileEmpty) {
					fs.appendFileSync(filePath, isCollection ? '[' : '{');
				} else {
					fs.appendFileSync(filePath, ',');
				}

				const jsonString = JSON.stringify(data, null, 2);
				const trimmedJson = jsonString.trim().slice(1, -1); // Remove first and last character (e.g., '{' and '}')

				fs.appendFileSync(filePath, trimmedJson);
			};

			if (Object.keys(documentsData).length > 0) {
				saveJson(datacolPath, documentsData, false);
			}
			if (documentsPaths.length > 0) {
				saveJson(pathcolPath, documentsPaths, true);
			}
		};

		const closeSave = () => {
			if (fs.existsSync(datacolPath)) {
				fs.appendFileSync(datacolPath, '}');
			}
			if (fs.existsSync(pathcolPath)) {
				fs.appendFileSync(pathcolPath, ']');
			}
		};

		fs.writeFileSync(datacolPath, "");  // Clear the file at the beginning
		fs.writeFileSync(pathcolPath, "");  // Clear the file at the beginning

		let bids_bigA = bids.slice();
		while (bids_bigA.length > 0) {
			const bidsChunk = pop100(bids_bigA);
			//console.log(bidsChunk);
			let data = null;
			let attempts = 0;
			const maxAttempts = 5;
			while (!data && attempts < maxAttempts) {
				try {
					data = await executeFetchInWindow(win, `${global.URL}/3dspace/cvservlet/expand`, fetchOptions(bidsChunk,`MFN-${new Date().toISOString()}`));
				} catch (e) {
					attempts++;
					//console.log(`Retrying... Attempt ${attempts}`);
					await new Promise(resolve => setTimeout(resolve, 1000));
				}
			}

			if (!data) {
				throw new Error('Failed to fetch data after multiple attempts');
			}

			const did2pid = {};
			data.results.forEach((result, j) => {
				if (result.attributes && !didsRecorded.has(result.attributes[0].value)) {
					didsRecorded.add(result.attributes[0].value);
					const record = result.attributes.reduce((acc, attr) => {
						acc[attr.name.replace(/\./g, '-')] = attr.value;
						return acc;
					}, {});
					did2pid[parseInt(record.did)] = record['physicalid'];
					documentsData[parseInt(record.did)] = record;
				} else if (result.path && result.path.length > 2) {
					const pa = result.path.map(id => did2pid[id]).filter(Boolean);
					let pathjoined=result.path.join(',');
					if(!pathsRecorded.has(pathjoined)){
					pathsRecorded.add(pathjoined);
						documentsPaths.push({ incomplete_path: pathjoined });
						if (pa[pa.length - 1] != null && !pidsScanned.has(pa[pa.length - 1])) {
							pidsScanned.add(pa[pa.length - 1]);
							bids_bigA.push(pa[pa.length - 1]);
						}
					}
				}

				//if (j % 1000 === 0) {
					//saveData();
				//}
			});
		}
		saveData();
		closeSave();
		console.log('DONE...');
		let csvResult = await processPathsAndGenerateRelJson(generateXlsx);
		console.log('TREE GENERATED...');
		return csvResult;
	} catch (error) {
            return error;
        }
	
}
async function executeSearch(searchTerm, win, sp = '', types = [], loadedObjs = { progress: 0, results: [], active: true }, generateXlsx = false, lastVersionOnly = false) {
	 if (lastVersionOnly) {
        searchTerm = `(` + searchTerm + `) AND [ds6wg:PLMReference.V_isLastVersion]:"TRUE"`;
    }
    let nextStart = '';
    let done = 0;
    let total = 0;
    const csvFilePath = path.join('resources/app/search_results.csv');
    const xlsxFilePath = generateXlsx ? path.join('resources/app/search_results.xlsx') : null;

    if (fs.existsSync(csvFilePath)) {
        fs.unlinkSync(csvFilePath);
    }

    const rebuiltSet = new Set(
        Array.from(sp).map(value => {
            const lastIndex = value.lastIndexOf('.');
            return lastIndex !== -1 ? value.substring(lastIndex + 1) : value;
        })
    );
    const csvHeaders = ['resourceid', ...rebuiltSet];
    const headerCsv = csvHeaders.join(',') + '\n';
    fs.writeFileSync(csvFilePath, headerCsv);

    let workbook, worksheet;
    if (generateXlsx) {
        workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: xlsxFilePath,
            useStyles: true,
            useSharedStrings: true
        });
        worksheet = workbook.addWorksheet('Search Results');
        worksheet.columns = csvHeaders.map(header => ({ header, key: header, width: 15 }));
        
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell(cell => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFBFBFBF' }
            };
            cell.font = { bold: true };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        worksheet.autoFilter = {
            from: 'A1',
            to: worksheet.getRow(1).getCell(csvHeaders.length).address
        };
    }

    const typesArray = types.map(x => ({
        disptext: x,
        object: x,
        type: "string",
        field: ["implicit"]
    }));

    let firstfetch = true;
    let stop = false;
    let allResults = [];

    do {
        const postData = JSON.stringify({
            label: 'hello',
            query: searchTerm,
            nresults: 1000,
            next_start: nextStart,
            select_predicate: sp,
			login:{"3dspace":{"SecurityContext":"ctx::"+global.sc.SecurityContext }},
            refine: {
                "ds6w:what/ds6w:type": typesArray
            },
            tenant: 'OnPremise',
            source: ['swym', '3dspace'],
            with_synthesis: false,
            with_nls: false,
            with_indexing_date: false
        });

        const fetchOptions = {
            method: 'POST',
            body: postData,
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                'SecurityContext': global.sc.SecurityContext 
            }
        };

        try {
            let data = await executeFetchInWindow(win, `${global.URL}/federated/search`, fetchOptions);
            
            nextStart = data.infos.next_start;
            let nres = data.infos.nresults;
            
            if (nres === 0) {
                if(firstfetch) stop = true;
                throw new Error("Fetch returned 0 results");
            }
            firstfetch = false;
            if (total === 0) total = data.infos.nhits;
            done += nres;
            loadedObjs.progress = (done * 100) / total;
            allResults.push(...data.results);
			const csvRows = data.results.map(result => {
				const row = {};
				csvHeaders.forEach(header => {
					row[header] = result.attributes.find(attr => (attr.name.lastIndexOf('.') !== -1 ? attr.name.substring(attr.name.lastIndexOf('.') + 1) : attr.name) === header)?.value.replace(/\n/g, ' ') || '';
				});
				return row;
			});
			const csv = Papa.unparse(csvRows, {
				header: false,
				delimiter: ',',
				quoteChar: '"',
				quotes: true,
				newline: '\n'
			});
			fs.appendFileSync(csvFilePath, csv + '\n');
        } catch (error) {
            console.error("An error occurred, retrying...", error);
            continue;
        }

    } while ((done < total || (done === 0)) && loadedObjs.active && !stop);


    const csvRows = allResults.map(result => {
        const row = {};
        csvHeaders.forEach(header => {
            row[header] = result.attributes.find(attr => (attr.name.lastIndexOf('.') !== -1 ? attr.name.substring(attr.name.lastIndexOf('.') + 1) : attr.name) === header)?.value.replace(/\n/g, ' ') || '';
        });
        return row;
    });



    if (generateXlsx) {
        csvRows.forEach(row => worksheet.addRow(row).commit());
        await workbook.commit();
        //await deleteEmptyColumns(xlsxFilePath);
    }

    //loadedObjs.results = allResults;
    return true;
}


async function deleteEmptyColumns(xlsxFilePath) {
	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.readFile(xlsxFilePath);
	const worksheet = workbook.getWorksheet(1);
	// Array to hold columns to remove
	const columnsToRemove = [];
	// Iterate through columns to check if only the first row is filled
	worksheet.columns.forEach((column, index) => {
		const firstRowValue = column.values[1];
		const isEmpty = column.values.slice(2).every(value => value === '' || value === null || value === undefined);

		// Add column index to array if only the first row is filled
		if (firstRowValue && isEmpty) {
			columnsToRemove.push(index + 1); // Store 1-based index
		}
	});
	// Remove columns in reverse order
	columnsToRemove.reverse().forEach((colIndex) => {
		worksheet.spliceColumns(colIndex, 1);
	});

	await workbook.xlsx.writeFile(xlsxFilePath);
    return workbook;
}
module.exports = { executeFetchInWindow, executeSearch, executeExpand};
