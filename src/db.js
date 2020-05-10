import sqlite3 from 'sqlite3';
import { getDataTable, writePairingCompletedDate, writeEventCompletedDate, closeEntries } from './googleapi';
import ini from 'ini';
import { readFileSync } from 'fs';

import {
    dropEntryTable,
    dropEventTable,
    dropPairingTable,
    dropPlayerTable,
    dropPickTable,
    dropCubeTable,
    createEntryTable,
    createEventTable,
    createPairingTable,
    createPlayerTable,
    createPickTable,
    createCubeTable
} from './sqlTemplates';

const Database = sqlite3.Database
function getDb() {
    return new Database(getDbConfig().dbSpec[process.env.OCL_ENV || 'test']);
}

function getDbConfig() {
    return ini.parse(readFileSync('./data/env.ini', 'utf-8'));
}

function executeSelectOne(query, args, extractProp) {
    const db = getDb();

    return new Promise((resolve, reject) => {
        db.get(`${query};`, args, (err, row) => {
            if (err) {
                reject(err);
            }
            resolve(row);
        });
        db.close();
    }).catch((err) => {
        console.log(err);
    }).then(row => {
        if (extractProp !== undefined) {
            return row?.[extractProp]
        } else {
            return row
        }
    });
}

function executeSelectSome(query, args, extractProp) {
    const db = getDb();
    return new Promise((resolve, reject) => {

        db.all(`${query};`, args, (err, rows) => {
            if (err) {
                reject(err);
            }
            resolve(rows);
        });
        db.close();
    }).catch((err) => {
        console.log(err);
    }).then(rows => {
        if (extractProp !== undefined) {
            return rows.map(row => row[extractProp]);
        } else {
            return rows
        }
    });
}

function replaceStatements(tableName) {
    return function (values) {
        const keys = values[0];
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
    const db = getDb();
    const dbConfig = getDbConfig();

    await new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(dropEventTable)
                .run(dropPlayerTable)
                .run(dropEntryTable)
                .run(dropPairingTable)
                .run(dropCubeTable)
                .run(dropPickTable)
                .run(createEventTable)
                .run(createPlayerTable)
                .run(createPairingTable)
                .run(createCubeTable)
                .run(createPickTable)
                .run(createEntryTable, [], (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                })
        });
    }).catch(err => {
        console.log(err);
    });

    await Promise.all(['player', 'event', 'entry', 'pairing', 'cube'].map((tableName) => {
        return getDataTable(tableName, dbConfig.masterSheet.sheetId).then((values) => {
            return Promise.all(
                replaceStatements(tableName)(values).map(statement => {
                    return new Promise((resolve, reject) => {
                        db.run(statement.query, statement.params, function (err) {
                            if (err) {
                                reject(err)
                            }
                            resolve()
                        });
                    }).catch(err => {
                        console.log(err);
                    })
                })
            );
        });
    }));

    db.close()

    const eventSheets = dbConfig.eventSheets;

    for (const sheetId of Object.values(eventSheets)) {
        await updateEventData(sheetId);
    }

    return
}

async function updateEventData(sheetId) {
    const db = getDb();
    let eventId;
    for (const tableName of ['event', 'entry', 'pairing']) {
        await getDataTable(tableName, sheetId).then((values) => {
            if (tableName === 'event') {
                eventId = values[1][0].trim();
            }
            return Promise.all(
                replaceStatements(tableName)(values).map(statement => {
                    return new Promise((resolve, reject) => {
                        db.run(statement.query, statement.params, function (err) {
                            if (err) {
                                reject(err)
                            }
                            resolve()
                        });
                    }).catch(err => {
                        console.log(err);
                    })
                })
            )
        });
    }
    db.close();

    const todayString = new Date().toISOString();
    // check pairings
    const newCompletedDates = await executeSelectSome(`SELECT * FROM pairing WHERE eventId = $eventId`, { $eventId: eventId }).then(rows => rows.map((row) =>
        ((row.p1MatchWin || row.p2MatchWin) && row.completedDate > todayString) ? [todayString] : [row.completedDate]
    ));

    await writePairingCompletedDate(sheetId, newCompletedDates);

    if (!newCompletedDates.filter(date => date > todayString).length) {
        writeEventCompletedDate(sheetId);
        closeEntries(sheetId);
    }

    return;
}

function insertStatement(tableName, dataRow) {
    const keys = Object.keys(dataRow);
    const args = keys.map((k) => dataRow[k] === '' ? null : dataRow[k]);

    const query = `REPLACE INTO 
        ${tableName}(${keys.join(', ')})
    VALUES
        (${new Array(keys.length).fill('?').join(", ")});
    `;

    return {
        query,
        args
    }
}

function executeInsertData(tableName, dataTable) {
    const db = getDb();

    return Promise.all(dataTable.map((row) => {
        const { query, args } = insertStatement(tableName, row);
        return new Promise((resolve, reject) => {
            db.run(query, args, (err) => {
                if (err) {
                    reject(err)
                }
                resolve();
            });
        });
    })).then(() => {
        db.close()
    }).catch((err) => {
        console.log(err);
        db.close()
    });
}

function executeRun(statement, args) {
    const db = getDb();

    return new Promise((resolve, reject) => {
        db.run(`${statement};`, args, (err) => {
            if (err) {
                reject(err);
            }
            resolve()
        })
        db.close();
    }).catch((err) => {
        console.log(err);
        db.close();
    });
}

export {
    getDb,
    getDbConfig,
    executeSelectOne,
    executeSelectSome,
    executeInsertData,
    executeRun,
    initializeDb,
    updateEventData
}