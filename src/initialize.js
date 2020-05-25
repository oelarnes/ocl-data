import { initializeDb } from './db'
import { syncData } from './updates'

if (!module.parent) {
    try {
        initializeDb().then(() => {
            console.log('SQL Database initialized')
        }).then(syncData)
    } catch (err) {
        console.log(err)
        console.log('Some error, OCL data not initialized')
    }
}
