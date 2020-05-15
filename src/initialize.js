import { initializeDb } from './db'
import { dataSync } from './updates'

if (!module.parent) {
    initializeDb().then(() => {
        console.log('SQL Database initialized')
    }).then(dataSync)
}
