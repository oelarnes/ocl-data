import { List } from 'immutable';
import { readFileSync } from 'fs';
import { executeInsertData } from './db';


function loadLogAndWrite(filename, eventId, seatings) {
    const processedLog = processLog(readFileSync(filename, 'utf-8'));

    const playerId = seatings[processedLog.seatNum];
    const uploadTable = processedLog.logRows.map((logRow) => {
        return {
            ...logRow,
            playerId,
            eventId
        }
    });

    return executeInsertData('pick', uploadTable);
}

function processLog(draftLog) /*{ logRows: logRow[], seatNum: number }*/ {
    const selectionRegex = /--> (.*)/;
    const segments = draftLog.split('\n\n').filter((segment) => selectionRegex.test(segment));
    
    if (segments.length !== 46) {
        throw 'Invalid draftlog, missing correct number of "-->" indicators or improperly separated.';
    }
    const playerLines = segments[0].split('\n').filter(line => /[a-zA-z]/.test(line)).slice(3,11);
    if (playerLines.length != 8) {
        throw 'Invalid draftlog, header does not have 8 players, or some other error.';
    }
    const seatNum = playerLines.findIndex(line => selectionRegex.test(line)) + 1;

    const pickSegments = segments.slice(1,46);
    let logRows = List();

    pickSegments.forEach((segment, index) => {
        let cardLines = segment.split('\n').slice(1);
        let pickLine = cardLines.find(el => selectionRegex.test(el)).trim();
        if (!pickLine) {
            throw 'Invalid draftlog, pick segment missing selection indicator'
        }
        let card = pickLine.match(selectionRegex)[1]
        let contextLines = cardLines.filter(line => !selectionRegex.test(line)).map(s => s.trim());
        logRows = logRows.push(
            {
                card,
                otherCardsString: contextLines.join('\n'),
                packNum: Math.floor(index/15) + 1,
                pickNum: index % 15 + 1 
            }
        )
    });

    return {
        seatNum,
        logRows: logRows.toArray()
    }
}

export {
    loadLogAndWrite,
    processLog
}