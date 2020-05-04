import { getDb, executeSelectOne, executeInsertData } from "../db";

afterAll(() => {
    const db = getDb();

    db.run('DROP TABLE test;');
    db.close();
});

test('Test database has no test table', () => {
    const catchFn = jest.fn();
    return executeSelectOne('SELECT * FROM test LIMIT 1').catch(catchFn).then(
        () => expect(catchFn).toHaveBeenCalled()
    );
});

test('We can create a table in the test database', () => {
    return expect(new Promise((resolve, reject) => {
        const db = getDb();
        db.run('CREATE TABLE test(x1 TEXT PRIMARY KEY, x2 INT);', {}, (err) => {
            if (err) {
                reject(err)
            }
            resolve();
        });
        db.close();
    })).resolves.toBeUndefined();
});

test('And insert data into it', () => {
    return expect(executeInsertData('test', [{
        x1: 'a',
        x2: 5
    }])).resolves.toBeUndefined();
});

test('We can get the data we inserted with parameters', () => {
    return expect(executeSelectOne('SELECT * FROM test WHERE x1 = $a', {$a: 'a'}))
        .resolves.toEqual({
            x1: 'a',
            x2: 5
        });
});