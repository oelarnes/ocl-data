import express from 'express';
import http from 'http';

import {initialize_db} from './src/db'
import {middleware} from './src/middleware'

const app = express();

initialize_db().then(() => {
    console.log('SQL Database initialized'); 
})

app.use('/data', middleware);

const server = http.createServer(app) as http.Server;

server.listen(4000);
console.log('GraphQL server started on port %s', (server.address() as any).port);