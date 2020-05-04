import sqlite3 from 'sqlite3';
import { getDataTable } from './googleapi';

import {
    dropEntryTable,
    dropEventTable,
    dropPairingTable,
    dropPlayerTable,
    createEntryTable,
    createEventTable,
    createPairingTable,
    createPlayerTable
} from './sqlTemplates';

const Database = sqlite3.Database
const DB_SPEC = process.env.SQLITE3 || ':memory:';

function getDb() {
    return new Database(DB_SPEC);
}

function executeSelectOne(query, args) {
    return new Promise((resolve, reject) => {
        const db = getDb();
        db.get(`${query};`, args, (err, row) => {
            if (err) {
                reject(err);
            }
            resolve(row);
        });
        db.close();
    });
}

function executeSelectSome(query, args) {
    return new Promise((resolve, reject) => {
        const db = getDb();
        db.all(`${query};`, args, (err, rows) => {
            if (err) {
                reject(err);
            }
            resolve(rows);
        });
        db.close();
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
            params: row
        }))
    }
}

async function initializeDb() {
    console.log(`Connecting to sqlite3 database at ${DB_SPEC}`);
    const db = getDb();

    await new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(dropEventTable)
                .run(dropPlayerTable)
                .run(dropEntryTable)
                .run(dropPairingTable)
                .run(createEventTable)
                .run(createPlayerTable)
                .run(createPairingTable)
                .run(createEntryTable, [], (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                })
        });
    });

    await Promise.all(['player', 'event', 'entry', 'pairing'].map((tableName) => {
        return getDataTable(tableName).then((values) => {
            return Promise.all(
                replaceStatements(tableName)(values).map(statement => {
                    return new Promise((resolve, reject) => {
                        db.run(statement.query, statement.params, function (err) {
                            if (err) {
                                reject(err)
                            }
                            resolve()
                        })
                    })
                })
            );
        });
    }));

    return db.close()
}

function insertStatement(tableName, dataRow) {
    const keys = Object.keys(dataRow);
    const args = keys.map((k) => dataRow[k]);

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
    });
}

export {
    getDb,
    executeSelectOne,
    executeSelectSome,
    executeInsertData,
    initializeDb
}