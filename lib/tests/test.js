"use strict";

var _db = require("../db");

var _fs = require("fs");

var _updates = require("../updates");

afterAll(() => {
  const db = (0, _db.getDb)();
  db.run('DROP TABLE test;');
  db.close();
});
test('We can create a table in the test database', () => {
  return expect(new Promise((resolve, reject) => {
    const db = (0, _db.getDb)();
    db.run('CREATE TABLE test(x1 TEXT PRIMARY KEY, x2 INT);', {}, err => {
      if (err) {
        reject(err);
      }

      resolve();
    });
    db.close();
  })).resolves.toBeUndefined();
});
test('And insert data into it', () => {
  return expect((0, _db.executeInsertData)('test', [{
    x1: 'a',
    x2: 5
  }])).resolves.toEqual(1);
});
test('We can get the data we inserted with parameters', () => {
  return expect((0, _db.executeSelectOne)('SELECT * FROM test WHERE x1 = $a', {
    $a: 'a'
  })).resolves.toEqual({
    x1: 'a',
    x2: 5
  });
});
test('We can parse a draftlog', () => {
  const processedLog = (0, _updates.processLog)((0, _fs.readFileSync)('./test-data/test-draftlog.txt', 'utf-8'));
  expect(processedLog).toHaveProperty('seatNum', 4);
  expect(processedLog.logRows[0]).toHaveProperty('cardName', 'Ugin, the Spirit Dragon');
  expect(processedLog.logRows[1]).toHaveProperty('packNum', 1);
  expect(processedLog.logRows[1]).toHaveProperty('pickNum', 2);
  expect(processedLog.logRows[43]).toHaveProperty('packNum', 3);
  expect(processedLog.logRows[43]).toHaveProperty('pickNum', 14);
  expect(processedLog.logRows[12]).toHaveProperty('otherCardNamesString', `Satyr Wayfinder
Thrun, the Last Troll`);
});
test('We can parse a decklist', () => {
  const processedDeck = (0, _updates.processDeck)((0, _fs.readFileSync)('./test-data/test-decklist.txt', 'utf-8'));
  expect(processedDeck).toHaveProperty('playerFullName', undefined);
  expect(processedDeck.cardRows[0]).toHaveProperty('isMain', 1);
  expect(processedDeck.cardRows[0]).toHaveProperty('cardName', 'Griselbrand');
  expect(processedDeck.cardRows[26]).toHaveProperty('cardName', 'Bone Shredder');
  expect(processedDeck.cardRows[27]).toHaveProperty('isMain', 0);
  expect(processedDeck.cardRows.length).toEqual(45);
});
test('We can parse a decklist with a name row', () => {
  const processedDeck = (0, _updates.processDeck)((0, _fs.readFileSync)('./test-data/test-decklist-2.txt', 'utf-8'));
  expect(processedDeck).toHaveProperty('playerFullName', 'Pythagoras Rapscallion');
  expect(processedDeck.cardRows[0]).toHaveProperty('isMain', 1);
  expect(processedDeck.cardRows[0]).toHaveProperty('cardName', 'Griselbrand');
  expect(processedDeck.cardRows[26]).toHaveProperty('cardName', 'Bone Shredder');
  expect(processedDeck.cardRows[27]).toHaveProperty('isMain', 0);
  expect(processedDeck.cardRows.length).toEqual(45);
});
test('We can recognize decklists', () => {
  const filename = './test-data/test-decklist-2.txt';
  expect((0, _updates.fileIsDecklist)(filename)).toBe(true);
});