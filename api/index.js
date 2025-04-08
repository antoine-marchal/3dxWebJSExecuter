const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const server = express();
const PORT = 3000;

server.use(bodyParser.json());
server.use(bodyParser.urlencoded({ extended: true }));

const routesDirectory = path.join(__dirname, 'routes');
const apiRouter = express.Router(); // Create a router for API routes

function loadRoutes() {
    // Empty the existing router of all routes
    apiRouter.stack = [];

    fs.readdir(routesDirectory, (err, files) => {
        if (err) {
            console.error('Failed to list contents of directory: ' + err);
            return;
        }

        files.forEach(file => {
            if (file.endsWith('.js')) {
                const routePath = `/${path.basename(file, '.js')}`;
                // Remove the route from cache
                delete require.cache[require.resolve(path.join(routesDirectory, file))];
                // Require the new version of the route
                const route = require(path.join(routesDirectory, file));
                apiRouter.use(routePath, route);
                console.log(`Route configured for ${routePath}`);
            }
        });
    });
}

loadRoutes(); // Initial load of routes

server.use('/', apiRouter); // Mount the API router on the '/api' path

// No need for fs.watch if using a tool like nodemon during development
fs.watch(routesDirectory, (eventType, filename) => {
    if (filename) {
        console.log(`${filename} has been modified or changed, reloading routes...`);
        loadRoutes();
    }
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
