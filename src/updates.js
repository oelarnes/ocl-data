import { readFileSync, readdirSync, promises as fsPromises } from 'fs'
import path from 'path'

import { parseStringPromise } from 'xml2js'

import { executeInsertData, executeSelectSome, executeSelectOne, executeRun, getFreshDbConfig, updateEventData } from './db'
import { oclMongo } from '../lib/db'

const DATA_FOLDER = './data'
const SELECTION_REGEX = /--> (.*)/
const CARD_ROW_REGEX = /^[0-9]* (.*)/
const BASIC_REGEX = /^[0-9]* (Plains|Island|Swamp|Mountain|Forest)$/

async function importDekFiles() {
    const dekSources = getFreshDbConfig().dekFiles
    const knownSources = await executeSelectSome(`SELECT DISTINCT dekSource FROM mtgoCard`, {}, 'dekSource')

    if (Object.values(dekSources).filter(source => !knownSources.includes(source)).length) {
        console.log('Processing new collection dek files: %s', Object.values(dekSources).join('\n'))
        const ownedCardRows = await parseStringPromise(readFileSync(path.join(DATA_FOLDER, dekSources.owned)))
            .then(result => result.Deck.Cards.map(card => (
                {
                    id: card.$.CatID,
                    numOwned: card.$.Quantity,
                    numWishlist: 0,
                    mtgoName: card.$.Name,
                    dekSource: dekSources.owned
                }
            )))
        const wishlistCardRows = await parseStringPromise(readFileSync(path.join(DATA_FOLDER, dekSources.wishlist)))
            .then(result => result.Deck.Cards.map(card => (
                {
                    id: card.$.CatID,
                    numOwned: 0,
                    numWishlist: card.$.Quantity,
                    mtgoName: card.$.Name,
                    dekSource: dekSources.wishlist
                }
            )))

        const rowMap = ownedCardRows.concat(wishlistCardRows).reduce((prev, curr) => {
            prev[curr.id] = curr
            return prev
        }, {})

        const insertRowsTemp = await extendMtgoRows(rowMap)
        const asOf = await scryfallAsOf()

        const missingCards = Object.keys(rowMap).filter(
            v => !insertRowsTemp.map(row => row.id.toString()).includes(v)
        )

        let insertRows = insertRowsTemp
        // a few cards are missing from Scryfall by mtgo_id
        if (missingCards.length < 0.01 * insertRows.length) {
            insertRows = insertRowsTemp.concat(missingCards.map(idString => {
                const dekRow = rowMap[idString]
                return {
                    ...dekRow,
                    name: dekRow.mtgoName,
                    tix: null,
                    isFoil: false
                }
            }))
        }

        if (insertRows.length === Object.keys(rowMap).length) {
            await executeRun(`DELETE FROM mtgoCard`)
            await executeInsertData('mtgoCard', insertRows.map(row => ({
                ...row,
                tixAsOf: asOf
            })))
        } else {
            console.log('Insufficient matching card data found, mtgoCard not updated')
        }
    }
    return
}

async function scryfallAsOf() {
    const mongo = await oclMongo()
    
    return mongo.collection('import_metadata').findOne({}).then(item => item?.as_of).catch(err => {
        console.log(err)
        return
    })
}

function scryfallCardName(sfRow) {
    const useFrontFaceName = ['transform', 'flip', 'adventure']
    if (useFrontFaceName.includes(sfRow.layout)) {
        return sfRow.card_faces[0].name
    }
    return sfRow.name
}

async function extendMtgoRows(rowMap) {
    const mtgoIds = Object.keys(rowMap).map(key => parseInt(key))
    const mongo = await oclMongo()

    const rows = await mongo.collection('cards_en').find(
        { mtgo_id: { $in: mtgoIds } }
    ).toArray()

    return rows.map(row => {
        const baseRow = rowMap[row.mtgo_id.toString()]
        return {
            ...baseRow,
            name: scryfallCardName(row),
            tix: row.prices.tix,
            isFoil: false
        }
    })
}

