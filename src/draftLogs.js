import { readFileSync, readdirSync } from 'fs';
import { executeInsertData, executeSelectSome, executeSelectOne } from './db';
import path from 'path';

const EVENT_FOLDER = './data/events';
const SELECTION_REGEX = /--> (.*)/;
const CARD_ROW_REGEX = /^1 .*/;
const BASIC_REGEX = /^[0-9]* (Plains|Island|Swamp|Mountain|Forest)$/;

function fileIsDecklist(filename) {
    const fileContents = readFileSync(filename, 'utf-8');
    const deckLines = fileContents.split('=\n').slice(-1)[0].split('\n').map(r => r.trim())
    return deckLines.filter(row => CARD_ROW_REGEX.test(row) && !BASIC_REGEX.test(row)).length <= 45
        && deckLines.filter(row => !CARD_ROW_REGEX.test(row) && !BASIC_REGEX.test(row)).length <= 2;
}

function fileIsDraftLog(filename) {
    const fileContents = readFileSync(filename, 'utf-8');
    const selectionLines = fileContents.split('\n').filter(line => SELECTION_REGEX.test(line))
    return selectionLines.length == 46
}

async function processAllEventFiles() {
    const allEventIds = await executeSelectSome('SELECT id FROM event;', {}).then(rows => rows.map(row => row.id));
    const allFolders = readdirSync(EVENT_FOLDER).filter(item => allEventIds.includes(item));
    console.log('The following event ids are missing data folders:')
    allEventIds.filter(item => !allFolders.includes(item)).forEach(item => {
        console.log(item)
    })

    for (let eventId of allFolders) {
        const eventPath = path.join(EVENT_FOLDER, eventId)
        const txtFilePaths = readdirSync(eventPath).filter(item => /\.txt$/.test(item)).map(item => path.join(eventPath, item));

        const logFilePaths = txtFilePaths.filter(fileIsDraftLog)
        const deckFilePaths = txtFilePaths.filter(fileIsDecklist)

        const seatings = await executeSelectSome('SELECT playerId FROM entry WHERE eventId = $eventId ORDER BY seatNum ASC', { $eventId: eventId })
            .then((rows) => rows.map((row) => row.playerId));

        for (let filename of logFilePaths) {
            await loadLogAndWrite(filename, eventId, seatings);
        }

        for (let filename of deckFilePaths) {
            await loadDeckAndWrite(filename, eventId);
        }
    }
    
    return
}

async function loadLogAndWrite(filename, eventId, seatings) {
    console.log(`Processing log ${filename}`);
    const processedLog = processLog(readFileSync(filename, 'utf-8'));

    const playerId = seatings[processedLog.seatNum - 1];
    const fullName = await executeSelectOne('SELECT fullName FROM player WHERE id = $playerId', {$playerId: playerId})
        .then(row => row.fullName);
    console.log(`Inferred identity of ${processedLog.playerTag} as ${fullName} in event ${eventId}`);

    const uploadTable = processedLog.logRows.map((logRow) => {
        return {
            ...logRow,
            playerId,
            eventId
        }
    });

    return executeInsertData('pick', uploadTable);
}

async function loadDeckAndWrite(filename, eventId) {
    console.log(`Processing decklist ${filename}`);
    const processedDeck = processDeck(readFileSync(filename, 'utf-8'));

    if (!processedDeck.mainDeckNames) {
        throw `Decklist file ${filename} for event ${eventId} has no cards in maindeck.`;
    }
    if (processedDeck.seatNum === undefined) {
        processedDeck.seatNum = await executeSelectSome(
            `SELECT DISTINCT entry.seatNum FROM entry JOIN pick ON entry.playerId = pick.playerId AND entry.eventId = pick.eventId WHERE entry.eventId = $eventId AND cardName IN $cardNames`, 
            {
                $cardNames: processedDeck.mainDeckNames,
                $eventId: eventId
            }
        ).then((rows) => {
            if (rows.length > 1) {
                throw 'Multiple entries found containing some card from this deck. Does the cube have multiples? If so fix logic!'
            }
            
            return rows[0].seatNum;
        });
    }

    const uploadTable = processDeck.mainDeckNames.map((name) => ({
        cardName: name,
        isMain: 1
    })).concat(processedDeck.sideboardNames.map((name) => ({
        cardName: name,
        isMain: 0
    })));
}

function processLog(draftLog) {
    const selectionRegex = /--> (.*)/;
    draftLog = draftLog.replace(/\r/g, '');
    const segments = draftLog.split('\n\n').filter((segment) => selectionRegex.test(segment));

    if (segments.length !== 46) {
        throw 'Invalid draftlog, missing correct number of "-->" indicators or improperly separated.';
    }
    const playerLines = segments[0].split('\n').filter(line => /[a-zA-z]/.test(line)).slice(3, 11);
    if (playerLines.length != 8) {
        throw 'Invalid draftlog, header does not have 8 players, or some other error.';
    }
    const seatNum = playerLines.findIndex(line => selectionRegex.test(line)) + 1;
    const playerTag = playerLines.find(line => selectionRegex.test(line)).match(selectionRegex)[1];

    const pickSegments = segments.slice(1, 46);

    const logRows = pickSegments.map((segment, index) => {
        const cardLines = segment.split('\n').slice(1);
        const pickLine = cardLines.find(el => selectionRegex.test(el)).trim();
        if (!pickLine) {
            throw 'Invalid draftlog, pick segment missing selection indicator'
        }
        const cardName = pickLine.match(selectionRegex)[1]
        const contextLines = cardLines.filter(line => !selectionRegex.test(line)).map(s => s.trim());
        return {
            cardName,
            otherCardNamesString: contextLines.join('\n'),
            packNum: Math.floor(index / 15) + 1,
            pickNum: index % 15 + 1
        }
    });

    return {
        seatNum,
        playerTag,
        logRows
    }
}

export {
    processAllEventFiles,
    processLog
}