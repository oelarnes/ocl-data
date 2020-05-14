import http from 'http'

import express from 'express'

import { initializeDb } from './db'
import { middleware } from './middleware'
import { dataSyncLoop } from './updates'

if (require.main === module) {
    const app = express()

    dataSyncLoop()

    app.use('/data', middleware)

    const server = http.createServer(app)

    server.listen(4000)
    console.log('GraphQL server started on port %s', (server.address()).port)
}

export { middleware }
