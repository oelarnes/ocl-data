const {OCLEvent, Player, exportDecklists} = require('./ocl-data');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

const typeDefs = `
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
    input EventInput {
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
        getPlayers: [Player!]!
        getEvents: [Event!]!
        getDecklists(eventId: ID!): [Decklist!]!
    }
    type Mutation {
        createPlayer(
            playerInput: PlayerInput!
        ): Player
        updatePlayer(
            playerId: ID!,
            playerInput: PlayerInput!
        ): Player
        deletePlayer(
            playerId: ID!
        ): Int!
        createEvent(
            eventName: String!
        ): Event!
        updateEvent(
            eventId: ID!,
            eventInput: EventInput!
        ): Event
    }
`;

//         deleteEvent(
//             eventId: ID!
//         ): Event
//         replaceRoster(
//             eventId: ID!,
//             playerNames: [String!]!, 
//         ): Event
//         replaceRoundResults(
//             eventId: ID!,
//             resultsEntries: [RoundResultInput!]!
//         ): RoundResult
//         replaceDecklist(
//             eventId: ID!,
//             playerId: ID!,
//             decklist: DecklistInput!
//         ): Event
//     }
// `;

const resolvers = { 
    Query: {
        getPlayers: () => Player.find({}),
        getEvents: () => OCLEvent.find({}),
        getDecklists: (_, {eventId}) => OCLEvent.findOne({id: eventId}).then(exportDecklists),
    },
    Mutation: {
        createPlayer: (_, {playerInput}) => new Player(playerInput).save(),
        updatePlayer: (_, {playerId, playerInput}) => Player.findOne({_id: new ObjectId(playerId)}).then(
            (player) => (Object.assign(player, playerInput)).save()
        ),
        deletePlayer: (_, {playerId}) => Player.remove({_id: new ObjectId(playerId)}).then(({deletedCount}) => deletedCount),
        createEvent: (_, {eventName}) => new OCLEvent({eventName}).fillFromName().save(),
        updateEvent: (_, {eventId, eventInput}) => OCLEvent.findOne({id: eventId}).then(
            (event) => {Object.assign(event, eventInput)}
        ).save(),
    }
};

module.exports = {resolvers, typeDefs};