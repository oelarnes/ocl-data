import {List} from 'immutable';
import { readFileSync, readFile } from 'fs';
import { executeInsertData } from './db';


async function loadLogAndWrite(filename, eventId, seatings) {
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
    console.log(draftLog);
}