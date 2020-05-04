const dropPlayerTable = 'DROP TABLE IF EXISTS player;';
const dropEventTable = 'DROP TABLE IF EXISTS event;';
const dropEntryTable = 'DROP TABLE IF EXISTS entry;';
const dropPairingTable = 'DROP TABLE IF EXISTS pairing;';
const dropPickTable = 'DROP TABLE IF EXISTS pick;';
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
    p1MatchWin INTEGER,
    p2MatchWin INTEGER,
    completedDate TEXT,
    PRIMARY KEY(eventId, roundNum, tableNum)
);
`;
const createPickTable = `
CREATE TABLE IF NOT EXISTS pick(
    playerId TEXT,
    eventId TEXT,
    packNum INT,
    pickNum INT,
    card TEXT,
    otherCardsString TEXT,
    isMain INT
)`
//Select
const selectPlayer = `SELECT * FROM player WHERE id = $playerId`;
const selectEvent = `SELECT * FROM event WHERE id = $eventId`;
const selectEntry = `SELECT * FROM entry WHERE eventId = $eventId and playerId = $playerId`;
const selectPlayersOrderByIdAsc = `SELECT * FROM player WHERE id > $after ORDER BY id ASC LIMIT $howMany`;
const selectPlayersOrderByIdDesc = `SELECT * FROM player WHERE id < $after ORDER BY id DESC LIMIT $howMany`;
const selectPlayersOrderByNameAsc = `SELECT * FROM player WHERE fullName > $after ORDER BY fullName ASC LIMIT $howMany`;
const selectPlayersOrderByNameDesc = `SELECT * FROM player WHERE fullName < $after ORDER BY fullName DESC LIMIT $howMany`;
const selectPlayerQps = `SELECT SUM(entry.qpsAwarded) as qps FROM entry JOIN event ON entry.eventId = event.id
    WHERE entry.playerId = $playerId AND event.season = $season`;
const selectPlayersByNameSearch = `SELECT * FROM player WHERE fullName like '%' || $byName || '%'`;
const selectPlayerByHandleSearch = `SELECT * FROM player WHERE discordHandle like '%' || $byHandle || '%'`;
const selectEventsAsc = `SELECT * FROM event WHERE draftDate > $after ORDER BY draftDate ASC LIMIT $howMany`;
const selectEventsDesc = `SELECT * FROM event WHERE draftDate < $after ORDER BY draftDate DESC LIMIT $howMany`;
const selectEntriesByEvent = `SELECT * FROM entry WHERE entry.eventId = $eventId`;
const selectEntriesByPlayerAsc = `SELECT entry.* FROM entry JOIN event ON entry.eventId = event.id
    WHERE event.draftDate > $after AND entry.playerId = $playerId ORDER BY event.draftDate ASC LIMIT $howMany` 
const selectEntriesByPlayerDesc = `SELECT entry.* FROM entry JOIN event ON entry.eventId = event.id
    WHERE event.draftDate < $after AND entry.playerId = $playerId ORDER BY event.draftDate DESC LIMIT $howMany` 
const selectEntryWins = `SELECT p1.wins+p2.wins AS wins FROM (
        SELECT SUM(p1MatchWin) AS wins FROM pairing WHERE p1Id = $playerId and eventId = $eventId
    ) p1 JOIN (
        SELECT SUM(p2MatchWin) AS wins FROM pairing WHERE p2Id = $playerId and eventId = $eventId
    ) p2
