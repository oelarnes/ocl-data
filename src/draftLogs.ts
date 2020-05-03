import {List} from 'immutable';
import { readFileSync, readFile } from 'fs';
import { executeInsertData } from './db';

interface LogRow {
    packNum: number,
    pickNum: number,
    card: string,
    otherCards: string
}

interface ProcessedLog {
    seatNum: number,
    logRows: LogRow[]
}

async function loadLogAndWrite(filename: string, eventId: string, seatings: string[]) {
    const processedLog = processLog(readFileSync(filename, 'utf-8'));

    const playerId = seatings[processedLog.seatNum];
    const uploadTable = processedLog.logRows.map((logRow: LogRow) => {
        return {
            ...logRow,
            playerId,
            eventId
        }
    });

    return executeInsertData('pick', uploadTable);
}

function processLog(draftLog: string): any /*{ logRows: logRow[], seatNum: number }*/ {
    console.log(draftLog);
}