import express from 'express';
import http from 'http';

import {initializeDb} from './db';
import {middleware} from './middleware';

const app = express();

initializeDb().then(() => {
    console.log('SQL Database initialized'); 
})

app.use('/data', middleware);

const server = http.createServer(app);

server.listen(4001); 
console.log('GraphQL server started on port %s', (server.address()).port); 