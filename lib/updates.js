"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.processAllEventFiles = processAllEventFiles;
exports.processLog = processLog;
exports.processDeck = processDeck;
exports.fileIsDecklist = fileIsDecklist;
exports.fileIsDraftLog = fileIsDraftLog;
exports.dataSyncLoop = dataSyncLoop;
exports.syncData = syncData;

var _fs = require("fs");

var _path = _interopRequireDefault(require("path"));

var _xml2js = require("xml2js");

var _db = require("./db");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const DATA_FOLDER = './data';
const SELECTION_REGEX = /--> (.*)/;
const CARD_ROW_REGEX = /^[0-9]* (.*)/;
const BASIC_REGEX = /^[0-9]* (Plains|Island|Swamp|Mountain|Forest)$/;

async function importDekFiles() {
  const dekSources = (0, _db.getFreshDbConfig)().dekFiles;
  const knownSources = await (0, _db.executeSelectSome)(`SELECT DISTINCT dekSource FROM mtgoCard`, {}, 'dekSource');

  if (Object.values(dekSources).filter(source => !knownSources.includes(source)).length) {
    console.log('Processing new collection dek files: %s', Object.values(dekSources).join('\n'));
    const ownedCardRows = await (0, _xml2js.parseStringPromise)((0, _fs.readFileSync)(_path.default.join(DATA_FOLDER, dekSources.owned))).then(result => result.Deck.Cards.map(card => ({
      id: card.$.CatID,
      numOwned: card.$.Quantity,
      numWishlist: 0,
      mtgoName: card.$.Name,
      dekSource: dekSources.owned
    })));
    const wishlistCardRows = await (0, _xml2js.parseStringPromise)((0, _fs.readFileSync)(_path.default.join(DATA_FOLDER, dekSources.wishlist))).then(result => result.Deck.Cards.map(card => ({
      id: card.$.CatID,
      numOwned: 0,
      numWishlist: card.$.Quantity,
      mtgoName: card.$.Name,
      dekSource: dekSources.wishlist
    })));
    const rowMap = ownedCardRows.concat(wishlistCardRows).reduce((prev, curr) => {
      prev[curr.id] = curr;
      return prev;
    }, {});
    const insertRowsTemp = await extendMtgoRows(rowMap);
    const missingCards = Object.keys(rowMap).filter(v => !insertRowsTemp.map(row => row.id.toString()).includes(v));
    let insertRows = insertRowsTemp; // a few cards are missing from Scryfall by mtgo_id

    if (missingCards.length < 0.01 * insertRows.length) {
      insertRows = insertRowsTemp.concat(missingCards.map(idString => {
        const dekRow = rowMap[idString];
        return { ...dekRow,
          name: dekRow.mtgoName,
          tix: null,
          isFoil: false
        };
      }));
    }

    if (insertRows.length === Object.keys(rowMap).length) {
      await (0, _db.executeRun)(`DELETE FROM mtgoCard`);
      await (0, _db.executeInsertData)('mtgoCard', insertRows);
    } else {
      console.log('Insufficient matching card data found, mtgoCard not updated');
      console.log(missingCards);
    }
  }

  return;
}

async function extendMtgoRows(rowMap) {
  const mtgoIds = Object.keys(rowMap).map(key => parseInt(key));
  const mongo = await (0, _db.oclMongo)();
  const rows = await mongo.collection('all_cards').find({
    mtgoId: {
      $in: mtgoIds
    },
    side: {
      $ne: 'b'
    }
  }).toArray();
  return rows.map(row => {
    var _row$prices, _Object$values, _row$prices2, _Object$keys;

    const baseRow = rowMap[row.mtgoId.toString()];
    return { ...baseRow,
      name: ['split', 'aftermath'].includes(row.layout) ? row.names.join(' // ') : row.name,
      tix: ((_row$prices = row.prices) === null || _row$prices === void 0 ? void 0 : _row$prices.mtgo) !== undefined ? (_Object$values = Object.values(row.prices.mtgo)) === null || _Object$values === void 0 ? void 0 : _Object$values[0] : undefined,
      tixAsOf: ((_row$prices2 = row.prices) === null || _row$prices2 === void 0 ? void 0 : _row$prices2.mtgo) !== undefined ? (_Object$keys = Object.keys(row.prices.mtgo)) === null || _Object$keys === void 0 ? void 0 : _Object$keys[0] : undefined,
      isFoil: false
    };
  });
}

