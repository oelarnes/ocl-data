import express from 'express'
import http from 'http'

import {initializeDb} from './db'
import {middleware} from './middleware'
import { dataSyncLoop } from './updates'

if (require.main === module) {
    const app = express()
        
    // initializeDb().then(() => {
    //     console.log('SQL Database initialized')
    // }).then(dataSyncLoop)
 
    dataSyncLoop()

    app.use('/data', middleware)

    const server = http.createServer(app) 

    server.listen(4010) 
    console.log('GraphQL server started on port %s', (server.address()).port) 
} 

export {middleware}
