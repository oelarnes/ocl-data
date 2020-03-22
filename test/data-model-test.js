const {OCLEvent, Player} = require('../lib/data-model');
const expect = require('chai').expect;
const testData = require('./data-model-test-data');

describe('Player', () => {
    let player = new Player(testData.players[0]);

    it('should have a name and discord handle', () => {
        expect(player.playerName).to.equal('Andy');
        expect(player.discordHandle).to.equal('andy_d');
    });

    it('might have a mtgo handle', () => {
        expect(player.mtgoHandle).to.equal('andy_m');
    });
});

describe('OCLEvent', () => {
    let eventName = 'qp-weekly-1Jan20';
    let event = new OCLEvent({eventName: eventName}).fillFromName();

    describe('fillFromName', () => {
        it('should have the given name', () => {
            expect(event.eventName).to.equal(eventName);
        });
        it('should have the right prizeType', () => {
            expect(event.prizeType).to.equal('QP');
        });
        it('should have the right roundType', () => {
            expect(event.roundType).to.equal('WEEKLY');
        });
        it('should have the right tournamentType', () => {
            expect(event.tournamentType).to.equal('EIGHT_PERSON_BRACKET');
        });
        it('should have the right prizeSpec', () => {
            expect(event.prizeSpec[0]).to.include(
                {'qps': 4},
            );
            expect(event.prizeSpec[1]).to.include(
                {'qps': 2},
            );
        });
    });

    describe('setRoster', () => {
        it('should be tested', () => {
            expect(false).true;
        });
    });

    describe('addDecklist', () => {
        it('should be tested', () => {
            expect(false).true;
        });
    });

    describe('addResults', () => {
        it('should be tested', () => {
            expect(false).true;
        })
    });

    describe('setDecklistStatus', () => {
        it('should be tested', () => {
            expect(false).true;
        });
    });

    describe('markPaid', () => {
        it('should be tested', () => {
            expect(false).true;
        });
    });

    describe('validateDecklist', () => {
        it('should be tested', () => {
            expect(false).true;
        });
    });

    describe('forExport', () => {
        it('should be tested', () => {
            expect(false).true;
        });
    });

});