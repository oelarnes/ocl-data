"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getDb = getDb;
exports.getFreshDbConfig = getFreshDbConfig;
exports.executeSelectOne = executeSelectOne;
exports.executeSelectSome = executeSelectSome;
exports.executeInsertData = executeInsertData;
exports.executeRun = executeRun;
exports.initializeDb = initializeDb;
exports.oclMongo = oclMongo;
exports.updateEventData = updateEventData;

var _fs = require("fs");

var _sqlite = require("sqlite3");

var _ini = _interopRequireDefault(require("ini"));

var _googleapi = require("./googleapi");

var sql = _interopRequireWildcard(require("./sqlTemplates"));

var _mongodb = require("mongodb");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

let dbConfig;

try {
  dbConfig = _ini.default.parse((0, _fs.readFileSync)('./config/ocl.ini', 'utf-8'));
} catch (err) {
  console.log('No OCL config file found, OCL data will not work!');
}

function getDb() {
  return new _sqlite.Database(dbConfig.sqlite[process.env.OCL_ENV || 'test']);
}

function getFreshDbConfig() {
  return _ini.default.parse((0, _fs.readFileSync)('./config/ocl.ini', 'utf-8'));
}

function oclMongo() {
  return _mongodb.MongoClient.connect('mongodb://localhost:27017', {
    useUnifiedTopology: true
  }).then(client => client.db(dbConfig.mongo[process.env.OCL_ENV || 'test']));
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
  }).catch(err => {
    console.log(err);
  }).then(row => {
    if (extractProp !== undefined) {
      return row === null || row === void 0 ? void 0 : row[extractProp];
    } else {
      return row;
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
  }).catch(err => {
    console.log(err);
  }).then(rows => {
    if (extractProp !== undefined) {
      return rows.map(row => row[extractProp]);
    } else {
      return rows;
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
    }));
  };
}

async function initializeDb() {
  const db = getDb();
  const dbConfig = getFreshDbConfig();
  await new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(sql.dropEventTable).run(sql.dropPlayerTable).run(sql.dropEntryTable).run(sql.dropPairingTable).run(sql.dropCubeTable).run(sql.dropPickTable).run(sql.dropMTGOCardTable).run(sql.createEventTable).run(sql.createPlayerTable).run(sql.createPairingTable).run(sql.createCubeTable).run(sql.createPickTable).run(sql.createMTGOCardTable).run(sql.createEntryTable, [], err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }).catch(err => {
    console.log(err);
  });

  for (const tableName of ['player', 'event', 'entry', 'pairing', 'cube']) {
    await (0, _googleapi.getDataTable)(tableName, dbConfig.masterSheet.sheetId).then(values => {
      return Promise.all(replaceStatements(tableName)(values).map(statement => {
        return new Promise((resolve, reject) => {
          db.run(statement.query, statement.params, function (err) {
            if (err) {
              reject(err);
            }

            resolve();
          });
        }).catch(err => {
          console.log(err);
        });
      }));
    });
  }

  db.close();
  const eventSheets = dbConfig.eventSheets;

  for (const eventId of Object.keys(eventSheets)) {
    await updateEventData(eventId, eventSheets[eventId]);
  }

  return;
}

async function updateEventData(eventId, sheetId) {
  await (0, _googleapi.writeEventId)(sheetId, eventId);
  const db = getDb(); // look for basic seatings. If no account assigned, then seatings originated from a draftlog and should be written to sheets.

  const seatings = await executeSelectSome(`SELECT playerId, seatNum FROM entry WHERE eventId=$eventId AND account IS NULL ORDER BY seatNum ASC`, {
    $eventId: eventId
  });

  if (seatings.length === 8) {
    let invalidateSeatings = false;
    let insertPlayerIds = [];
    seatings.forEach((row, index) => {
      if (!invalidateSeatings && row.seatNum == index + 1) {
        insertPlayerIds.push([row.playerId]);
      } else {
        invalidateSeatings = true;
      }
    });

    if (!invalidateSeatings) {
      await (0, _googleapi.writeSeatingsToSheet)(sheetId, insertPlayerIds);
    } else {
      console.log(`Invalid seatings found for event ${eventId}! Reading sheet without updating seats.`);
    }
  }

  for (const tableName of ['event', 'entry', 'pairing']) {
    await (0, _googleapi.getDataTable)(tableName, sheetId).then(async values => {
      const statements = replaceStatements(tableName)(values);

      for (const statement of statements) {
        await new Promise((resolve, reject) => {
          db.run(statement.query, statement.params, function (err) {
            if (err) {
              reject(err);
            }

            resolve();
          });
        }).catch(err => {
          console.log(err);
        });
      }
    });
  }

  db.close();
  const todayString = new Date().toISOString(); // check pairings

  const newCompletedDates = await executeSelectSome(`SELECT * FROM pairing WHERE eventId = $eventId`, {
    $eventId: eventId
  }).then(rows => rows.map(row => (row.p1MatchWin || row.p2MatchWin) && row.completedDate > todayString ? [todayString] : [row.completedDate]));
  await (0, _googleapi.writePairingCompletedDate)(sheetId, newCompletedDates);
  const eventCompletedDate = await executeSelectOne(`SELECT completedDate FROM event WHERE id = $eventId`, {
    $eventId: eventId
  }, 'completedDate');

  if (eventCompletedDate > todayString && !newCompletedDates.filter(date => date > todayString).length) {
    (0, _googleapi.writeEventCompletedDate)(sheetId);
    (0, _googleapi.closeEntries)(sheetId);
  }

  return;
}

function insertStatement(tableName, dataRow) {
  const keys = Object.keys(dataRow);
  const args = keys.map(k => dataRow[k] === '' ? null : dataRow[k]);
  const query = `REPLACE INTO 
        ${tableName}(${keys.join(', ')})
    VALUES
        (${new Array(keys.length).fill('?').join(", ")});
    `;
  return {
    query,
    args
  };
}

function executeInsertData(tableName, dataTable) {
  const db = getDb();
  return Promise.all(dataTable.map(row => {
    const {
      query,
      args
    } = insertStatement(tableName, row);
    return new Promise((resolve, reject) => {
      db.run(query, args, function (err) {
        if (err) {
          reject(err);
        }

        resolve(this.lastID);
      });
    });
  })).then(ids => {
    db.close();
    return ids.length;
  }).catch(err => {
    console.log(err);
    db.close();
  });
}

function executeRun(statement, args) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    db.run(`${statement};`, args, err => {
      if (err) {
        reject(err);
      }

      resolve();
    });
    db.close();
  }).catch(err => {
    console.log(err);
    db.close();
  });
}