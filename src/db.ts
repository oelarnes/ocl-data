import sqlite3 from 'sqlite3';
import { getDataTable } from './googleapi';

import { queries } from './sqlTemplates';

const Database = sqlite3.Database
const db_spec = process.env.SQLITE3 || ':memory:';

function select_one_by_id(table: string, id: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const db = new Database(db_spec);
        db.get(`SELECT * FROM ${table} where id = ?`, id, (err: Error | null, row: object) => {
            if (err) {
                reject(err);
            }
            resolve(row);
        });
        db.close()
    });
}

function select_entry(playerId: string, eventId: string): Promise<object> {
    return new Promise((resolve, reject) => {
        const db = new Database(db_spec);
        db.get(queries.select_entry, {$playerId: playerId, $eventId: eventId}, (err: Error | null, row: object) => {
            if (err) {
                reject(err);
            }
            resolve(row);
        });
        db.close();
    });
}

function select_entries_by(
    byType: 'player' | 'event', 
    id: string, 
    howMany: number | undefined, 
    after: string | undefined, 
    orderDirection: 'ASC' | 'DESC' | undefined
): Promise<any> {
    const byTypeField = {
        player: 'playerId',
        event: 'eventId'
    }[byType];

    return new Promise((resolve, reject) => {
        const db = new Database(db_spec);

        let params = [id];

        let statement = `SELECT entry.*, event.draftDate 
            FROM entry join event on entry.eventId = event.id
            WHERE entry.${byTypeField} == ?`;

        orderDirection = orderDirection || 'ASC';

        if (after !== undefined) {
            let orderSymbol = ((orderDirection === 'ASC') ? '>' : '<');
            statement = statement + ` AND event.draftDate ${orderSymbol} ?`;
            params.push(after);
        }
        statement = statement + ` ORDER BY event.draftDate ${orderDirection}`;

        if (howMany !== undefined) {
            statement = statement + ` LIMIT ${howMany}`;
        }

        statement = statement + ';';
        db.all(statement, params, (err: any, rows: any) => {
            if (err) {
                reject(err);
            }
            resolve(rows)
        });
        db.close();
    })
}

function select_some_of_after(
    tableName: string, 
    after: string | undefined, 
    howMany: number | undefined, 
    orderBy: string | undefined, 
    orderDirection: 'ASC' | 'DESC' | null
) {
    return new Promise((resolve, reject) => {
        const db = new Database(db_spec);
        let params = [] as string[];

        let statement = `SELECT * from ${tableName}`;

        if (orderBy !== undefined) {
            orderDirection = orderDirection || 'ASC';

            if (after !== undefined) {
                let orderSymbol = ((orderDirection === 'ASC') ? '>' : '<');
                statement = statement + ` WHERE ${orderBy} ${orderSymbol} ?`;
                params = [after];
            }
            statement = statement + ` ORDER BY ${orderBy} ${orderDirection}`;
        }

        if (howMany !== undefined) {
            statement = statement + ` LIMIT ${howMany}`;
        }

        statement = statement + ';';
        
        db.all(statement, params, (err, rows) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows);
            }
        });
        db.close();
    });
}

function get_qps(playerId: string, season: string) {
    return new Promise((resolve, reject) => {
        const db = new Database(db_spec);
        db.get(queries.select_player_qps, [playerId, season], (err, row) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(row['qps'] || 0);
                }
            } 
        );
        db.close();
    })
}

function replace_statements(tableName: string) : (values: string[][]) => {query: string, params:string[]}[] {
    return function(values: string[][]): {query: string, params:string[]}[] {
        const keys: string[] = values[0];
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

async function initialize_db() {
    console.log(`Connecting to sqlite3 database at ${db_spec}`);
    const db = new Database(db_spec);
    
    await new Promise( (resolve, reject) => {
        db.serialize( () => {
            db.run(queries.drop_event_table)
                .run(queries.drop_player_table)
                .run(queries.drop_entry_table)
                .run(queries.drop_pairing_table)
                .run(queries.create_event_table)
                .run(queries.create_playery_table)
                .run(queries.create_pairing_table)
                .run(queries.create_entry_table, [], (err: any) => {
                    if(err) {
                        reject(err); 
                    } else {
                        resolve();
                    }           
                })
        });
    }).then(() => {
        return Promise.all(['player', 'event', 'entry', 'pairing'].map((tableName: string) => {
            return getDataTable(tableName).then((values: string[][]) => {
                return Promise.all(
                    replace_statements(tableName)(values).map(statement => {
                        return new Promise((resolve, reject) => {
                            db.run(statement.query, statement.params, function(err: any) {
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
    });
     
    db.close()
}

export {
    select_one_by_id,
    select_entry,
    select_entries_by,
    select_some_of_after,
    get_qps,
    initialize_db
}