"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.selectCubesByType = exports.selectCubesForCard = exports.selectOwnedMTGOCardByName = exports.selectMatchLossesByCard = exports.selectMatchWinsByCard = exports.selectInPoolCountByCard = exports.selectWheelPctByCard = exports.selectIsMainPctByCard = exports.selectPickOrderByCard = exports.selectPicksForEntry = exports.selectStandingForPlayerBySeason = exports.selectStandingForPlayerAllTime = exports.selectStandingsBySeason = exports.selectStandingsAllTime = exports.selectOpenPairingsByPlayer = exports.selectPairingsByPlayerPairDesc = exports.selectPairingsByPlayerPairAsc = exports.selectPairingsByEntry = exports.selectPairingsByEventAndRound = exports.selectPairingsByEvent = exports.selectOpenEntriesByPlayer = exports.selectEntriesByCardName = exports.selectEntryLosses = exports.selectEntryWins = exports.selectEntriesByPlayerDesc = exports.selectEntriesByPlayerAsc = exports.selectEntriesByEventByPosition = exports.selectEntriesByEvent = exports.selectEventWinner = exports.selectEventsDesc = exports.selectEventsAsc = exports.selectPlayersByNameOrHandleSearch = exports.selectPlayerQps = exports.selectPlayersOrderByNameDesc = exports.selectPlayersOrderByNameAsc = exports.selectPlayersOrderByIdDesc = exports.selectPlayersOrderByIdAsc = exports.selectEventByCube = exports.selectCube = exports.selectEntry = exports.selectEvent = exports.selectPlayer = exports.createMTGOCardTable = exports.createCubeTable = exports.createPickTable = exports.createPairingTable = exports.createEntryTable = exports.createEventTable = exports.createPlayerTable = exports.dropMTGOCardTable = exports.dropCubeTable = exports.dropPickTable = exports.dropPairingTable = exports.dropEntryTable = exports.dropEventTable = exports.dropPlayerTable = void 0;
const dropPlayerTable = 'DROP TABLE IF EXISTS player;';
exports.dropPlayerTable = dropPlayerTable;
const dropEventTable = 'DROP TABLE IF EXISTS event;';
exports.dropEventTable = dropEventTable;
const dropEntryTable = 'DROP TABLE IF EXISTS entry;';
exports.dropEntryTable = dropEntryTable;
const dropPairingTable = 'DROP TABLE IF EXISTS pairing;';
exports.dropPairingTable = dropPairingTable;
const dropPickTable = 'DROP TABLE IF EXISTS pick;';
exports.dropPickTable = dropPickTable;
const dropCubeTable = `DROP TABLE IF EXISTS cube;`;
exports.dropCubeTable = dropCubeTable;
const dropMTGOCardTable = `DROP TABLE if EXISTS mtgoCard;`; // Create Table

exports.dropMTGOCardTable = dropMTGOCardTable;
const createPlayerTable = `
CREATE TABLE IF NOT EXISTS player(
    id TEXT PRIMARY KEY,
    fullName TEXT UNIQUE,
    discordHandle TEXT,
    discordIdExt TEXT,
    timeZone TEXT,
    pronouns TEXT,
    email TEXT
);`;
exports.createPlayerTable = createPlayerTable;
const createEventTable = `
CREATE TABLE IF NOT EXISTS event(
    id TEXT PRIMARY KEY,
    prizeType TEXT,
    draftDate TEXT,
    completedDate TEXT, 
    cubeId TEXT, 
    season TEXT
);`;
exports.createEventTable = createEventTable;
const createEntryTable = ` 
CREATE TABLE IF NOT EXISTS entry(
    playerId TEXT,
    eventId TEXT,
    seatNum INTEGER,
    account TEXT, 
    isOpen BOOLEAN,
    finalPosition INTEGER,
    qpsAwarded INTEGER,
    cpsAwarded INTEGER,
    PRIMARY KEY(playerId, eventId)
);`;
exports.createEntryTable = createEntryTable;
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
exports.createPairingTable = createPairingTable;
const createPickTable = `
CREATE TABLE IF NOT EXISTS pick(
    playerId TEXT,
    eventId TEXT,
    pickId INT,
    packNum INT,
    pickNum INT,
    cardName TEXT, 
    otherCardNamesString TEXT,
    isMain INT,
    decklistSource TEXT,
    draftlogSource TEXT,
    PRIMARY KEY(playerId, eventId, pickId)
);`;
exports.createPickTable = createPickTable;
const createCubeTable = `
CREATE TABLE IF NOT EXISTS cube(
    id TEXT PRIMARY KEY,
    cubeType TEXT,
    activeDate TEXT,
    inactiveDate TEXT,
    listString TEXT
);`;
exports.createCubeTable = createCubeTable;
const createMTGOCardTable = `
CREATE TABLE IF NOT EXISTS mtgoCard(
    id INTEGER PRIMARY KEY,
    name TEXT,
    mtgoName TEXT,
    numOwned INTEGER,
    numWishlist INTEGER,
    atAccounts TEXT,
    isFoil BOOLEAN,
    imageLocator TEXT,
    dekSource TEXT,
    tix FLOAT,
    tixAsOf TEXT
);`; //Select