async function dataSync() {
    console.log('%s Looking for new source files and updating open events...', new Date().toISOString())

    await processAllEventFiles()
    await importDekFiles()
    const dbConfig = getFreshDbConfig()

    const knownEventIds = await executeSelectSome(`SELECT id FROM event`, {}, 'id')
    const newEvents = Object.keys(dbConfig.eventSheets).filter(eventId => !knownEventIds.includes(eventId))
    const openEvents = await executeSelectSome(`SELECT id FROM event WHERE completedDate > $today`, { $today: new Date().toISOString() }, 'id')

    for (const event of openEvents.concat(newEvents)) {
        const sheetId = dbConfig.eventSheets[event]
        if (sheetId === undefined) {
            throw `No event sheet for open event ${event}`
        }
        console.log('Updating data for open event %s', event)
        await updateEventData(sheetId)
    }
    return
}

async function dataSyncLoop(cadence = 1000 * 60 * 5) {
    await dataSync()

    console.log('Updates complete, scheduling next update for %s...', new Date(new Date().getTime() + cadence))
    setTimeout(dataSyncLoop, cadence)
    return
}

function fileIsDecklist(filename) {
    const fileContents = readFileSync(filename, 'utf-8').replace(/\r/g, '')
    const deckLines = fileContents.split('=\n').slice(-1)[0].split('\n').map(r => r.trim())
    return deckLines.filter(row => CARD_ROW_REGEX.test(row) && !BASIC_REGEX.test(row)).length <= 45
        && deckLines.filter(row => !CARD_ROW_REGEX.test(row) && !BASIC_REGEX.test(row)).length <= 2
}

function fileIsDraftLog(filename) {
    const fileContents = readFileSync(filename, 'utf-8')
    const selectionLines = fileContents.split('\n').filter(line => SELECTION_REGEX.test(line))
    return selectionLines.length == 46
}

async function processAllEventFiles() {
    const allEventIds = await executeSelectSome('SELECT id FROM event', {}, 'id')
    const allFolders = readdirSync(
        path.join(DATA_FOLDER, 'events')
    ).filter(item => allEventIds.includes(item))

    allEventIds.filter(item => !allFolders.includes(item)).forEach(async item => {
        console.log('Creating event folder for %s', item)
        fsPromises.mkdir(`./data/events/${item}`)
    })

    for (const eventId of allFolders) {
        await processOneEvent(eventId)
    }

    return
}

async function processOneEvent(eventId) {
    const eventPath = path.join(DATA_FOLDER, 'events', eventId)
    const txtFileNames = readdirSync(eventPath).filter(item => /\.txt$/.test(item))

    const allSources = await executeSelectSome(`SELECT draftlogSource AS source FROM pick WHERE eventId = $eventId 
        UNION ALL 
        SELECT decklistSource AS source FROM pick WHERE eventId = $eventId`,
        { $eventId: eventId },
        'source'
    )

    const logFileNames = txtFileNames.filter(filename => fileIsDraftLog(path.join(eventPath, filename)))
    const newLogFiles = logFileNames.filter(filename => !allSources.includes(filename))
    
    if (newLogFiles.length > 0) {
        console.log(`Found new log file ${newLogFiles[0]} and ${newLogFiles.length - 1} others in event ${eventId}. Reprocessing picks now...`)

        await executeRun(`DELETE FROM pick WHERE eventId = $eventId`, { $eventId: eventId })
        const seatings = await executeSelectSome('SELECT playerId FROM entry WHERE eventId = $eventId ORDER BY seatNum ASC', { $eventId: eventId }, 'playerId')

        for (const filename of logFileNames) {
            await loadLogAndWrite(filename, eventId, seatings)
        }
    }

    const deckFileNames = txtFileNames.filter(filename => fileIsDecklist(path.join(eventPath, filename)))
    const newDeckFiles = deckFileNames.filter(filename => !allSources.includes(filename))

    if (newDeckFiles.length > 0) {
        console.log(`Found new deck file ${newDeckFiles[0]} and ${newDeckFiles.length - 1} others in event ${eventId}. Reprocessing picks now...`)
        for (const filename of deckFileNames) {
            await loadDeckAndWrite(filename, eventId)
        }
    }

    return
}

