const oclTypes = `
    type Query {
        getEvent(eventName: String): Event
        getPlayer(queryName: String!): Player
    }
    type Mutation {
        createEvent(eventName: String!): Event!
        createPlayer(
            playerInput: PlayerInput!
        ): Player!
        addRoster(
            eventName: String!,
            playerNames: [String!]!, 
        ): Event!
        addDecklist(
            eventName: String!,
            playerName: String!,
            decklist: Decklist!
        ): Event!
        addRoundResults(
            eventName: String!,
            resultsEntries: [RoundResultInput!]!
        ): RoundResult
    }
    enum TimeZone {
        PACIFIC
        CENTRAL
        EASTERN
        BRITISH
    }
    input PlayerInput {
        playerName: String!
        discordHandle: String!
        mtgoHandle: String!
        timeZone: TimeZone!
        email: String
    }
    type Player {
        id: ID!
        playerName: String!
        discordHandle: String!
        mtgoHandle: String!
        timeZone: TimeZone!
        email: String
    }
    type Decklist {
        main: [String!]!
        sideboard: [String!]!
    }
    scalar Date
    type RosterEntry {
        playerId: ID!
        decklist: Decklist!
        draftLog: String
        entryPaid: Float
        entryOwed: Float
    }
    input RoundResultInput {
        p1QueryName: String!
        p1GameWins: Int!
        p2QueryName: String!
        p2GameWins: Int!
        roundNum: Int!
        matchDate: Date
    }
    type RoundResult {
        id: ID!
        p1Id: ID!
        p1GameWins: Int!
        p2Id: ID!
        p2GameWins: Int!
        roundNum: Int!
        matchDate: Date
    }
    enum PrizeType {
        RANKED
        QP
        FULL
        CASH
        SPECIAL
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
        prizeSpec: [PrizeSpec!]
        roundType: RoundType!
        tournamentType: TournamentType!
        results: [RoundResult!]!
    }
    type PrizeSpec {
        qps: Int!
        cash: Float!
    }
`;

module.exports = oclTypes;