async function syncData() {
  console.log('%s Looking for new source files and updating open events...', new Date().toISOString());
  const dbConfig = (0, _db.getFreshDbConfig)();
  const knownEventIds = await (0, _db.executeSelectSome)(`SELECT id FROM event`, {}, 'id'); // first make sure there are event folders for every event in the config

  const newEvents = Object.keys(dbConfig.eventSheets).filter(eventId => !knownEventIds.includes(eventId));

  for (const eventId of newEvents) {
    const eventPath = _path.default.join(DATA_FOLDER, 'events', eventId);

    if (!(0, _fs.existsSync)(eventPath)) {
      (0, _fs.mkdirSync)(eventPath);
    }
  } // process logs, since we use them to push to seatings


  await processAllEventFiles(); //then update events

  const openEvents = await (0, _db.executeSelectSome)(`SELECT id FROM event WHERE completedDate > $today`, {
    $today: new Date().toISOString()
  }, 'id');

  for (const eventId of openEvents.concat(newEvents)) {
    const sheetId = dbConfig.eventSheets[eventId];

    if (sheetId === undefined) {
      throw `No event sheet for open event ${eventId}`;
    }

    console.log('Updating data for open event %s', eventId);
    await (0, _db.updateEventData)(eventId, sheetId);
  }

  await importDekFiles();
  console.log('Sync complete');
  return;
}

async function dataSyncLoop(cadence = 1000 * 60 * 5) {
  try {
    await syncData();
    console.log('Scheduling next update for %s...', new Date(new Date().getTime() + cadence));
    setTimeout(dataSyncLoop, cadence);
  } catch (err) {
    console.log('Some error, terminating OCL data sync loop. Probably your config file is missing or incorrectly set up.');
  }

  return;
}

function fileIsDecklist(filename) {
  const fileContents = (0, _fs.readFileSync)(filename, 'utf-8').replace(/\r/g, '');
  const deckLines = fileContents.split('=\n').slice(-1)[0].split('\n').map(r => r.trim());
  return deckLines.filter(row => CARD_ROW_REGEX.test(row) && !BASIC_REGEX.test(row)).length <= 45 && deckLines.filter(row => !CARD_ROW_REGEX.test(row) && !BASIC_REGEX.test(row)).length <= 2;
}

function fileIsDraftLog(filename) {
  const fileContents = (0, _fs.readFileSync)(filename, 'utf-8');
  const selectionLines = fileContents.split('\n').filter(line => SELECTION_REGEX.test(line));
  return selectionLines.length == 46;
}

async function processAllEventFiles() {
  const allEventIdsInDb = await (0, _db.executeSelectSome)('SELECT id FROM event', {}, 'id');
  const allEventIds = [...new Set(allEventIdsInDb.concat(Object.keys((0, _db.getFreshDbConfig)().eventSheets)))];
  const allFolders = (0, _fs.readdirSync)(_path.default.join(DATA_FOLDER, 'events')).filter(item => allEventIds.includes(item));
  allEventIds.filter(item => !allFolders.includes(item)).forEach(async item => {
    console.log('Creating event folder for %s', item);
    await _fs.promises.mkdir(`./data/events/${item}`);
  });

  for (const eventId of allFolders) {
    await processOneEvent(eventId);
  }

  return;
}

async function processOneEvent(eventId) {
  const eventPath = _path.default.join(DATA_FOLDER, 'events', eventId);

  const txtFileNames = (0, _fs.readdirSync)(eventPath).filter(item => /\.txt$/.test(item));
  const allSources = await (0, _db.executeSelectSome)(`SELECT draftlogSource AS source FROM entryExtra WHERE eventId = $eventId 
        UNION ALL 
        SELECT decklistSource AS source FROM entryExtra WHERE eventId = $eventId`, {
    $eventId: eventId
  }, 'source');
  const logFileNames = txtFileNames.filter(filename => fileIsDraftLog(_path.default.join(eventPath, filename)));
  const newLogFiles = logFileNames.filter(filename => !allSources.includes(filename));

  if (newLogFiles.length > 0) {
    console.log(`Found new log file ${newLogFiles[0]} and ${newLogFiles.length - 1} others in event ${eventId}. Reprocessing picks now...`);
    await (0, _db.executeRun)(`DELETE FROM pick WHERE eventId = $eventId`, {
      $eventId: eventId
    });
    await (0, _db.executeRun)(`UPDATE entryExtra SET draftlogSource = null WHERE eventId = $eventId`, {
      $eventId: eventId
    });
    const seatings = await (0, _db.executeSelectSome)('SELECT playerId FROM entry WHERE eventId = $eventId AND playerId IS NOT NULL ORDER BY seatNum ASC', {
      $eventId: eventId
    }, 'playerId');

    if (seatings.length != 8) {
      if (seatings.length > 0) {
        console.log(`Invalid seatings found for event ${eventId}. Deleting entries.`);
      }

      await (0, _db.executeRun)(`DELETE FROM entry WHERE eventId = $eventId`, {
        $eventId: eventId
      });
      await (0, _db.executeRun)(`DELETE FROM entryExtra WHERE eventId = $eventId`, {
        $eventId: eventId
      });
    }

    for (const filename of logFileNames) {
      await loadLogAndWrite(filename, eventId, seatings);
    }
  }

  const deckFileNames = txtFileNames.filter(filename => fileIsDecklist(_path.default.join(eventPath, filename)));
  const newDeckFiles = deckFileNames.filter(filename => !allSources.includes(filename));

  if (newDeckFiles.length > 0) {
    console.log(`Found new deck file ${newDeckFiles[0]} and ${newDeckFiles.length - 1} others in event ${eventId}. Reprocessing picks now...`);

    for (const filename of deckFileNames) {
      await loadDeckAndWrite(filename, eventId);
    }
  }

  return;
}

