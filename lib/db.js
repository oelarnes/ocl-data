"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getDb = getDb;
exports.getFreshDbConfig = getFreshDbConfig;
exports.addEventToConfig = addEventToConfig;
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

const CONFIG_PATH = 'config/ocl.ini';
let dbConfig;

try {
  dbConfig = _ini.default.parse((0, _fs.readFileSync)(CONFIG_PATH, 'utf-8'));
} catch (err) {
  console.log('No OCL config file found, OCL data will not work!');
}

function getDb() {
  return new _sqlite.Database(dbConfig.sqlite[process.env.OCL_ENV || 'test']);
}

function getFreshDbConfig() {
  return _ini.default.parse((0, _fs.readFileSync)(CONFIG_PATH, 'utf-8'));
}

function addEventToConfig(eventId, sheetId) {
  const config = getFreshDbConfig();
  config.eventSheets[eventId] = sheetId;
  (0, _fs.writeFileSync)(CONFIG_PATH, _ini.default.encode(config));
  return true;
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

async function initializeDb() {
  if (!(0, _fs.existsSync)('db')) {
    (0, _fs.mkdirSync)('db');
  }

  const db = getDb();
  const dbConfig = getFreshDbConfig();
  await new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(sql.dropEventTable).run(sql.dropEventExtraTable).run(sql.dropPlayerTable).run(sql.dropEntryTable).run(sql.dropEntryExtraTable).run(sql.dropPairingTable).run(sql.dropCubeTable).run(sql.dropPickTable).run(sql.dropMTGOCardTable).run(sql.createEventTable).run(sql.createEventExtraTable).run(sql.createEntryExtraTable).run(sql.createPlayerTable).run(sql.createPairingTable).run(sql.createCubeTable).run(sql.createPickTable).run(sql.createMTGOCardTable).run(sql.createEntryTable, [], err => {
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
  db.close();

  for (const tableName of ['event', 'entry', 'pairing', 'cube']) {
    await (0, _googleapi.getDataTable)(tableName, dbConfig.masterSheet.sheetId).then(async dataTable => {
      return executeInsertData(tableName, dataTable);
    });
  }

  const eventSheets = dbConfig.eventSheets;

  for (const eventId of Object.keys(eventSheets)) {
    await updateEventData(eventId, eventSheets[eventId]);
  }

  return;
}

async function updateEventData(eventId, sheetId) {
  await (0, _googleapi.writeEventId)(sheetId, eventId); // look for basic seatings. If no account assigned, then seatings originated from a draftlog and should be written to sheets.

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

  for (const tableName of ['player', 'event', 'entry', 'pairing']) {
    await (0, _googleapi.getDataTable)(tableName, sheetId).then(async dataTable => {
      return executeInsertData(tableName, dataTable);
    });
  }

  const todayString = new Date().toISOString(); // check pairings

  const newCompletedDates = await executeSelectSome(`SELECT * FROM pairing WHERE eventId = $eventId`, {
    $eventId: eventId
  }).then(rows => rows.map(row => (row.p1MatchWin || row.p2MatchWin) && row.completedDate > todayString ? [todayString] : [row.completedDate]));
  await (0, _googleapi.writePairingCompletedDate)(sheetId, newCompletedDates);
  const eventCompletedDate = await executeSelectOne(`SELECT completedDate FROM event WHERE id = $eventId`, {
    $eventId: eventId
  }, 'completedDate');

  if (eventCompletedDate > todayString && !newCompletedDates.filter(date => date > todayString).length) {
    await (0, _googleapi.writeEventCompletedDate)(sheetId);
    await (0, _googleapi.closeEntries)(sheetId);
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

async function executeInsertData(tableName, dataTable) {
  const pks = await executeSelectSome(`SELECT name FROM pragma_table_info($tableName) WHERE pk > 0`, {
    $tableName: tableName
  }, 'name');
  const extraTables = {
    event: 'eventExtra',
    entry: 'entryExtra'
  };
  const extraTable = extraTables[tableName];

  for (const row of dataTable) {
    if (pks.filter(pk => row[pk] === null || row[pk] === '').length == 0) {
      const {
        query,
        args
      } = insertStatement(tableName, row);

      if (extraTable === 'eventExtra') {
        const hasRow = await executeSelectOne(`SELECT 1 FROM eventExtra WHERE id = $eventId`, {
          $eventId: row.id
        });

        if (hasRow === undefined) {
          await executeRun('REPLACE INTO eventExtra(id) VALUES ($eventId)', {
            $eventId: row.id
          });
        }
      } else if (extraTable === 'entryExtra') {
        const hasRow = await executeSelectOne(`SELECT 1 FROM entryExtra WHERE eventId = $eventId AND playerId = $playerId`, {
          $eventId: row.eventId,
          $playerId: row.playerId
        });

        if (hasRow === undefined) {
          await executeRun('REPLACE INTO entryExtra(eventId, playerId) VALUES ($eventId, $playerId)', {
            $eventId: row.eventId,
            $playerId: row.playerId
          });
        }
      }

      await executeRun(query, args);
    }
  }
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