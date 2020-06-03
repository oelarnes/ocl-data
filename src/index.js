import http from 'http'

import express from 'express'

import { oclData } from './middleware'
import { initializeDb, oclMongo } from './db'
import { syncData, dataSyncLoop } from './updates'
import { getIdForHandle } from './direct'

if (require.main === module) {
    const app = express()

    dataSyncLoop()

    app.use('/data', oclData)

    const server = http.createServer(app)

    server.listen(4000)
    console.log('GraphQL server started on port %s', (server.address()).port)
}

export { oclData, oclMongo, syncData, dataSyncLoop, initializeDb, getIdForHandle }