async function loadLogAndWrite(filename, eventId, seatings) {
  const {
    seatNum,
    playerTag,
    logRows
  } = processLog((0, _fs.readFileSync)(_path.default.join(DATA_FOLDER, 'events', eventId, filename), 'utf-8'));
  let playerId;

  if (seatings.length === 8) {
    playerId = seatings[seatNum - 1];
    const fullName = await (0, _db.executeSelectOne)('SELECT fullName FROM player WHERE id = $playerId', {
      $playerId: playerId
    }, 'fullName');
    console.log(`Inferred identity of ${playerTag} as ${fullName} in event ${eventId}`);
  } else {
    playerId = playerTag;
    const fullName = await (0, _db.executeSelectOne)('SELECT fullName FROM player WHERE id = $playerId', {
      $playerId: playerId
    }, 'fullName');

    if (fullName !== undefined) {
      await (0, _db.executeRun)(`INSERT INTO entry(eventId, playerId, seatNum) VALUES ($eventId, $playerId, $seatNum)`, {
        $eventId: eventId,
        $playerId: playerId,
        $seatNum: seatNum
      });
      await (0, _db.executeRun)(`INSERT INTO entryExtra(eventId, playerId) VALUES ($eventId, $playerId)`, {
        $eventId: eventId,
        $playerId: playerId
      });
      console.log(`Inserting seating for ${fullName} at seat ${seatNum} in event ${eventId}`);
    } else {
      console.log(`Invalid player id ${playerTag} in file ${filename} for event ${eventId}! Not inserting entry, event will not be set up correctly.`);
    }
  }

  const uploadTable = logRows.map(logRow => {
    return { ...logRow,
      playerId,
      eventId
    };
  });
  await (0, _db.executeInsertData)('pick', uploadTable);
  await (0, _db.executeRun)('UPDATE entryExtra SET draftlogSource = $draftlogSource, draftlogURL = null WHERE playerId = $playerId AND eventId = $eventId', {
    $playerId: playerId,
    $eventId: eventId,
    $draftlogSource: filename
  });
}

async function loadDeckAndWrite(filename, eventId) {
  const processedDeck = processDeck((0, _fs.readFileSync)(_path.default.join(DATA_FOLDER, 'events', eventId, filename), 'utf-8'));
  let playerId;

  if (!processedDeck.cardRows) {
    throw `Decklist file ${filename} for event ${eventId} has no cards.`;
  }

  if (processedDeck.playerFullName === undefined) {
    playerId = await (0, _db.executeSelectSome)(`SELECT entry.playerId FROM entry JOIN pick ON entry.playerId = pick.playerId AND entry.eventId = pick.eventId WHERE entry.eventId = $eventId AND pick.cardName = $cardName`, {
      $cardName: processedDeck.cardRows[0].cardName,
      $eventId: eventId
    }).then(rows => {
      if (rows.length > 1) {
        throw 'Multiple entries found containing some card from this deck. Does the cube have multiples? If so fix logic!';
      }

      if (rows.length === 0) {
        throw 'No entry found drafting any of these cards!';
      }

      return rows[0].playerId;
    });
  } else {
    playerId = await (0, _db.executeSelectOne)(`SELECT id FROM player WHERE fullName = $playerFullName`, {
      $playerFullName: processedDeck.playerFullName
    }).then(row => {
      if (!row) {
        throw `No player found with name ${processedDeck.playerFullName}`;
      }

      return row.id;
    });
  }

  for (let cardRow of processedDeck.cardRows) {
    // select the first row of this entry with matching cardname and no main/sb info
    const matchingRow = await (0, _db.executeSelectOne)(`SELECT * FROM pick WHERE eventId = $eventId AND playerId = $playerId AND cardName = $cardName AND isMain IS NULL`, {
      $playerId: playerId,
      $eventId: eventId,
      $cardName: cardRow.cardName
    });

    if (matchingRow) {
      await (0, _db.executeRun)(`UPDATE pick SET isMain = $isMain
                WHERE playerId = $playerId AND eventId = $eventId AND pickId = $pickId AND isMain IS NULL`, {
        $isMain: cardRow.isMain,
        $playerId: playerId,
        $eventId: eventId,
        $pickId: matchingRow.pickId
      });
    } else {
      const pickId = (await (0, _db.executeSelectOne)(`SELECT max(pickId)+1 AS newId FROM pick WHERE playerId = $playerId AND eventId = $eventId`, {
        $playerId: playerId,
        $eventId: eventId
      }, 'newId')) || 1;
      await (0, _db.executeRun)(`INSERT INTO pick(playerId, eventId, pickId, isMain, cardName) VALUES ($playerId, $eventId, $pickId, $isMain, $cardName)`, {
        $playerId: playerId,
        $eventId: eventId,
        $pickId: pickId,
        $isMain: cardRow.isMain,
        $cardName: cardRow.cardName
      });
    }

    await (0, _db.executeRun)(`UPDATE entryExtra SET decklistSource = $decklistSource 
            WHERE playerId = $playerId AND eventId = $eventId`, {
      $playerId: playerId,
      $eventId: eventId,
      $decklistSource: filename
    });
  }

  return;
}

