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
const db_spec = process.env.SQLITE3 || ':memory:';

function executeSelectOne(query, args) {
    return new Promise((resolve, reject) => {
        const db = new Database(db_spec);
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
        const db = new Database(db_spec);
        db.all(`${query};`, args, (err, rows) => {
            if (err) {
                reject(err);
            }
            resolve(rows);
        });
        db.close();
    });
}

function replace_statements(tableName) {
    return function(values) {
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
}}

async function initializeDb() {
    console.log(`Connecting to sqlite3 database at ${db_spec}`);
    const db = new Database(db_spec);
    
    await new Promise( (resolve, reject) => {
        db.serialize( () => {
            db.run(dropEventTable)
                .run(dropPlayerTable)
                .run(dropEntryTable)
                .run(dropPairingTable)
                .run(createEventTable)
                .run(createPlayerTable)
                .run(createPairingTable)
                .run(createEntryTable, [], (err) => {
                    if(err) {
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
                replace_statements(tableName)(values).map(statement => {
                    return new Promise((resolve, reject) => {
                        db.run(statement.query, statement.params, function(err) {
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

    await uploadAllDraftLogs();

    db.close()
}

function insertStatement(tableName, dataRow){
    const keys = dataRow.keys();
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
    const db = new Database(db_spec);

    db.serialize(() => {
        dataTable.forEach((row) => {
            const {query, args} = insertStatement(tableName, row)
            db.run(query, args);
        })
    });
    db.close();
}

export {
    executeSelectOne,
    executeSelectSome,
    executeInsertData,
    initializeDb
}