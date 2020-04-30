export const queries = {
    // Drop Table
    drop_player_table: 'DROP TABLE IF EXISTS player;',
    drop_event_table: 'DROP TABLE IF EXISTS event;',
    drop_entry_table: 'DROP TABLE IF EXISTS entry;',
    drop_pairing_table: 'DROP TABLE IF EXISTS pairing;',
    // Create Table
    create_playery_table: `
    CREATE TABLE IF NOT EXISTS player(
        id text PRIMARY KEY,
        fullName text UNIQUE,
        discordHandle text,
        discordIdExt text,
        timeZone text,
        pronouns text,
        email text
    );`,
    create_event_table:  `
    CREATE TABLE IF NOT EXISTS event(
        id text PRIMARY KEY,
        prizeType text,
        draftDate text,
        completeDate text, 
        cubeId text,
        season text
    );`, 
    create_entry_table: ` 
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
    );`,
    create_pairing_table: `
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
    `,
    //Select
    select_player: `SELECT * FROM player WHERE id = $playerId;`,
    select_event: `SELECT * FROM event WHERE id = $eventId;`,
    select_entry: `SELECT * FROM entry WHERE eventId = $eventId and playerId = $playerId;`,
    select_players_order_id_asc: `SELECT * FROM player WHERE id > $after ORDER BY id ASC LIMIT $howMany;`,
    select_players_order_id_desc: `SELECT * FROM player WHERE id < $after ORDER BY id DESC LIMIT $howMany;`,
    select_players_order_name_asc: `SELECT * FROM player WHERE fullName > $after ORDER BY fullName ASC LIMIT $howMany;`,
    select_players_order_name_desc: `SELECT * FROM player WHERE fullName < $after ORDER BY fullName DESC LIMIT $howMany;`,
    select_player_qps: `SELECT SUM(entry.qpsAwarded) as qps FROM entry JOIN event ON entry.eventId = event.id
        WHERE entry.playerId = $playerId AND event.season = $season;`
};