function processLog(draftLog) {
  var _draftLog$split$find, _draftLog$split$find$;

  const selectionRegex = /--> (.*)/;
  const playerRegex = /Event #: (.*)@(.*)/;
  draftLog = draftLog.replace(/\r/g, '');
  const segments = draftLog.split('\n\n').filter(segment => selectionRegex.test(segment));

  if (segments.length !== 46) {
    throw 'Invalid draftlog, missing correct number of "-->" indicators or improperly separated.';
  }

  const playerLines = segments[0].split('\n').filter(line => /(^--> |^    )[a-zA-z]/.test(line));

  if (playerLines.length != 8) {
    throw 'Invalid draftlog, header does not have 8 players, or some other error.';
  }

  const seatNum = playerLines.findIndex(line => selectionRegex.test(line)) + 1;
  const playerTag = ((_draftLog$split$find = draftLog.split('\n').find(line => playerRegex.test(line))) === null || _draftLog$split$find === void 0 ? void 0 : (_draftLog$split$find$ = _draftLog$split$find.match(playerRegex)) === null || _draftLog$split$find$ === void 0 ? void 0 : _draftLog$split$find$[1]) || playerLines.find(line => selectionRegex.test(line)).match(selectionRegex)[1];
  const pickSegments = segments.slice(1, 46);
  const logRows = pickSegments.map((segment, index) => {
    const cardLines = segment.split('\n').slice(1);
    const pickLine = cardLines.find(el => selectionRegex.test(el)).trim();

    if (!pickLine) {
      throw 'Invalid draftlog, pick segment missing selection indicator';
    }

    const cardName = pickLine.match(selectionRegex)[1];
    const contextLines = cardLines.filter(line => !selectionRegex.test(line)).map(s => s.trim());
    return {
      cardName,
      otherCardNamesString: contextLines.join('\n'),
      pickId: index + 1,
      packNum: Math.floor(index / 15) + 1,
      pickNum: index % 15 + 1
    };
  });
  return {
    seatNum,
    playerTag,
    logRows
  };
}

function processDeck(decklist) {
  const nameMap = {
    'Never/Return': 'Never // Return'
  };
  decklist = decklist.replace(/\r/g, '');
  const nameCheckSplit = decklist.split('=\n');
  let playerFullName;

  if (nameCheckSplit.length > 1) {
    playerFullName = nameCheckSplit[0].trim();
    decklist = nameCheckSplit[1];
  }

  const lines = decklist.split('\n').filter(line => !BASIC_REGEX.test(line) && (CARD_ROW_REGEX.test(line) || line === ''));
  const sbBreakIndex = lines.findIndex(line => line === '');
  return {
    cardRows: lines.slice(0, sbBreakIndex).map(line => {
      var _line$match, _line$match$;

      const mtgoName = (_line$match = line.match(CARD_ROW_REGEX)) === null || _line$match === void 0 ? void 0 : (_line$match$ = _line$match[1]) === null || _line$match$ === void 0 ? void 0 : _line$match$.trim();
      return {
        cardName: nameMap[mtgoName] || mtgoName,
        isMain: 1
      };
    }).concat(lines.slice(sbBreakIndex + 1).map(line => {
      var _line$match2, _line$match2$;

      const mtgoName = (_line$match2 = line.match(CARD_ROW_REGEX)) === null || _line$match2 === void 0 ? void 0 : (_line$match2$ = _line$match2[1]) === null || _line$match2$ === void 0 ? void 0 : _line$match2$.trim();
      return {
        cardName: nameMap[mtgoName] || mtgoName,
        isMain: 0
      };
    })).filter(row => row.cardName !== undefined),
    playerFullName
  };
}