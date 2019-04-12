const {OCLEvent, Player, exportDecklists} = require('../middleware/ocl-data');
const expect = require('chai').expect;

describe('OCLEvent', () => {
    eventName = 'qp-weekly-1Jan20';
    event = new OCLEvent({eventName: eventName}).fillFromName();

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