"use strict";

var _db = require("../db");

var _draftLogs = require("../draftLogs");

afterAll(() => {
  const db = (0, _db.getDb)();
  db.run('DROP TABLE test;');
  db.close();
});
test('Test database has no test table', () => {
  const catchFn = jest.fn();
  return (0, _db.executeSelectOne)('SELECT * FROM test LIMIT 1').catch(catchFn).then(() => expect(catchFn).toHaveBeenCalled());
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
  }])).resolves.toBeUndefined();
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
  const processedLog = (0, _draftLogs.processLog)(readFileSync('./test-data/test-draftlog.txt', 'utf-8'));
  expect(processedLog).toHaveProperty('seatNum', 4);
  expect(processedLog.logRow[0]).toHaveProperty('card', 'Ugin, the Spirit Dragon');
  expect(processedLog.logRow[1]).toHaveProperty('packNum', 1);
  expect(processedLog.logRow[1]).toHaveProperty('pickNum', 1);
  expect(processedLog.logRow[13]).toHaveProperty('otherCardsString', 'Tangle Wire\n');
});