exports.createMTGOCardTable = createMTGOCardTable;
const selectPlayer = `SELECT * FROM player WHERE id = $playerId`;
exports.selectPlayer = selectPlayer;
const selectEvent = `SELECT * FROM event WHERE id = $eventId`;
exports.selectEvent = selectEvent;
const selectEntry = `SELECT * FROM entry WHERE eventId = $eventId and playerId = $playerId`;
exports.selectEntry = selectEntry;
const selectCube = `SELECT * FROM cube WHERE id = $cubeId`;
exports.selectCube = selectCube;
const selectEventByCube = `SELECT * FROM event WHERE cubeId = $cubeId ORDER BY draftDate DESC LIMIT $howMany`;
exports.selectEventByCube = selectEventByCube;
const selectPlayersOrderByIdAsc = `SELECT * FROM player WHERE id > $after ORDER BY id ASC LIMIT $howMany`;
exports.selectPlayersOrderByIdAsc = selectPlayersOrderByIdAsc;
const selectPlayersOrderByIdDesc = `SELECT * FROM player WHERE id < $after ORDER BY id DESC LIMIT $howMany`;
exports.selectPlayersOrderByIdDesc = selectPlayersOrderByIdDesc;
const selectPlayersOrderByNameAsc = `SELECT * FROM player WHERE fullName > $after ORDER BY fullName ASC LIMIT $howMany`;
exports.selectPlayersOrderByNameAsc = selectPlayersOrderByNameAsc;
const selectPlayersOrderByNameDesc = `SELECT * FROM player WHERE fullName < $after ORDER BY fullName DESC LIMIT $howMany`;
exports.selectPlayersOrderByNameDesc = selectPlayersOrderByNameDesc;
const selectPlayerQps = `SELECT SUM(entry.qpsAwarded) as qps FROM entry JOIN event ON entry.eventId = event.id
    WHERE entry.playerId = $playerId AND event.season = $season`;
exports.selectPlayerQps = selectPlayerQps;
const selectPlayersByNameOrHandleSearch = `SELECT * FROM player WHERE fullName LIKE '%' || $byName || '%' OR discordHandle LIKE '%' || $byHandle || '%'`;
exports.selectPlayersByNameOrHandleSearch = selectPlayersByNameOrHandleSearch;
const selectEventsAsc = `SELECT * FROM event WHERE draftDate > $after ORDER BY draftDate ASC LIMIT $howMany`;
exports.selectEventsAsc = selectEventsAsc;
const selectEventsDesc = `SELECT * FROM event WHERE draftDate < $after ORDER BY draftDate DESC LIMIT $howMany`;
exports.selectEventsDesc = selectEventsDesc;
const selectEventWinner = `SELECT * FROM entry WHERE eventId = $eventId AND finalPosition = 1`;
exports.selectEventWinner = selectEventWinner;
const selectEntriesByEvent = `SELECT * FROM entry WHERE entry.eventId = $eventId ORDER BY seatNum ASC`;
exports.selectEntriesByEvent = selectEntriesByEvent;
const selectEntriesByEventByPosition = `SELECT * FROM entry WHERE entry.eventId = $eventId ORDER BY finalPosition ASC, seatNum ASC`;
exports.selectEntriesByEventByPosition = selectEntriesByEventByPosition;
const selectEntriesByPlayerAsc = `SELECT entry.* FROM entry JOIN event ON entry.eventId = event.id
    WHERE event.draftDate > $after AND entry.playerId = $playerId ORDER BY event.draftDate ASC LIMIT $howMany`;
exports.selectEntriesByPlayerAsc = selectEntriesByPlayerAsc;
const selectEntriesByPlayerDesc = `SELECT entry.* FROM entry JOIN event ON entry.eventId = event.id
    WHERE event.draftDate < $after AND entry.playerId = $playerId ORDER BY event.draftDate DESC LIMIT $howMany`;
