import { initializeDb } from './db'
import { dataSync } from './updates'

if (!module.parent) {
    try {
        initializeDb().then(() => {
            console.log('SQL Database initialized')
        }).then(dataSync)
    } catch (err) {
        console.log(err)
        console.log('Some error, OCL data not initialized')
    }
}
