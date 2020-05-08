import sqlite3 from 'sqlite3';
import { getDataTable } from './googleapi';

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
import { processAllEventFiles } from './draftLogs';

const Database = sqlite3.Database
const DB_SPEC = process.env.SQLITE3 || ':memory:';

function getDb() {
    return new Database(DB_SPEC);
}

function executeSelectOne(query, args) {
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
    });
}

function executeSelectSome(query, args) {
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

async function initializeDb(rebuildPicks=false) {
    console.log(`Connecting to sqlite3 database at ${DB_SPEC}`);
    const db = getDb();

    await new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(dropEventTable)
                .run(dropPlayerTable)
                .run(dropEntryTable)
                .run(dropPairingTable)
                .run(dropCubeTable)
                .run(createEventTable)
                .run(createPlayerTable)
                .run(createPairingTable)
                .run(createCubeTable)
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
        return getDataTable(tableName).then((values) => {
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

    if (rebuildPicks) {
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run(dropPickTable)
                    .run(createPickTable, [], (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    })
            })
        }).catch(err => {
            console.log(err);
        });
    }

    db.close()
    
    if (rebuildPicks) {
        await processAllEventFiles(); 
    }

    return
}

function insertStatement(tableName, dataRow) {
    const keys = Object.keys(dataRow);
    const args = keys.map((k) => dataRow[k] === '' ? null : dataRow[k].replace(/\r/g, ''));

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
    executeSelectOne,
    executeSelectSome,
    executeInsertData,
    executeRun,
    initializeDb
}