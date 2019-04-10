const mongoose = require('mongoose');
const ObjectId = mongoose.Schema.Types.ObjectId;
const oclEnums = require('ocl-enums');

const oclEventSchema = mongoose.Schema({
    eventName: String,
    startDate: Date,
    roster: Array,
    prizeType: String,
    roundType: String,
    tournamentType: String,
    results: Array,
});

oclEventSchema.methods.initialize = function () {
    this.tournamentType = 'EIGHT_PERSON_BRACKET';
    Object.assign(this, parseEventName(this.eventName));
};

const decklistSchema = mongoose.Schema({
    main: Array,
    sideboard: Array,
});

const rosterEntrySchema = mongoose.Schema({
    playerId: ObjectId,
    decklist: decklistSchema,
    draftLog: String,
    entryPaid: Number,
    entryOwed: Number,
});

const roundResultSchema = mongoose.Schema({
    p1id: ObjectId,
    p1GameWins: Number,
    p2id: ObjectId,
    p2GameWins: Number,
    roundNum: Number,
    matchDate: Date,
});

const playerSchema = mongoose.Schema({
    playerName: String,
    discordHandle: String,
    mtgoHandle: String,
    timeZone: String,
    email: String,
})

const OCLEvent = mongoose.model('OCLEvent', oclEventSchema);
const Player = mongoose.model('Player', playerSchema);

const resolvers = { 
    Query: {
        getEvent: (_, {eventName}) => {
            return OCLEvent.findOne({eventName})
        },
        getPlayer: async (_, {queryName}) => {
            return await Player.findOne({playerName: queryName}) ||
                await Player.findOne({discordHande: queryName}) ||
                await Player.findOne({mtgoHandle: queryName});
        },
    },
    Mutation: {
        createEvent: (_, { eventName }) => {s
            let event = new OCLEvent({eventName});
            event.initialize();
            return event.save()
        },
        createPlayer: (_, params) => {
            let player = new Player(params)
            return player.save()
        },
    }
};

module.exports = resolvers;

function parseEventName(eventName) {
    split = eventName.split('-');
    prizeType = split[0].toUpperCase() || 'ranked';
    roundType = split[1].toUpperCase() || 'weekly';
    startDate = split[2] || Date(); // String representation of Current Time
    if (!(prizeType in oclEnums.PrizeType)) {
        prizeType = 'SPECIAL';
    };

    if (!(roundType in oclEnums.RountType)) {
        roundType = 'SPECIAL';
    };

    startDate = new Date(startDate);
    return {prizeType, roundType, startDate};
}

function getFullPlayerRecord(playerId) {
    
}