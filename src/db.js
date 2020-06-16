import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'

import { Database } from 'sqlite3'
import ini from 'ini'

import { getDataTable, writePairingCompletedDate, writeEventCompletedDate, closeEntries, writeEventId, writeSeatingsToSheet } from './googleapi'
import * as sql from './sqlTemplates'
import { MongoClient } from 'mongodb'

const CONFIG_PATH = 'config/ocl.ini'

let dbConfig;
try {
    dbConfig = ini.parse(readFileSync(CONFIG_PATH, 'utf-8'))
} catch (err) {
    console.log('No OCL config file found, OCL data will not work!')
}

function getDb() {
    return new Database(dbConfig.sqlite[process.env.OCL_ENV || 'test'])
}

function getFreshDbConfig() {
    return ini.parse(readFileSync(CONFIG_PATH, 'utf-8'))
}

function addEventToConfig(eventId, sheetId) {
    const config = getFreshDbConfig();
    config.eventSheets[eventId] = sheetId
    writeFileSync(CONFIG_PATH, ini.encode(config))
    return true
}

function oclMongo() {
    return MongoClient.connect('mongodb://localhost:27017', { useUnifiedTopology: true }).then(client => client.db(dbConfig.mongo[process.env.OCL_ENV || 'test']))
}

function executeSelectOne(query, args, extractProp) {
    const db = getDb()

    return new Promise((resolve, reject) => {
        db.get(`${query};`, args, (err, row) => {
            if (err) {
                reject(err)
            }
            resolve(row)
        })
        db.close()
    }).catch((err) => {
        console.log(err)
    }).then(row => {
        if (extractProp !== undefined) {
            return row?.[extractProp]
        } else {
            return row
        }
    })
}

function executeSelectSome(query, args, extractProp) {
    const db = getDb()
    return new Promise((resolve, reject) => {

        db.all(`${query};`, args, (err, rows) => {
            if (err) {
                reject(err)
            }
            resolve(rows)
        })
        db.close()
    }).catch((err) => {
        console.log(err)
    }).then(rows => {
        if (extractProp !== undefined) {
            return rows.map(row => row[extractProp])
        } else {
            return rows
        }
    })
}

async function initializeDb() {
    if (!existsSync('db')) {
        mkdirSync('db')
    }
    const db = getDb()
    const dbConfig = getFreshDbConfig()

    await new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(sql.dropEventTable)
                .run(sql.dropEventExtraTable)
                .run(sql.dropPlayerTable)
                .run(sql.dropEntryTable)
                .run(sql.dropEntryExtraTable)
                .run(sql.dropPairingTable)
                .run(sql.dropCubeTable)
                .run(sql.dropPickTable)
                .run(sql.dropMTGOCardTable)
                .run(sql.createEventTable)
                .run(sql.createEventExtraTable)
                .run(sql.createEntryExtraTable)
                .run(sql.createPlayerTable)
                .run(sql.createPairingTable)
                .run(sql.createCubeTable)
                .run(sql.createPickTable)
                .run(sql.createMTGOCardTable)
                .run(sql.createEntryTable, [], (err) => {
                    if (err) {
                        reject(err)
                    } else {
                        resolve()
                    }
                })
        })
    }).catch(err => {
        console.log(err)
    })
    db.close()

    for (const tableName of ['event', 'entry', 'pairing', 'cube']) {
        await getDataTable(tableName, dbConfig.masterSheet.sheetId).then(async (dataTable) => {
            return executeInsertData(tableName, dataTable)
        })
    }

    const eventSheets = dbConfig.eventSheets

    for (const eventId of Object.keys(eventSheets)) {
        await updateEventData(eventId, eventSheets[eventId])
    }

    return
}