async function loadLogAndWrite(filename, eventId, seatings) {
    const processedLog = processLog(readFileSync(path.join(DATA_FOLDER, 'events', eventId, filename), 'utf-8'))

    const playerId = seatings[processedLog.seatNum - 1]
    const fullName = await executeSelectOne('SELECT fullName FROM player WHERE id = $playerId', { $playerId: playerId }, 'fullName')
    console.log(`Inferred identity of ${processedLog.playerTag} as ${fullName} in event ${eventId}`)

    const uploadTable = processedLog.logRows.map((logRow) => {
        return {
            ...logRow,
            playerId,
            eventId,
            draftlogSource: filename
        }
    })

    return executeInsertData('pick', uploadTable)
}

async function loadDeckAndWrite(filename, eventId) {
    const processedDeck = processDeck(readFileSync(path.join(DATA_FOLDER, 'events', eventId, filename), 'utf-8'))
    let playerId

    if (!processedDeck.cardRows) {
        throw `Decklist file ${filename} for event ${eventId} has no cards.`
    }
    if (processedDeck.playerFullName === undefined) {
        playerId = await executeSelectSome(
            `SELECT entry.playerId FROM entry JOIN pick ON entry.playerId = pick.playerId AND entry.eventId = pick.eventId WHERE entry.eventId = $eventId AND pick.cardName = $cardName`,
            {
                $cardName: processedDeck.cardRows[0].cardName,
                $eventId: eventId
            }
        ).then((rows) => {
            if (rows.length > 1) {
                throw 'Multiple entries found containing some card from this deck. Does the cube have multiples? If so fix logic!'
            }

            if (rows.length === 0) {
                throw 'No entry found drafting any of these cards!'
            }

            return rows[0].playerId
        })
    } else {
        playerId = await executeSelectOne(`SELECT id FROM player WHERE fullName = $playerFullName`, { $playerFullName: processedDeck.playerFullName }).then((row) => {
            if (!row) {
                throw `No player found with name ${processedDeck.playerFullName}`
            }
            return row.id
        })
    }

    for (let cardRow of processedDeck.cardRows) {
        // select the first row of this entry with matching cardname and no main/sb info
        const matchingRow = await executeSelectOne(
            `SELECT * FROM pick WHERE eventId = $eventId AND playerId = $playerId AND cardName = $cardName AND isMain IS NULL`,
            {
                $playerId: playerId,
                $eventId: eventId,
                $cardName: cardRow.cardName
            }
        )
        if (matchingRow) {
            await executeRun(`UPDATE pick SET isMain = $isMain, decklistSource = $decklistSource 
                WHERE playerId = $playerId AND eventId = $eventId AND pickId = $pickId AND isMain IS NULL`,
                {
                    $isMain: cardRow.isMain,
                    $playerId: playerId,
                    $eventId: eventId,
                    $pickId: matchingRow.pickId,
                    $decklistSource: filename
                }
            )
        } else {
            const pickId = await executeSelectOne(`SELECT max(pickId)+1 AS newId FROM pick WHERE playerId = $playerId AND eventId = $eventId`,
                { $playerId: playerId, $eventId: eventId }, 'newId') || 1
            await executeRun(
                `INSERT INTO pick(playerId, eventId, pickId, isMain, cardName, decklistSource) VALUES ($playerId, $eventId, $pickId, $isMain, $cardName, $decklistSource)`,
                { $playerId: playerId, $eventId: eventId, $pickId: pickId, $isMain: cardRow.isMain, $cardName: cardRow.cardName, $decklistSource: filename }
            )
        }

    }
    return
}

