const {OCLEvent, Player, exportDecklists, updateEvent} = require('../middleware/ocl-data');
const expect = require('chai').expect;

describe('OCLEvent', () => {
    let eventName = 'qp-weekly-1Jan20';
    let event = new OCLEvent({eventName: eventName}).fillFromName();
    console.log(event);

    describe('Basic features', () => {
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
    });
});