async function updateEventData(eventId, sheetId) {
    await writeEventId(sheetId, eventId)

    // look for basic seatings. If no account assigned, then seatings originated from a draftlog and should be written to sheets.
    const seatings = await executeSelectSome(`SELECT playerId, seatNum FROM entry WHERE eventId=$eventId AND account IS NULL ORDER BY seatNum ASC`, {$eventId: eventId})
    if (seatings.length === 8) {
        let invalidateSeatings = false
        let insertPlayerIds = []
        seatings.forEach((row, index) => {
            if (!invalidateSeatings && row.seatNum == index + 1) {
                insertPlayerIds.push([row.playerId])
            } else {
                invalidateSeatings = true
            }
        })
        if (!invalidateSeatings) {
            await writeSeatingsToSheet(sheetId, insertPlayerIds)
        } else {
            console.log(`Invalid seatings found for event ${eventId}! Reading sheet without updating seats.`)
        }
    }

    for (const tableName of ['player', 'event', 'entry', 'pairing']) {
        await getDataTable(tableName, sheetId).then(async (dataTable) => {
            return executeInsertData(tableName, dataTable)
        })
    }

    const todayString = new Date().toISOString()
    // check pairings
    const newCompletedDates = await executeSelectSome(`SELECT * FROM pairing WHERE eventId = $eventId`, { $eventId: eventId }).then(rows => rows.map((row) =>
        ((row.p1MatchWin || row.p2MatchWin) && row.completedDate > todayString) ? [todayString] : [row.completedDate]
    ))

    await writePairingCompletedDate(sheetId, newCompletedDates)

    const eventCompletedDate = await executeSelectOne(`SELECT completedDate FROM event WHERE id = $eventId`, { $eventId: eventId }, 'completedDate')

    if (eventCompletedDate > todayString && !newCompletedDates.filter(date => date > todayString).length) {
        await writeEventCompletedDate(sheetId)
        await closeEntries(sheetId)
    }

    return
}

function insertStatement(tableName, dataRow) {
    const keys = Object.keys(dataRow)
    const args = keys.map((k) => dataRow[k] === '' ? null : dataRow[k])

    const query = `REPLACE INTO 
        ${tableName}(${keys.join(', ')})
    VALUES
        (${new Array(keys.length).fill('?').join(", ")});
    `

    return {
        query,
        args
    }
}

async function executeInsertData(tableName, dataTable) {
    const pks = await executeSelectSome(`SELECT name FROM pragma_table_info($tableName) WHERE pk > 0`, {$tableName: tableName}, 'name')
    const extraTables = {
        event: 'eventExtra',
        entry: 'entryExtra'
    }
    const extraTable = extraTables[tableName]

    for (const row of dataTable) {
        if (pks.filter(pk => row[pk] === null || row[pk] === '').length == 0) {
            const { query, args } = insertStatement(tableName, row)
            if (extraTable === 'eventExtra') {
                const hasRow = await executeSelectOne(`SELECT 1 FROM eventExtra WHERE id = $eventId`, {$eventId: row.id})
                if (hasRow === undefined) {
                    await executeRun('REPLACE INTO eventExtra(id) VALUES ($eventId)', {$eventId: row.id})
                }
            } else if (extraTable === 'entryExtra') {
                const hasRow = await executeSelectOne(`SELECT 1 FROM entryExtra WHERE eventId = $eventId AND playerId = $playerId`, {$eventId: row.eventId, $playerId: row.playerId})
                if (hasRow === undefined) {
                    await executeRun('REPLACE INTO entryExtra(eventId, playerId) VALUES ($eventId, $playerId)', {$eventId: row.eventId, $playerId: row.playerId})
                }
            }
    
            await executeRun(query, args)
        }
    }
}

function executeRun(statement, args) {
    const db = getDb()

    return new Promise((resolve, reject) => {
        db.run(`${statement};`, args, (err) => {
            if (err) {
                reject(err)
            }
            resolve()
        })
        db.close()
    }).catch((err) => {
        console.log(err)
        db.close()
    })
}

export {
    getDb,
    getFreshDbConfig,
    addEventToConfig,
    executeSelectOne,
    executeSelectSome,
    executeInsertData,
    executeRun,
    initializeDb,
    oclMongo,
    updateEventData
}
