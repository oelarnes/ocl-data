const oclTypes = `
    type Query {
        getEvent(eventName: String): Event
        getPlayer(playerName: String, discordHandle: String, mtgoHandle: String): Player
    }
    type Mutation {
        createEvent(eventName: String!): Event!
        createPlayer(playerName: String!): Player!
    }
    enum TimeZone {
        PACIFIC
        CENTRAL
        EASTERN
        BRITISH
    }
    type Player {
        playerName: String!
        discordHandle: String
        mtgoHandle: String
        timeZone: TimeZone
    }
    type Decklist {
        main: [String!]!
        sideboard: [String!]!
    }
    scalar Date
    type RosterEntry {
        playerID: ID!
        decklist: Decklist!
        draftLog: String
        entryPaid: Float
        entryOwed: Float
    }
    type RoundResult {
        p1ID: ID!
        p1GameWins: Int!
        p2ID: ID!
        p2GameWins: Int!
        roundNum: Int!
        matchDate: Date
    }
    enum PrizeType {
        RANKED
        QP
        FULL
        CASH
    }
    enum RoundType {
        WEEKLY
        STF
    }
    enum TournamentType {
        EIGHT_PERSON_BRACKET
    }
    type Event {
        id: ID!
        eventName: String!
        startDate: Date!
        roster: [RosterEntry!]!
        prizeType: PrizeType!
        roundType: RoundType!
        tournamentType: TournamentType!
        results: [RoundResult!]!
    }
`;

module.exports = oclTypes;