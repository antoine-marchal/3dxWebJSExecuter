const { BrowserWindow,session } = require('electron');
const https = require('https');
const ini = require('ini');
const fs = require('fs');
const config = ini.parse(fs.readFileSync('resources/app/config.ini', 'utf-8'));
global.URL = config.settings.URL;

function createTdxWin() {
	const ses = session.defaultSession;
    ses.setCertificateVerifyProc((request, callback) => {
        callback(0); // 0 means success, -2 means reject
    });
    let tdxwin = new BrowserWindow({
        width: 1620,
        height: 880,
		show:true,
        webPreferences: {
            nodeIntegration: true,
            webSecurity: false
        },
        autoHideMenuBar: true
    });
	https.globalAgent.options.rejectUnauthorized = false;
    let initialLoad = true;
    tdxwin.loadURL(`${URL}/3dspace/resources/AppsMngt/api/pull/self`);

    tdxwin.webContents.on('did-finish-load', () => {
        if (initialLoad) {
            const checkCondition = () => {
                tdxwin.webContents.executeJavaScript('document.body.innerText').then((result) => {
                    if (result.includes('{"id":')) {
                        try {
                            global.whoamiData = JSON.parse(result);
                            initialLoad = false;
							const login = () => {
								tdxwin.webContents.executeJavaScript(`fetch("${global.URL}/federated/login?tenant=OnPremise")`);
								setTimeout(login, 10000);
							};	
							login();
                        } catch (e) {
                            console.error('Error parsing JSON content:', e);
                        }
                    } else {
                        setTimeout(checkCondition, 100);
                    }
                }).catch(e => {
                    console.error('Error executing JavaScript in page:', e);
                });
            };
			const refreshIfLoading = () => {
                if (initialLoad) {
                    tdxwin.reload();
                }
            };

            setTimeout(refreshIfLoading, 5000);
            checkCondition();
        }
    });

    return tdxwin;
}
module.exports = createTdxWin;
