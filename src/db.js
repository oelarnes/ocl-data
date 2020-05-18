import { readFileSync } from 'fs'

import { Database } from 'sqlite3'
import ini from 'ini'

import { getDataTable, writePairingCompletedDate, writeEventCompletedDate, closeEntries } from './googleapi'
import * as sql from './sqlTemplates'
import { MongoClient } from 'mongodb'

const dbConfig = ini.parse(readFileSync('./data/env.ini', 'utf-8'))
function getDb() {
    return new Database(dbConfig.sqlite[process.env.OCL_ENV || 'test'])
}

function getFreshDbConfig() {
    return ini.parse(readFileSync('./data/env.ini', 'utf-8'))
}

function oclMongo() {
    return MongoClient.connect(dbConfig.mongo.uri, { useUnifiedTopology: true }).then(client => client.db(dbConfig.mongo[process.env.OCL_ENV || 'test']))
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

function replaceStatements(tableName) {
    return function (values) {
        const keys = values[0]
        return values.slice(1).map(row => ({
            query: `
            REPLACE INTO 
                ${tableName}(${keys.join(', ')})
            VALUES  
                (${new Array(row.length).fill('?').join(", ")}); 
            `,
            params: row.map(val => val === '' ? null : val.replace(/\r/g, ''))
        }))
    }
}

async function initializeDb() {
    const db = getDb()
    const dbConfig = getFreshDbConfig()

    await new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(sql.dropEventTable)
                .run(sql.dropPlayerTable)
                .run(sql.dropEntryTable)
                .run(sql.dropPairingTable)
                .run(sql.dropCubeTable)
                .run(sql.dropPickTable)
                .run(sql.dropMTGOCardTable)
                .run(sql.createEventTable)
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

    for (const tableName of ['player', 'event', 'entry', 'pairing', 'cube']) {
        await getDataTable(tableName, dbConfig.masterSheet.sheetId).then((values) => {
            return Promise.all(
                replaceStatements(tableName)(values).map(statement => {
                    return new Promise((resolve, reject) => {
                        db.run(statement.query, statement.params, function (err) {
                            if (err) {
                                reject(err)
                            }
                            resolve()
                        })
                    }).catch(err => {
                        console.log(err)
                    })
                })
            )
        });
    }

    db.close()

    const eventSheets = dbConfig.eventSheets

    for (const sheetId of Object.values(eventSheets)) {
        await updateEventData(sheetId)
    }

    return
}

async function updateEventData(sheetId) {
    const db = getDb()
    let eventId
    for (const tableName of ['event', 'entry', 'pairing']) {
        await getDataTable(tableName, sheetId).then(async (values) => {
            if (tableName === 'event') {
                eventId = values[1][0].trim()
            }
            const statements = replaceStatements(tableName)(values)
            for (const statement of statements) {
                await new Promise((resolve, reject) => {
                    db.run(statement.query, statement.params, function (err) {
                        if (err) {
                            reject(err)
                        }
                        resolve()
                    })
                }).catch(err => {
                    console.log(err)
                })
            }
        })
    }
    db.close()


    const todayString = new Date().toISOString()
    // check pairings
    const newCompletedDates = await executeSelectSome(`SELECT * FROM pairing WHERE eventId = $eventId`, { $eventId: eventId }).then(rows => rows.map((row) =>
        ((row.p1MatchWin || row.p2MatchWin) && row.completedDate > todayString) ? [todayString] : [row.completedDate]
    ))

    await writePairingCompletedDate(sheetId, newCompletedDates)

    const eventCompletedDate = await executeSelectOne(`SELECT completedDate FROM event WHERE id = $eventId`, { $eventId: eventId }, 'completedDate')

    if (eventCompletedDate > todayString && !newCompletedDates.filter(date => date > todayString).length) {
        writeEventCompletedDate(sheetId)
        closeEntries(sheetId)
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

function executeInsertData(tableName, dataTable) {
    const db = getDb()

    return Promise.all(dataTable.map((row) => {
        const { query, args } = insertStatement(tableName, row)
        return new Promise((resolve, reject) => {
            db.run(query, args, function(err) {
                if (err) {
                    reject(err)
                }
                resolve(this.lastID)
            })
        })
    })).then((ids) => {
        db.close()
        return ids.length
    }).catch((err) => {
        console.log(err)
        db.close()
    })
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
    executeSelectOne,
    executeSelectSome,
    executeInsertData,
    executeRun,
    initializeDb,
    oclMongo,
    updateEventData
}