`;
const selectEntryLosses = `SELECT p1.losses+p2.losses AS losses FROM (
    SELECT SUM(p1MatchWin) AS losses FROM pairing WHERE p2Id = $playerId and eventId = $eventId
) p2 JOIN (
    SELECT SUM(p2MatchWin) AS losses FROM pairing WHERE p1Id = $playerId and eventId = $eventId
) p1
`;
const selectPairingsByEvent = `SELECT * FROM pairing WHERE eventId = $eventId`;
const selectPairingsByEventAndRound = `SELECT * FROM pairing WHERE eventId = $eventId AND roundNum = $roundNum`;
const selectPairingsByEntry = `SELECT * FROM pairing WHERE eventId = $eventId AND (p1Id = $playerId or p2Id = $playerId)`;
const selectPairingsByPlayerPairAsc = `SELECT * FROM pairing 
    WHERE (p1Id = $playerId AND p2Id = $oppId) OR (p2Id = $playerId AND p1Id = $oppId) AND completedDate > $after 
    ORDER BY completedDate ASC LIMIT $howMany`;
const selectPairingsByPlayerPairDesc = `SELECT * FROM pairing 
    WHERE (p1Id = $playerId AND p2Id = $oppId) OR (p2Id = $playerId AND p1Id = $oppId) AND completedDate < $after 
    ORDER BY completedDate DESC LIMIT $howMany`;
const selectStandingsAllTime = `SELECT *, rank as allTimeRank FROM (
    SELECT 
        ROW_NUMBER () OVER (
            ORDER BY entries.qps DESC, entries.trophies DESC, (p1.wins + p2.wins) DESC, (p1.losses + p2.losses) ASC
        ) rank,
        p1.playerId AS playerId, 
        (p1.wins + p2.wins) AS matchWins, 
        (p1.losses + p2.losses) AS matchLosses, 
        entries.qps AS qps, 
        entries.trophies AS trophies,
        'All Time' as season
    FROM 
        (SELECT p1Id AS playerId, SUM(p1MatchWin) AS wins, SUM(p2MatchWin) as losses FROM pairing GROUP BY p1Id) p1
    JOIN 
        (SELECT p2Id AS playerId, SUM(p2MatchWin) AS wins, SUM(p1MatchWin) as losses FROM pairing GROUP BY p2Id) p2
        ON p2.playerId = p1.playerId
    JOIN 
        (SELECT playerId, SUM(qpsAwarded) AS qps, SUM(CASE finalPosition WHEN 1 THEN 1 ELSE 0 END) AS trophies FROM entry GROUP BY playerId) entries
        ON entries.playerId = p1.playerId
) t WHERE rank > $after LIMIT $howMany
`;
const selectStandingsBySeason = `SELECT * FROM (
    SELECT
        ROW_NUMBER () OVER (
            ORDER BY entries.qps DESC, (p1.wins + p2.wins) DESC, (p1.losses + p2.losses) ASC, ats.rank ASC
        ) rank,
        p1.playerId AS playerId, 
        (p1.wins + p2.wins) AS matchWins, 
        (p1.losses + p2.losses) AS matchLosses, 
        entries.qps AS qps, 
        entries.trophies AS trophies,
        ats.rank AS allTimeRank,
        $season AS season
    FROM
        (SELECT p1Id AS playerId, SUM(p1MatchWin) AS wins, SUM(p2MatchWin) AS losses FROM pairing
            JOIN event ON pairing.eventId = event.id WHERE event.season = $season
            GROUP BY p1Id) p1
    JOIN
        (SELECT p2Id AS playerId, SUM(p2MatchWin) AS wins, SUM(p1MatchWin) AS losses FROM pairing
            JOIN event ON pairing.eventId = event.id WHERE event.season = $season
            GROUP BY p2Id) p2
    ON p1.playerId = p2.playerId
    JOIN (SELECT playerId, SUM(qpsAwarded) AS qps, SUM(CASE finalPosition WHEN 1 THEN 1 ELSE 0 END) AS trophies 
            FROM entry JOIN event ON entry.eventId = event.id WHERE event.season = $season GROUP BY playerId) entries
    ON entries.playerId = p1.playerId
    JOIN (
        SELECT 
            ROW_NUMBER () OVER (
                ORDER BY entries.qps DESC, entries.trophies DESC, (p1.wins + p2.wins) DESC, (p1.losses + p2.losses) ASC
            ) rank, p1.playerId AS playerId
        FROM 
            (SELECT p1Id AS playerId, SUM(p1MatchWin) AS wins, SUM(p2MatchWin) AS losses FROM pairing GROUP BY p1Id) p1
        JOIN 
            (SELECT p2Id AS playerId, SUM(p2MatchWin) AS wins, SUM(p1MatchWin) AS losses FROM pairing GROUP BY p2Id) p2
            ON p2.playerId = p1.playerId
        JOIN 
            (SELECT playerId, SUM(qpsAwarded) AS qps, SUM(CASE finalPosition WHEN 1 THEN 1 ELSE 0 END) AS trophies FROM entry GROUP BY playerId) entries
            ON entries.playerId = p1.playerId
    ) ats
    ON ats.playerId = p1.playerId
) t  WHERE rank > $after LIMIT $howMany`;

const selectStandingForPlayerAllTime = `SELECT playerId, season, rank, qps, matchWins, matchLosses, trophies, allTimeRank 
    FROM (${selectStandingsAllTime}) s WHERE playerId = $playerId`;
const selectStandingForPlayerBySeason = `SELECT playerId, season, rank, qps, matchWins, matchLosses, trophies, allTimeRank
    FROM (${selectStandingsBySeason}) s WHERE playerId = $playerId`;

export {
    dropPlayerTable,
    dropEventTable,
    dropEntryTable,
    dropPairingTable,
    dropPickTable,
    createPlayerTable,
    createEventTable,
    createEntryTable,
    createPairingTable,
    createPickTable,
    selectPlayer,
    selectEvent,
    selectEntry,
    selectPlayersOrderByIdAsc,
    selectPlayersOrderByIdDesc,
    selectPlayersOrderByNameAsc,
    selectPlayersOrderByNameDesc,
    selectPlayerQps,
    selectPlayersByNameSearch,
    selectPlayerByHandleSearch,
    selectEventsAsc,
    selectEventsDesc,
    selectEntriesByEvent,
    selectEntriesByPlayerAsc,
    selectEntriesByPlayerDesc,
    selectEntryWins,
    selectEntryLosses,
    selectPairingsByEvent,
    selectPairingsByEventAndRound,
    selectPairingsByEntry,
    selectPairingsByPlayerPairAsc,
    selectPairingsByPlayerPairDesc,
    selectStandingsAllTime,
    selectStandingsBySeason,
    selectStandingForPlayerAllTime,
    selectStandingForPlayerBySeason
};