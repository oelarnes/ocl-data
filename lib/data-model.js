const mongoose = require('mongoose');
const ObjectId = mongoose.Schema.Types.ObjectId;
const oclEnums = require('./enums');

const playerSchema = mongoose.Schema({
    playerName: {
        type: String,
        required: true,
    },
    discordHandle: {
        type: String,
        required: true,
    },
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
    deckBorrowed: Boolean,
    deckReturned: Boolean,
    draftLog: String,
    entryPaid: Number,
    entryOwed: Number,
});

const roundResultSchema = mongoose.Schema({
    p1Id: ObjectId,
    p1GameWins: Number,
    p2Id: ObjectId,
    p2GameWins: Number,
    roundNum: Number,
    matchDate: Date,
});

const prizeSpecSchema = mongoose.Schema({
    qps: Number,
    cash: Number,
    titleGranted: String,
});

const pairingsSchema = mongoose.Schema({
    p1Id: ObjectId,
    p2Id: ObjectId,
    round: Number,
})

const oclEventSchema = mongoose.Schema({
    eventName: String,
    startDate: Date,
    roster: [rosterEntrySchema],
    prizeType: String,
    prizeSpec: [prizeSpecSchema],
    roundType: String,
    tournamentType: String,
    results: [roundResultSchema],
    pairings: [pairingsSchema],
    cubeId: ObjectId,
});

const cubeSchema = mongoose.Schema({
    list: [String],
    dateOfficial: Date,
    dateRetired: Date,
});

cubeSchema.methods.setNewList = function () {
    // todo
};

oclEventSchema.methods.fillFromName = function () {
    this.tournamentType = 'EIGHT_PERSON_BRACKET';
    return Object.assign(this, parseEventName(this.eventName));
};

oclEventSchema.methods.forExport = eventForExport;
oclEventSchema.methods.setRoster = (newRosterIds) => {
    this.roundResults = [];
    this.pairings = [];
    this.roster = newRosterIds.map(playerId => {playerId});
    return this;
};

oclEventSchema.methods.addResults = (roundResults) => {
    this.roundResults = this.roundResults.concat(roundResults);
    return this.updatePairings();
};
oclEventSchema.methods.updatePairings = updatePairings;
oclEventSchema.methods.setDecklistStatusForPlayer = function (playerId, {borrowed, returned}) {
    rosterEntryIndex = this.roster.findIndex((rosterEntry) => rosterEntry.playerId == playerId)[0];
    rostetEntry = this.roster[rosterEntryIndex];
    rosterEntry.deckBorrowed = borrowed;
    rosterEntry.deckReturned = returned;
    this.roster[rosterEntryIndex] = rosterEntry;
    return this;
};

const OCLEvent = mongoose.model('OCLEvent', oclEventSchema);
const Player = mongoose.model('Player', playerSchema);
const Cube = mongoose.model('Cube', cubeSchema);

module.exports = {OCLEvent, Player, Cube};

function exportRoster(oclEvent) {
    const playerResultsMap = oclEvent.results.map(
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

    const rosterExport = oclEvent.roster.map((rosterEntry) => {
        let entryExport = {rosterEntry};
        entryExport.playerWins = playerResultsMap.wins[rosterEntry.playerId];
        entryExport.playerLosses = playerResultsMap.losses[rosterEntry.playerId];
        return entryExport;
    });

    return rosterExport;
}

/*
Method for OCLEvent.prototype
Process an event for query according to GraphQL schema.
Create pairings and interpret round results.
*/
function eventForExport() {
    let exportEvent = {...this};
    exportEvent.rosterExport = exportRoster(exportEvent);
    return exportEvent;
}

/*
 Please Improve this. 
 */
function makePairingsEightPersonBracket(event) {
    if (event.roster.size() < 8 ) {
        return [];
    } else if (event.roster.size() > 8) {
        throw new Error('invalid roster size {} for event type {}'.format(event.roster.size(), event.roster.tournamentType));
    } else {
        let bracketStates = {};
        event.roster.forEach(({playerId}, index) => {
            bracketStates[playerId] = index & 3;
        });
        let loser, winner, state;
        event.roundResults.filter(({roundNum}) => roundNum === 1)
            .forEach(({p1Id, p1GameWins, p2Id, p2GameWins}) => {
                if (bracketStates[p1Id] != bracketStates[p2Id]) {
                    throw new Error('invalid results, {} and {} should not have been paired for round 1'.format(p1Id, p2Id));
                } else {
                    (winner, loser) = (p1GameWins > p2GameWins) ? (p1Id, p2Id) : (p2Id, p1Id);
                    state = bracketStates[p1Id] & 1;
                    bracketStates[winner] = state + 4;
                    bracketStates[loser] = state + 6;
                    }
                }
            );
        event.roundResults.filter(({roundNum}) => roundNum === 2)
            .forEach(({p1Id, p1GameWins, p2Id, p2GameWins}) => {
                if (bracketStates[p1Id] != bracketStates[p2Id] || bracketStates[p1Id] < 4) {
                    throw new Error('invalid results, {} and {} should not have been paired for round 2'.format(p1Id, p2Id));
                } else {
                    (winner, loser) = (p1GameWins > p2GameWins) ? (p1Id, p2Id) : (p2Id, p1Id);
                    state = braketStates[p1ID] & 6;
                    bracketStates[winner] = state + 4;
                    bracketStates[loser] = state + 5;
                }
            });
        event.roundResults.filter(({roundNum}) => roundNum === 3)
            .forEach(({p1Id, p2Id}) => {
                if (bracketStates[p1Id] != bracketStates[p2Id] || bracketStates[p1Id] < 8) {
                    throw new Error('invalid results, {} and {} should not have been paired for round 3'.format(p1Id, p2Id));
                } else {
                    bracketStates[p1Id] = 12;
                    bracketStates[p2Id] = 12;
                }
            });
        let pairings = [];
        for (i=0; i<12; i++) {
            let pair = [];
            event.roster.forEach(({playerId}) => {
                if (bracketStates[playerId] === i) {
                    pair.push(playerId);
                }
            });
            if (size(pair) === 2) {
                pairings.push({p1Id: pair[0], p2Id: pair[1], round: i % 3});
            }
        }
        return pairings;
    }
}

function parseEventName(eventName) {
    const split = eventName.split('-');
    let prizeType = split[0].toUpperCase();
    let roundType = split[1].toUpperCase();
    const startDateStr = split[2] || Date(); // String representation of Current Time
    if (!oclEnums.PrizeType.includes(prizeType)) {
        prizeType = 'SPECIAL';
    };

    if (!oclEnums.RoundType.includes(roundType)) {
        roundType = 'SPECIAL';
    };

    const startDate = new Date(startDateStr);
    return {prizeType, roundType, startDate};
}

function updatePairings() {
    const pairingsMethodMap = {
        'EIGHT_PERSON_BRACKET': makePairingsEightPersonBracket
    };

    this.pairings = (pairingsMethodMap[exportEvent.tournamentType])(this);
    return this;
}