exports.selectEntriesByPlayerDesc = selectEntriesByPlayerDesc;
const selectEntryWins = `SELECT SUM(wins) AS wins FROM (
        SELECT p1MatchWin AS wins FROM pairing WHERE p1Id = $playerId AND eventId = $eventId
    UNION ALL
        SELECT p2MatchWin AS wins FROM pairing WHERE p2Id = $playerId AND eventId = $eventId
    )
`;
exports.selectEntryWins = selectEntryWins;
const selectEntryLosses = `SELECT SUM(losses) AS losses FROM (
    SELECT p2MatchWin AS losses FROM pairing WHERE p1Id = $playerId AND eventId = $eventId
UNION ALL
    SELECT p1MatchWin AS losses FROM pairing WHERE p2Id = $playerId AND eventId = $eventId 
)
`;
exports.selectEntryLosses = selectEntryLosses;
const selectEntriesByCardName = `SELECT entry.* FROM entry JOIN pick 
    ON entry.eventId = pick.eventId AND entry.playerId = pick.playerId
    JOIN event ON entry.eventId = event.id
    WHERE
        pick.cardName = $cardName
    ORDER BY
        event.draftDate DESC
    LIMIT $howMany
    `;
exports.selectEntriesByCardName = selectEntriesByCardName;
const selectOpenEntriesByPlayer = `SELECT * FROM entry WHERE playerId = $playerId AND isOpen = 1`;
exports.selectOpenEntriesByPlayer = selectOpenEntriesByPlayer;
const selectPairingsByEvent = `SELECT * FROM pairing WHERE eventId = $eventId`;
exports.selectPairingsByEvent = selectPairingsByEvent;
const selectPairingsByEventAndRound = `SELECT * FROM pairing WHERE eventId = $eventId AND roundNum = $roundNum`;
exports.selectPairingsByEventAndRound = selectPairingsByEventAndRound;
const selectPairingsByEntry = `SELECT * FROM pairing WHERE eventId = $eventId AND (p1Id = $playerId or p2Id = $playerId)`;
exports.selectPairingsByEntry = selectPairingsByEntry;
const selectPairingsByPlayerPairAsc = `SELECT * FROM pairing 
    WHERE (p1Id = $playerId AND p2Id = $oppId) OR (p2Id = $playerId AND p1Id = $oppId) AND completedDate > $after 
    ORDER BY completedDate ASC LIMIT $howMany`;
exports.selectPairingsByPlayerPairAsc = selectPairingsByPlayerPairAsc;
const selectPairingsByPlayerPairDesc = `SELECT * FROM pairing 
    WHERE (p1Id = $playerId AND p2Id = $oppId) OR (p2Id = $playerId AND p1Id = $oppId) AND completedDate < $after 
    ORDER BY completedDate DESC LIMIT $howMany`;
exports.selectPairingsByPlayerPairDesc = selectPairingsByPlayerPairDesc;
const selectOpenPairingsByPlayer = `SELECT * FROM pairing
    WHERE (p1Id = $playerId OR p2Id = $playerId) and completedDate > $nowTime`;
exports.selectOpenPairingsByPlayer = selectOpenPairingsByPlayer;
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
exports.selectStandingsAllTime = selectStandingsAllTime;
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
exports.selectStandingsBySeason = selectStandingsBySeason;
const selectStandingForPlayerAllTime = `SELECT playerId, season, rank, qps, matchWins, matchLosses, trophies, allTimeRank 
    FROM (${selectStandingsAllTime}) s WHERE playerId = $playerId`;
exports.selectStandingForPlayerAllTime = selectStandingForPlayerAllTime;
const selectStandingForPlayerBySeason = `SELECT playerId, season, rank, qps, matchWins, matchLosses, trophies, allTimeRank
    FROM (${selectStandingsBySeason}) s WHERE playerId = $playerId`;
exports.selectStandingForPlayerBySeason = selectStandingForPlayerBySeason;
const selectPicksForEntry = `SELECT * FROM pick WHERE playerId = $playerId AND eventId = $eventId ORDER BY pickId ASC`;
exports.selectPicksForEntry = selectPicksForEntry;
const selectPickOrderByCard = `SELECT SUM(pick.pickNum * 1.0)/COUNT(pick.pickNum) AS avgPickOrder FROM pick 
    JOIN event ON pick.eventId = event.id
    JOIN cube ON event.cubeId = cube.id
    WHERE cube.cubeType in ($ct1, $ct2, $ct3, $ct4, $ct5)
    AND pick.pickNum IS NOT NULL AND pick.cardName = $cardName`;
