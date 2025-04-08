const { app } = require('electron');
const createTdxWin = require('./browser/tdxwin');
const { exec } = require('child_process');
const axios = require('axios');
require('./api/index');

function createWindows(){
    global.tdxwin = createTdxWin();

    global.win.on('closed', () => {
        app.quit();
        if (global.tdxWin) {
            global.tdxWin.close();
        }
    });
    console.log('finished');
    // Fetch the route with GET method after createTdxWin() has finished
    const args = process.argv.slice(2);
    if (args.length > 0) {
        const route = args[0];
        axios.get(`http://localhost:3000/${route}`)
            .then(response => {
                console.log(`Response: ${response.data}`);
            })
            .catch(error => {
                console.error(`Error fetching route: ${error.message}`);
            });
    }
}

app.whenReady().then(createWindows);
app.on('before-quit', () => {
    if (global.tdxWin) {
        global.tdxWin.close();
    }
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createTdxWin();
    }
});
