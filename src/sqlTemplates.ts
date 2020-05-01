const dropPlayerTable = 'DROP TABLE IF EXISTS player;';
const dropEventTable = 'DROP TABLE IF EXISTS event;';
const dropEntryTable = 'DROP TABLE IF EXISTS entry;';
const dropPairingTable = 'DROP TABLE IF EXISTS pairing;';
// Create Table
const createPlayerTable = `
CREATE TABLE IF NOT EXISTS player(
    id text PRIMARY KEY,
    fullName text UNIQUE,
    discordHandle text,
    discordIdExt text,
    timeZone text,
    pronouns text,
    email text
);`;
const createEventTable = `
CREATE TABLE IF NOT EXISTS event(
    id text PRIMARY KEY,
    prizeType text,
    draftDate text,
    completeDate text, 
    cubeId text,
    season text
);`;
const createEntryTable= ` 
CREATE TABLE IF NOT EXISTS entry(
    playerId TEXT,
    eventId TEXT,
    seatNum INTEGER,
    account TEXT, 
    accountPw TEXT, 
    isOpen BOOLEAN,
    finalPosition INTEGER,
    qpsAwarded INTEGER,
    cpsAwarded INTEGER,
    PRIMARY KEY(playerId, eventId)
);`;
const createPairingTable = `
CREATE TABLE IF NOT EXISTS pairing(
    eventId TEXT,
    roundNum INTEGER,
    tableNum INTEGER,
    p1Id TEXT,
    p2Id TEXT,
    choosePlayDrawId TEXT,
    p1GameWins INTEGER,
    p2GameWins INTEGER,
    completedDate TEXT,
    PRIMARY KEY(eventId, roundNum, tableNum)
);
`;
//Select
const selectPlayer = `SELECT * FROM player WHERE id = $playerId;`;
const selectEvent = `SELECT * FROM event WHERE id = $eventId;`;
const selectEntry = `SELECT * FROM entry WHERE eventId = $eventId and playerId = $playerId;`;
const selectPlayersOrderByIdAsc = `SELECT * FROM player WHERE id > $after ORDER BY id ASC LIMIT $howMany;`;
const selectPlayersOrderByIdDesc = `SELECT * FROM player WHERE id < $after ORDER BY id DESC LIMIT $howMany;`;
const selectPlayersOrderByNameAsc = `SELECT * FROM player WHERE fullName > $after ORDER BY fullName ASC LIMIT $howMany;`;
const selectPlayersOrderByNameDesc = `SELECT * FROM player WHERE fullName < $after ORDER BY fullName DESC LIMIT $howMany;`;
const selectPlayerQps = `SELECT SUM(entry.qpsAwarded) as qps FROM entry JOIN event ON entry.eventId = event.id
    WHERE entry.playerId = $playerId AND event.season = $season;`;
const selectEventsAsc = `SELECT * FROM event WHERE draftDate > $after ORDER BY draftDate ASC LIMIT $howMany;`;
const selectEventsDesc = `SELECT * FROM event WHERE draftDate < $after ORDER BY draftDate DESC LIMIT $howMany;`;
const selectEntriesByEvent = `SELECT * FROM entry WHERE entry.eventId = $eventId;`;
const selectEntriesByPlayerAsc = `SELECT entry.* FROM entry JOIN event ON entry.eventId = event.id
    WHERE event.draftDate > $after AND entry.playerId = $playerId ORDER BY event.draftDate ASC LIMIT $howMany;` 
const selectEntriesByPlayerDesc = `SELECT entry.* FROM entry JOIN event ON entry.eventId = event.id
    WHERE event.draftDate < $after AND entry.playerId = $playerId ORDER BY event.draftDate DESC LIMIT $howMany;` 
const selectPairingsByEvent = `SELECT * FROM pairing WHERE eventId = $eventId;`;
const selectPairingsByEventAndRound = `SELECT * FROM pairing WHERE eventId = $eventId AND roundNum = $roundNum;`;
const selectPairingsByEntry = `SELECT * FROM pairing WHERE eventId = $eventId AND (p1Id = $playerId or p2Id = $playerId);`;
const selectPairingsByPlayerPairAsc = `SELECT * FROM pairing 
    WHERE (p1Id = $playerId AND p2Id = $oppId) OR (p2Id = $playerId AND p1Id = $oppId) AND completedDate > $after 
    ORDER BY completedDate ASC LIMIT $howMany;`;
const selectPairingsByPlayerPairDesc = `SELECT * FROM pairing 
    WHERE (p1Id = $playerId AND p2Id = $oppId) OR (p2Id = $playerId AND p1Id = $oppId) AND completedDate < $after 
    ORDER BY completedDate DESC LIMIT $howMany;`;

export {
    dropPlayerTable,
    dropEventTable,
    dropEntryTable,
    dropPairingTable,
    createPlayerTable,
    createEventTable,
    createEntryTable,
    createPairingTable,
    selectPlayer,
    selectEvent,
    selectEntry,
    selectPlayersOrderByIdAsc,
    selectPlayersOrderByIdDesc,
    selectPlayersOrderByNameAsc,
    selectPlayersOrderByNameDesc,
    selectPlayerQps,
    selectEventsAsc,
    selectEventsDesc,
    selectEntriesByEvent,
    selectEntriesByPlayerAsc,
    selectEntriesByPlayerDesc,
    selectPairingsByEvent,
    selectPairingsByEventAndRound,
    selectPairingsByEntry,
    selectPairingsByPlayerPairAsc,
    selectPairingsByPlayerPairDesc
};