exports.selectPickOrderByCard = selectPickOrderByCard;
const selectIsMainPctByCard = `SELECT SUM(pick.isMain * 1.0)/COUNT(pick.isMain) AS isMainPct FROM pick
    JOIN event ON pick.eventId = event.id
    JOIN cube ON event.cubeId = cube.id
    WHERE cube.cubeType IN ($ct1, $ct2, $ct3, $ct4, $ct5)
    AND pick.isMain IS NOT NULL AND pick.cardName = $cardName`;
exports.selectIsMainPctByCard = selectIsMainPctByCard;
const selectWheelPctByCard = `SELECT SUM(CASE WHEN pick.pickNum > 8 THEN 1.0 ELSE 0.0 END)/COUNT(pick.pickNum) AS wheelPct FROM pick
    JOIN event ON pick.eventId = event.id
    JOIN cube ON event.cubeId = cube.id
    WHERE cube.cubeType IN ($ct1, $ct2, $ct3, $ct4, $ct5)
    AND pick.pickNum IS NOT NULL AND pick.cardName = $cardName
`;
exports.selectWheelPctByCard = selectWheelPctByCard;
const selectInPoolCountByCard = `SELECT COUNT(pick.eventId) AS inPoolCount FROM pick
JOIN event ON pick.eventId = event.id
JOIN cube ON event.cubeId = cube.id
WHERE cube.cubeType IN ($ct1, $ct2, $ct3, $ct4, $ct5)
AND pick.cardName = $cardName
`;
exports.selectInPoolCountByCard = selectInPoolCountByCard;
const selectMatchWinsByCard = `SELECT SUM(wins) as wins FROM (
    SELECT pairing.p1MatchWin AS wins FROM pairing JOIN pick 
        ON pick.eventId = pairing.eventId AND pick.playerId = pairing.p1Id
        JOIN event ON event.id = pairing.eventId
        JOIN cube ON event.cubeId = cube.id
        WHERE cube.cubeType IN ($ct1, $ct2, $ct3, $ct4, $ct5)
        AND pick.cardName = $cardName
    UNION ALL
    SELECT pairing.p2MatchWin AS wins FROM pairing JOIN pick
        ON pick.eventId = pairing.eventId AND pick.playerId = pairing.p2Id
        JOIN event ON event.id = pairing.eventId
        JOIN cube ON event.cubeId = cube.id
        WHERE cube.cubeType IN ($ct1, $ct2, $ct3, $ct4, $ct5)
        AND pick.cardName = $cardName
    )   
`;
exports.selectMatchWinsByCard = selectMatchWinsByCard;
const selectMatchLossesByCard = `SELECT SUM(losses) as losses FROM (
    SELECT pairing.p2MatchWin AS losses FROM pairing JOIN pick 
        ON pick.eventId = pairing.eventId AND pick.playerId = pairing.p1Id
        JOIN event ON event.id = pairing.eventId
        JOIN cube ON event.cubeId = cube.id
        WHERE cube.cubeType IN ($ct1, $ct2, $ct3, $ct4, $ct5)
        AND pick.cardName = $cardName
    UNION ALL
    SELECT pairing.p1MatchWin AS losses FROM pairing JOIN pick
        ON pick.eventId = pairing.eventId AND pick.playerId = pairing.p2Id
        JOIN event ON event.id = pairing.eventId
        JOIN cube ON event.cubeId = cube.id
        WHERE cube.cubeType IN ($ct1, $ct2, $ct3, $ct4, $ct5)
        AND pick.cardName = $cardName
    )    
`;
exports.selectMatchLossesByCard = selectMatchLossesByCard;
const selectOwnedMTGOCardByName = `SELECT * FROM mtgoCard WHERE name = $cardName and numOwned > 0`;
exports.selectOwnedMTGOCardByName = selectOwnedMTGOCardByName;
const selectCubesForCard = `SELECT * FROM cube
    WHERE listString LIKE '%\n' || $cardName || '\n%'
    AND activeDate <= $asOf AND inactiveDate > $asOf`;
exports.selectCubesForCard = selectCubesForCard;
const selectCubesByType = `SELECT * FROM cube
    WHERE cubeType = $cubeType ORDER BY activeDate DESC`;
exports.selectCubesByType = selectCubesByType;