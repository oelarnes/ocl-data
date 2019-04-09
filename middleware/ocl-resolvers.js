const mongoose = require('mongoose');
const ObjectId = mongoose.Schema.Types.ObjectId;

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
    playerID: ObjectId,
    decklist: decklistSchema,
    draftLog: String,
    entryPaid: Number,
    entryOwed: Number,
});

const roundResultSchema = mongoose.Schema({
    p1ID: ObjectId,
    p1GameWins: Number,
    p2ID: ObjectId,
    p2GameWins: Number,
    roundNum: Number,
    matchDate: Date,
});

const playerSchema = mongoose.Schema({
    playerName: String,
    discordHandle: String,
    mtgoHandle: String,
    timeZone: String,
})

const OCLEvent = mongoose.model('OCLEvent', oclEventSchema);
const Player = mongoose.model('Player', playerSchema);

const resolvers = { 
    Query: {
        getEvent: async (_, { eventName }) => {
            let p = null;
            await OCLEvent.findOne({eventName}, (err, res) => {
                p = res;
            });
            return p;
        },
        getPlayer: async (_, {playerName, discordHandle, mtgoHandle}) => {
            let p = null;
            await Player.findOne({playerName}, (err, res) => {
                p = res;
            });
            return p;
        },
    },
    Mutation: {
        createEvent: async (_, { eventName }) => {
            let event = new OCLEvent({eventName});
            event.initialize();
            await event.save();
            return event;
        },
        createPlayer: async (_, {playerName}) => {
            let player = new Player({playerName})
            player.save();
            return player;
        }
    }
};

module.exports = resolvers;

function parseEventName(eventName) {
    split = eventName.split('-');
    prizeType = split[0].toUpperCase() || 'ranked';
    roundType = split[1].toUpperCase() || 'weekly';
    startDate = split[2] || Date();
    return {prizeType, roundType, startDate};
}