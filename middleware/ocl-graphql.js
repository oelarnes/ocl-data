const {OCLEvent, Player} = require('ocl-data');

const oclTypes = `
    scalar Date
    enum TimeZone {
        PACIFIC
        CENTRAL
        EASTERN
        BRITISH
    }
    input PlayerInput {
        playerName: String
        discordHandle: String
        mtgoHandle: String
        timeZone: TimeZone
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
    input DecklistInput {
        main: [String!]!
        sideboard: [String!]!
    }
    type Decklist {
        draftDate: Date!
        playerId: ID!
        matchWins: Int!
        matchLosses: Int!
        main: [String!]!
        sideboard: [String!]!
    }
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
    input PrizeSpecInput {
        qps: Int!
        cash: Float!
    }
    type PrizeSpec {
        qps: Int!
        cash: Float!
    }
    type EventInput {
        eventName: String
        startDate: Date
        prizeType: PrizeType
        prizeSpec: [PrizeSpecInput]
        roundType: RoundType
        tournamentType: TournamentType
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
    type Query {
        getPlayers(): [Player!]!
        getEvents(): [OCLEvent!]!
        getDecklists(eventId: ID!): [Decklist!]!
    }
    type Mutation {
        createPlayer(
            playerInput: PlayerInput!
        ): Player
        updatePlayer(
            playerId: ID!
            playerInput: PlayerInput!
        ): Player
        deletePlayer(
            playerId: ID!
        ): Player
        createEvent(
            eventName: String!
        ): Event!
        updateEvent(
            eventId: ID!
            eventInput: EventInput!
        ): Event
        deleteEvent(
            eventId: ID!
        ): Event
        replaceRoster(
            eventId: ID!,
            playerNames: [String!]!, 
        ): Event
        replaceRoundResults(
            eventId: ID!,
            resultsEntries: [RoundResultInput!]!
        ): RoundResult
        replaceDecklist(
            eventId: ID!,
            playerId: ID!,
            decklist: DecklistInput!
        ): Event
    }
`;

const resolvers = { 
    Query: {
        getPlayers: () => {
            return Player.find({});
        },
        getEvents: () => {
            return OCLEvent.find({});
        },
        getDecklists: (_, {eventId}) => {
            return OCLEvent.findOne({id: eventId}).then(exportDecklists)
        },
    },
    Mutation: {
        createPlayer: (_, params) => {
            let player = new Player(params)
            return player.save()
        },
        createEvent: (_, { eventName }) => {
            let event = new OCLEvent({eventName});
            event.fillFromName();
            return event.save()
        },
    }
};

module.exports = {resolvers, oclTypes};