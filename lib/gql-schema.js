const {OCLEvent, Player, Cube} = require('./data-model');

const typeDefs = `
    scalar Date
    enum TimeZone {
        PACIFIC
        MOUNTAIN
        CENTRAL
        EASTERN
        BRITISH
    }
    input PlayerInput {
        fullName: String
        familiarName: String
        discordHandle: String
        mtgoHandle: String
        timeZone: TimeZone
        pronouns: String
        email: String
    }
    type Player {
        id: ID!
        fullName: String
        familiarName: String
        discordHandle: String
        mtgoHandle: String
        timeZone: TimeZone
        pronouns: String
        email: String
    }
    type DraftRecord {
        draftDate: Date!
        player: Player!
        matchWins: Int!
        matchLosses: Int!
        cards: [DraftPick]
    }
    type DraftPick {
        cardName: String
        pack: Int
        pick: Int
        isMain: Boolean
    }
    type RosterEntry {
        playerId: ID!
        decklist: Decklist
        draftLog: String
        deckBorrowed: Boolean
        deckReturned: Boolean
        entryPaid: Float
        entryOwed: Float
    }
    input RoundResultInput {
        p1Id: ID!
        p1GameWins: Int!
        p2Id: ID!
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
        qps: Int
        cash: Float
    }
    input EventInput {
        eventName: String
        cubeId: ID!
        startDate: Date
        prizeType: PrizeType
        prizeSpec: [PrizeSpecInput]
        roundType: RoundType
        tournamentType: TournamentType
        buyIn: Float
    }
    type Pairing {
        p1Id: ID!
        p2Id: ID!
        round: Int!
        dueTime: Date
    }
    type Event {
        id: ID!
        eventName: String!
        cubeId: ID!
        startDate: Date!
        roster: [RosterEntry!]!
        prizeType: PrizeType!
        prizeSpec: [PrizeSpec!]
        roundType: RoundType!
        tournamentType: TournamentType!
        pairings: [Pairing!]!
        results: [RoundResult!]!
        buyIn: Float
    }
    type Query {
        getPlayers: [Player!]!
        getEvents: [Event!]!
        getEvent(eventId: ID!): Event
        getDecklists(eventId: ID!): [Decklist!]!
        getCurrentCubeId: ID!
    }
    type Mutation {
        createPlayer(
            playerInput: PlayerInput!
        ): Player
        updatePlayer(
            playerId: ID!,
            playerInput: PlayerInput!
        ): Player
        setCube(
            list: [String!]!
        ): ID!
        createEvent(
            eventName: String!
        ): Event!
        updateEvent(
            eventId: ID!,
            eventInput: EventInput!
        ): Event
        setRoster(
            eventId: ID!,
            playerIds: [ID!]!, 
        ): Event
        addRoundResults(
            eventId: ID!,
            resultsEntries: [RoundResultInput!]!
        ): Event
        addDecklist(
            eventId: ID!,
            playerId: ID!,
            decklistInput: DecklistInput!
        ): Event
        setDecklistStatus(
            eventId: ID!,
            playerId: ID!,
            borrowedStatus: Boolean!,
            returnedStatus: Boolean!
        ): Decklist
        markPaid(
            eventId: ID!,
            playerId: ID!
        ): Int
    }
`;

const resolvers = { 
    Query: {
        getPlayers: () => Player.find({}),
        getEvents: () => OCLEvent.find({}),
        getEvent: (_, {eventId}) => OCLEvent.findById(eventId),
        getCurrentCubeId: () => Cube.findOne({dateRetired: null}).then(cube => cube.id),
        getDecklists: (_, {eventId}) => OCLEvent.findOne({id: eventId})
            .then(event => event.exportDecklists())
    },
    Mutation: {
        createPlayer: (_, {playerInput}) => new Player(playerInput).save(),
        updatePlayer: (_, {playerId, playerInput}) => Player.findById(playerId)
            .then((player) => Object.assign(player, playerInput).save()),
        createEvent: (_, {eventName}) => new OCLEvent({eventName}).fillFromName().setCube()
            .then(event => event.save()),
        setCube: (_, {list}) => new Cube({list}).setNewList(),
        updateEvent: (_, {eventId, eventInput}) => OCLEvent.findById(eventId)
            .then((event) => Object.assign(event, eventInput).save()),
        setRoster: (_, {eventId, playerIds}) => OCLEvent.findById(eventId)
            .then(event => event.setRoster(playerIds).updatePairings().save()),
        addRoundResults: (_, {eventId, resultsEntries}) => OCLEvent.findById(eventId)
            .then(event => event.addResults(resultsEntries).save()),
        addDecklist: (_, {eventId, playerId, decklistInput}) => OCLEvent.findById(eventId)
            .then(event => event.addDecklist(playerId, decklistInput).save()),
        setDecklistStatus: (_, {eventId, playerId, borrowedStatus, returnedStatus}) => 
            OCLEvent.findById(eventId).then(event => event.setDecklistStatus(
                playerId, {borrowed: borrowedStatus, returned: returnedStatus}).save()),
        markPaid: (_, {eventId, playerId}) => OCLEvent.findById(eventId)
            .then(event => event.markPaid(playerId).save())
    }
};

module.exports = {resolvers, typeDefs};