function processLog(draftLog) {
    const selectionRegex = /--> (.*)/
    draftLog = draftLog.replace(/\r/g, '')
    const segments = draftLog.split('\n\n').filter((segment) => selectionRegex.test(segment))

    if (segments.length !== 46) {
        throw 'Invalid draftlog, missing correct number of "-->" indicators or improperly separated.'
    }
    const playerLines = segments[0].split('\n').filter(line => /[a-zA-z]/.test(line)).slice(3, 11)
    if (playerLines.length != 8) {
        throw 'Invalid draftlog, header does not have 8 players, or some other error.'
    }
    const seatNum = playerLines.findIndex(line => selectionRegex.test(line)) + 1
    const playerTag = playerLines.find(line => selectionRegex.test(line)).match(selectionRegex)[1]

    const pickSegments = segments.slice(1, 46)

    const logRows = pickSegments.map((segment, index) => {
        const cardLines = segment.split('\n').slice(1)
        const pickLine = cardLines.find(el => selectionRegex.test(el)).trim()
        if (!pickLine) {
            throw 'Invalid draftlog, pick segment missing selection indicator'
        }
        const cardName = pickLine.match(selectionRegex)[1]
        const contextLines = cardLines.filter(line => !selectionRegex.test(line)).map(s => s.trim())
        return {
            cardName,
            otherCardNamesString: contextLines.join('\n'),
            pickId: index + 1,
            packNum: Math.floor(index / 15) + 1,
            pickNum: index % 15 + 1
        }
    })

    return {
        seatNum,
        playerTag,
        logRows
    }
}

function processDeck(decklist) {
    const nameMap = {
        'Never/Return': 'Never // Return'
    }

    decklist = decklist.replace(/\r/g, '')

    const nameCheckSplit = decklist.split('=\n')
    let playerFullName

    if (nameCheckSplit.length > 1) {
        playerFullName = nameCheckSplit[0].trim()
        decklist = nameCheckSplit[1]
    }

    const lines = decklist.split('\n').filter(line =>
        (!BASIC_REGEX.test(line) && (CARD_ROW_REGEX.test(line) || line === ''))
    )

    const sbBreakIndex = lines.findIndex(line => line === '')

    return {
        cardRows: lines.slice(0, sbBreakIndex).map(line => {
            const mtgoName = line.match(CARD_ROW_REGEX)?.[1]?.trim()
            return {
                cardName: nameMap[mtgoName] || mtgoName,
                isMain: 1
            }
        }).concat(
            lines.slice(sbBreakIndex + 1).map(line => {
                const mtgoName = line.match(CARD_ROW_REGEX)?.[1]?.trim()
                return {
                    cardName: nameMap[mtgoName] || mtgoName,
                    isMain: 0
                }
            })
        ).filter((row) => row.cardName !== undefined),
        playerFullName
    }
}
async function writeDraftStats(draftStats) {
    const handleIdMap = await executeSelectSome(`SELECT * FROM player`).then(rows => rows.reduce((prev, cur) => {
        prev[cur.discordHandle] = cur.id
        return prev
    }, {}))

    for (const handle of Object.keys(draftStats.draft)) {
        if (handleIdMap[handle] !== undefined) {
            await executeInsertData('pick', draftStats.draft[handle].map((pick, index) => ({
                playerId: handleIdMap[handle],
                eventId: draftStats.title,
                cardName: pick.picked,
                otherCardNamesString: pick.notPicked.join('\n'),
                pickId: index + 1,
                packNum: Math.floor(index / 15) + 1,
                pickNum: index % 15 + 1
            })));
        }
    }
    return true
}

export {
    processAllEventFiles,
    processLog,
    processDeck,
    fileIsDecklist,
    fileIsDraftLog,
    dataSyncLoop,
    dataSync,
    writeDraftStats
}