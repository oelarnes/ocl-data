const mongoose = require('mongoose');
const ObjectId = mongoose.Schema.Types.ObjectId;
const oclEnums = require('ocl-enums');

const playerSchema = mongoose.Schema({
    playerName: String,
    discordHandle: String,
    mtgoHandle: String,
    timeZone: String,
    email: String,
});

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

const oclEventSchema = mongoose.Schema({
    eventName: String,
    startDate: Date,
    roster: [rosterEntrySchema],
    prizeType: String,
    roundType: String,
    tournamentType: String,
    results: [roundResultSchema],
});

oclEventSchema.methods.fillFromName = function () {
    this.tournamentType = 'EIGHT_PERSON_BRACKET';
    Object.assign(this, parseEventName(this.eventName));
};

const OCLEvent = mongoose.model('OCLEvent', oclEventSchema);
const Player = mongoose.model('Player', playerSchema);

module.exports = {OCLEvent, Player, exportDecklists};

function exportDecklists(oclEvent) {
    playerResultsMap = oclEvent.results.map(
        (roundResult) => {
            let result;
            if (roundResult.p1GameWins > roundResult.p2GameWins) {
                result = {winner: roundResult.p1id, loser: roundResult.p2id };
            } else {
                result = {winner: roundResult.p2id, loser: roundResult.p1id };
            }
            return result;
        }
    ).reduce((prev, cur) => {
        prev.wins[cur.winner] = (prev.wins[cur.winner] || 0) + 1;
        prev.losses[cur.loser] = (prev.losses[cur.loser] || 0) + 1;
        return prev;
    }, {wins:{}, losses:{}});

    decklists = oclEvent.roster.map((rosterEntry) => {
        list = rosterEntry.decklist;
        list.playerId = rosterEntry.playerId;
        list.draftDate = oclEvent.draftDate;
        list.matchWins = playerResultsMap.wins[list.playerId];
        list.matchLosses = playerResultsMap.losses[list.playerId];
    });
    return decklists;
}

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