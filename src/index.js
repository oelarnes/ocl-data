import http from 'http'

import express from 'express'

import { oclData } from './middleware'
import { initializeDb } from './db'
import { dataSync, dataSyncLoop } from './updates'

if (require.main === module) {
    const app = express()

    dataSyncLoop()

    app.use('/data', oclData)

    const server = http.createServer(app)

    server.listen(4000)
    console.log('GraphQL server started on port %s', (server.address()).port)
}

export { oclData, dataSync, dataSyncLoop, initializeDb }
