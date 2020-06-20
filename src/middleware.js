import { readFileSync } from "fs"

import graphqlHTTP from "express-graphql"
import { makeExecutableSchema } from "graphql-tools"

import { executeSelectOne, executeSelectSome, addEventToConfig, getFreshDbConfig, executeRun } from "./db"
import * as sql from "./sqlTemplates"
import { syncData } from "./updates"
import axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'

const MAX_RESULTS = 10000
const MAX_DATE = "9999-12-31"
const MIN_DATE = "0000-00-00"
const ALL_CUBE_TYPES = ['Classic', 'Interactive', 'Powered']

function getDateAfter(after, asc) {
    return after || (asc && MIN_DATE) || (!asc && MAX_DATE)
}

function cubeTypeArgs(cubeTypes) {
    const ctArgArray = [
        ...cubeTypes,
        ...new Array(5).fill('_SENTINEL_CUBE_TYPE_XX')
    ]

    return {
        $ct1: ctArgArray[0],
        $ct2: ctArgArray[1],
        $ct3: ctArgArray[2],
        $ct4: ctArgArray[3],
        $ct5: ctArgArray[4]
    }
}

function dekStringFromRows(rows) {
    return `<?xml version="1.0" encoding="utf-8"?>\r
<Deck xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\r
<NetDeckID>0</NetDeckID>\r
<PreconstructedDeckID>0</PreconstructedDeckID>\r
  ${rows.join('\r\n  ')}\r
</Deck>\r
`
}

const resolvers = {
    Query: {
        player(_, { id }) {
            return executeSelectOne(sql.selectPlayer, { $playerId: id })
        },
        players(
            _,
            { howMany = MAX_RESULTS, after = "", by = "fullName" }
        ) {
            const resolverQueries = {
                id: sql.selectPlayersOrderByIdAsc,
                fullName: sql.selectPlayersOrderByNameAsc
            }
            return executeSelectSome(resolverQueries[by], {
                $after: after,
                $howMany: howMany,
            })
        },
        playerSearch(_, { byName = '_FULLNAME_SENTINEL_XX', byHandle = '_HANDLE_SENTINEL_XX' }) {
            return executeSelectSome(sql.selectPlayersByNameOrHandleSearch, { $byName: byName, $byHandle: byHandle })
        },
        event(_, { id }) {
            return executeSelectOne(sql.selectEvent, { $eventId: id })
        },
        events(
            _,
            { after, howMany = MAX_RESULTS, asc = false }
        ) {
            const query = asc ? sql.selectEventsAsc : sql.selectEventsDesc

            after = getDateAfter(after, asc)

            return executeSelectSome(query, { $howMany: howMany, $after: after })
        },
        entry(_, { playerId, eventId }) {
            return executeSelectOne(sql.selectEntry, {
                $playerId: playerId,
                $eventId: eventId,
            })
        },
        standings(_, { season, howMany = MAX_RESULTS, after = 0 }) {
            const [query, args] = season === undefined ?
                [sql.selectStandingsAllTime, { $howMany: howMany, $after: after }]
                :
                [sql.selectStandingsBySeason, { $season: season, $howMany: howMany, $after: after }]
            return executeSelectSome(query, args)
        },
        card(_, { name }) {
            return { name }
        },
        cubeByType(_, { cubeType }) {
            return executeSelectOne(sql.selectCubesByType, { $cubeType: cubeType })
        },
        async dekString(_, { mainCardNames=[], sideboardCardNames=[], wishlistOnly=false }) {
            const mainCards = await Promise.all(mainCardNames.map(name => resolvers.Card.ownedMTGOCard({ name },  { wishlistOnly })))
            const sideboardCards = await Promise.all(sideboardCardNames.map(name => resolvers.Card.ownedMTGOCard({ name }, { wishlistOnly })))
            
            return dekStringFromRows(mainCards.map(
                card => resolvers.MTGOCard.dekRow(card, {num:1, sideboard: false})
            ).concat(sideboardCards.map(
                card => resolvers.MTGOCard.dekRow(card, {num: 1, sideboard: true})
            )))
        },
        async MTGOCards(_, {owned=true, wishlist=true}) {
            let cards = [];
        
            if (owned) {
                const newCards = await executeSelectSome(sql.selectOwnedCards);
                cards = cards.concat(newCards);
            }
            if (wishlist) {
                const newCards = await executeSelectSome(sql.selectWishlistCards);
                cards = cards.concat(newCards);
            }
            return cards;
        }
    },
    Mutation: {
        async syncData(_) {
            await syncData()
            return true
        },
        async addEvent(_, {eventId, sheetId}) {
            addEventToConfig(eventId, sheetId);
            await syncData();
            return true
        },
    },
    Player: {
        eventEntries(
            player,
            { after, howMany = MAX_RESULTS, asc = false }
        ) {
            const query = asc ? sql.selectEntriesByPlayerAsc : sql.selectEntriesByPlayerDesc

            after = getDateAfter(after, asc)

            return executeSelectSome(query, {
                $playerId: player.id,
                $howMany: howMany,
                $after: after,
            })
        },
        async pairingsVs(player, { oppId, howMany = MAX_RESULTS, after, asc = false }) {
            const query = asc ? sql.selectPairingsByPlayerPairAsc : sql.selectPairingsByPlayerPairDesc
            after = getDateAfter(after, asc)

            const rows = await executeSelectSome(query, { $playerId: player.id, $oppId: oppId, $howMany: howMany, $after: after })

            return rows.map((row) => ({
                ...row,
                asPlayerId: player.id
            }))
        },
        standing(player, { season = undefined }) {
            const [query, args] = season === undefined ?
                [sql.selectStandingForPlayerAllTime, { $playerId: player.id, $howMany: MAX_RESULTS, $after: 0 }]
                :
                [sq.selectStandingForPlayerBySeason, { $playerId: player.id, $season: season, $howMany: MAX_RESULTS, $after: 0 }]
            return executeSelectOne(query, args)
        },
        async openPairings(player) {
            const pairings = await executeSelectSome(sql.selectOpenPairingsByPlayer, { $playerId: player.id, $nowTime: new Date().toISOString() })
            return pairings.map(pairing => ({
                ...pairing,
                asPlayerId: player.id
            }))
        },
        openEntries(player) {
            return executeSelectSome(sql.selectOpenEntriesByPlayer, { $playerId: player.id })
        }
    },
    OCLEvent: {
        playerEntries(event, { byFinish = false }) {
            if (byFinish) {
                return executeSelectSome(sql.selectEntriesByEventByPosition, { $eventId: event.id })
            }
            return executeSelectSome(sql.selectEntriesByEvent, { $eventId: event.id })
        },
        pairings(event, { roundNum }) {
            const [query, args] = roundNum === undefined ?
                [sql.selectPairingsByEvent, { $eventId: event.id }]
                :
                [sql.selectPairingsByEventAndRound, { $eventId: event.id, $roundNum: roundNum }]

            return executeSelectSome(query, args)
        },
        cube(event) {
            return executeSelectOne(sql.selectCube, { $cubeId: event.cubeId })
        },
        winningEntry(event) {
            return executeSelectOne(sql.selectEventWinner, { $eventId: event.id })
        },
        async standingsJpgURL(event) {
            const jpgURL = await executeSelectOne(`SELECT standingsJpgURL FROM eventExtra WHERE id = $eventId`, {$eventId: event.id}, 'standingsJpgURL')
            if (jpgURL != null) {
                return jpgURL
            }
            
            const today = new Date().toISOString()

            const htciConfig = getFreshDbConfig().htciapi
            const latestEventId = await executeSelectOne(`SELECT id FROM event WHERE completedDate < $today ORDER BY completedDate DESC`, {$today: today}, 'id')

            if (latestEventId !== event.id || htciConfig == undefined) {
                return null
            }
        
            const standings = await executeSelectSome(sql.selectStandingsWithDiscordHandle, {$howMany: MAX_RESULTS, $season: event.season, $howMany: MAX_RESULTS, $after: 0})
            
            const css = `table {
background-color: rgb(50, 53, 59);
color: gray;
}

th, td {
    padding: 0px 10px;
    text-align: left;   
}

tr:nth-child(1) {
color: lightgray;
}

tr:nth-child(2) {
color: #ff50d9;
}

tr:nth-child(3),
tr:nth-child(4),
tr:nth-child(5),
tr:nth-child(6),
tr:nth-child(7),
tr:nth-child(8),
tr:nth-child(9)
{
color: rgb(215,193,171);
}

tr:nth-child(even) {
background-color: rgb(64,68,75);
}`
            const rowsHtml = standings.reduce((html, row) => html.concat(`<tr>
        <td>${row.rank}</td>
        <td>${row.discordHandle}</td>
        <td>${row.qps}</td>
        <td>${row.matchWins}</td>
        <td>${row.matchLosses}</td>
        <td>${row.allTimeRank}</td>
    </tr>
`), '')

            const html = `
<table>
    <tr>
        <th></th>
        <th>Player</th>
        <th>QPs</th>
        <th>Wins</th>
        <th>Losses</th>
        <th>All-Time Rank</th>
    </tr>
    ${rowsHtml}
</table>
`           
            const token = Buffer.from(`${htciConfig.user}:${htciConfig.key}`, 'utf8').toString('base64')
            const {data} = await axios.post(
                'https://hcti.io/v1/image', 
                {
                    html,
                    css,
                    google_fonts: "Roboto"
                },
                {
                    headers: {
                        'Authorization': `Basic ${token}`
                    }    
                }
            )

            if (data?.url !== undefined) {
                await executeRun(`UPDATE eventExtra SET standingsJpgURL = $standingsJpgURL WHERE id = $eventId`, {$eventId: event.id, $standingsJpgURL: data.url})

                return data.url
            }
            return null
        }
    },
    Entry: {
        player(entry) {
            return executeSelectOne(sql.selectPlayer, { $playerId: entry.playerId })
        },
        event(entry) {
            return executeSelectOne(sql.selectEvent, { $eventId: entry.eventId })
        },
        async pairings(entry) {
            const pairings = await executeSelectSome(sql.selectPairingsByEntry, { $eventId: entry.eventId, $playerId: entry.playerId })

            return pairings.map((row) => ({
                ...row,
                asPlayerId: entry.playerId
            }))
        },
        async matchWins(entry) {
            const winsRow = await executeSelectOne(sql.selectEntryWins, { $eventId: entry.eventId, $playerId: entry.playerId })
            return winsRow?.wins
        },
        async matchLosses(entry) {
            const lossesRow = await executeSelectOne(sql.selectEntryLosses, { $eventId: entry.eventId, $playerId: entry.playerId })
            return lossesRow?.losses
        },
        pool(entry) {
            return executeSelectSome(sql.selectPicksForEntry, { $eventId: entry.eventId, $playerId: entry.playerId })
        },
        main(entry) {
            return entry.pool.filter(row => row.isMain || row.isMain === null)
        },
        sideboard(entry) {
            return entry.pool.filter(row => row.isMain === 0)
        },
        async ownedDekString(entry) {
            const mainMTGOCards = await Promise.all(resolvers.Entry.main(entry).map(pick => resolvers.Card.ownedMTGOCard(resolvers.Pick.card(pick))))
            const sbMTGOCards = await Promise.all(resolvers.Entry.sideboard(entry).map(pick => resolvers.Card.ownedMTGOCard(resolvers.Pick.card(pick))))

            const mainRows = mainMTGOCards.map(
                card => resolvers.MTGOCard.dekRow(card, { num: 1, sideboard: false })
            )
            const sbRows = sbMTGOCards.map(
                card => resolvers.MTGOCard.dekRow(card, { num: 1, sideboard: true })
            )
            const dekRows = mainRows.concat(sbRows)
            return dekStringFromRows(dekRows)
        },
        async draftlogURL(entry) {
            const extraRow = await executeSelectOne(
                `SELECT draftlogURL, draftlogSource FROM entryExtra WHERE playerId = $playerId AND eventId = $eventId`,
                {$playerId: entry.playerId, $eventId: entry.eventId}
            )
            if (extraRow == null) {
                return null
            }
            if (extraRow.draftlogURL != null || extraRow.draftlogSource == null) {
                return extraRow.draftlogURL
            } else {
                return new Promise((resolve, reject) => {
                    console.log(extraRow.draftlogSource)
                    const form = new FormData()
                    form.append('draft', fs.createReadStream(`data/events/${entry.eventId}/${extraRow.draftlogSource}`))
                    form.submit('https://magicprotools.com/draft/upload', (err, res) => {
                        if (err) {
                            reject(err)
                        }
                        const logURL = `https://magicprotools.com${res.headers.location}`
                        resolve(logURL)
                    })
                }).then(async logURL => {
                    await executeRun(
                        'UPDATE entryExtra SET draftlogURL = $draftlogURL WHERE eventId = $eventId AND playerId = $playerId', 
                        { $eventId: entry.eventId, $playerId: entry.playerId, $draftlogURL: logURL})
                    return logURL
                })
            }
        }
    },
    Pairing: {
        p1Entry(pairing) {
            return executeSelectOne(sql.selectEntry, { $playerId: pairing.p1Id, $eventId: pairing.eventId })
        },
        p2Entry(pairing) {
            return executeSelectOne(sql.selectEntry, { $playerId: pairing.p2Id, $eventId: pairing.eventId })
        },
        opponentId(pairing) {
            return pairing.asPlayerId === undefined ? undefined : pairing.asPlayerId === pairing.p1Id ? pairing.p2Id : pairing.p1Id
        },
        asPlayerGameWins(pairing) {
            return pairing.asPlayerId === undefined ? undefined : pairing.asPlayerId === pairing.p1Id ? pairing.p1GameWins : pairing.p2GameWins
        },
        asPlayerMatchWin(pairing) {
            return pairing.asPlayerId === undefined ? undefined :
                pairing.asPlayerId == pairing.p1Id ? pairing.p1MatchWin : pairing.p2MatchWin
        },
        opponentMatchWin(pairing) {
            return pairing.asPlayerId === undefined ? undefined :
                pairing.asPlayerId == pairing.p1Id ? pairing.p2MatchWin : pairing.p1MatchWin
        },
        opponentGameWins(pairing) {
            return pairing.asPlayerId === undefined ? undefined : pairing.asPlayerId === pairing.p1Id ? pairing.p2GameWins : pairing.p1GameWins
        },
        asPlayerEntry(pairing) {
            return pairing.asPlayerId === undefined ? undefined :
                executeSelectOne(sql.selectEntry, { $playerId: pairing.asPlayerId, $eventId: pairing.eventId })
        },
        opponentEntry(pairing, args) {
            return pairing.asPlayerId === undefined ? undefined :
                executeSelectOne(sql.selectEntry, { $playerId: resolvers.Pairing.opponentId(pairing, args), $eventId: pairing.eventId })
        },
        winnerId(pairing) {
            return pairing.p1MatchWin === undefined ? undefined : pairing.p1MatchWin ? pairing.p1Id : pairing.p2Id
        },
        loserId(pairing) {
            return pairing.p1MatchWin === undefined ? undefined : pairing.p1MatchWin ? pairing.p2Id : pairing.p1Id
        },
        winnerEntry(pairing, args) {
            return executeSelectOne(sql.selectEntry, { $playerId: resolvers.Pairing.winnerId(pairing, args), $eventId: pairing.eventId })
        },
        loserEntry(pairing, args) {
            return executeSelectOne(sql.selectEntry, { $playerId: resolvers.Pairing.loserId(pairing, args), $eventId: pairing.eventId })
        },
    },
    Standing: {
        player(standing) {
            return executeSelectOne(sql.selectPlayer, { $playerId: standing.playerId })
        }
    },
    Pick: {
        otherCardNames(pick) {
            return pick.otherCardNamesString?.split('\n') || []
        },
        poolAsOfNames(pick) {
            if (pick.pickNum === undefined || pick.packNum === undefined) {
                return undefined
            }
            return executeSelectSome(`SELECT cardName FROM pick WHERE playerId = $playerId AND eventId = $eventId AND (packNum < $packNum OR (packNum = $packNum AND pickNum < $pickNum))`,
                {
                    $playerId: pick.playerId,
                    $eventId: pick.eventId,
                    $packNum: pick.packNum,
                    $pickNum: pick.pickNum
                },
                'cardName'
            )
        },
        card(pick) {
            return {
                name: pick.cardName
            }
        },
        poolAsOf(pick) {
            return resolvers.Pick.poolAsOfNames(pick).map(name => ({
                name
            }))
        },
        otherCards(pick) {
            return resolvers.Pick.otherCardNames(pick).map(name => ({
                name
            }))
        }
    },
    Card: {
        avgPickOrder(card, { cubeTypes = ALL_CUBE_TYPES }) {
            const args = {
                ...cubeTypeArgs(cubeTypes),
                $cardName: card.name
            }

            return executeSelectOne(sql.selectPickOrderByCard, args, 'avgPickOrder')
        },
        mainDeckPct(card, { cubeTypes = ALL_CUBE_TYPES }) {
            const args = {
                ...cubeTypeArgs(cubeTypes),
                $cardName: card.name
            }
            return executeSelectOne(sql.selectIsMainPctByCard, args, 'isMainPct')
        },
        recentEntries(card, { howMany = MAX_RESULTS }) {
            return executeSelectSome(sql.selectEntriesByCardName, {
                $cardName: card.name, $howMany: howMany
            })
        },
        wheelPct(card, { cubeTypes = ALL_CUBE_TYPES }) {
            const args = {
                ...cubeTypeArgs(cubeTypes),
                $cardName: card.name
            }

            return executeSelectOne(sql.selectWheelPctByCard, args, 'wheelPct')
        },
        inEventPoolCount(card, { cubeTypes = ALL_CUBE_TYPES }) {
            const args = {
                ...cubeTypeArgs(cubeTypes),
                $cardName: card.name
            }

            return executeSelectOne(sql.selectInPoolCountByCard, args, 'inPoolCount')
        },
        matchWinsInPool(card, { cubeTypes = ALL_CUBE_TYPES }) {
            const args = {
                ...cubeTypeArgs(cubeTypes),
                $cardName: card.name
            }

            return executeSelectOne(sql.selectMatchWinsByCard, args, 'wins')
        },
        matchLossesInPool(card, { cubeTypes = ALL_CUBE_TYPES }) {
            const args = {
                ...cubeTypeArgs(cubeTypes),
                $cardName: card.name
            }

            return executeSelectOne(sql.selectMatchLossesByCard, args, 'losses')
        },
        async bayesianWinRate(card, { cubeTypes = ALL_CUBE_TYPES, vol = 0.03 }) {
            const wins = await resolvers.Card.matchWinsInPool(card, { cubeTypes })
            const losses = await resolvers.Card.matchLossesInPool(card, { cubeTypes })
            const priorMatches = Math.pow(vol, -2) / 4 - 1

            return (wins + priorMatches / 2) / (wins + losses + priorMatches)
        },
        cubesIn(card, { asOf = new Date().toISOString() }) {
            return executeSelectSome(sql.selectCubesForCard, { $cardName: card.name, $asOf: asOf })
        },
        async ownedMTGOCard(card, {wishlistOnly=false}) {
            let ownedCard
            if (!wishlistOnly) {
                const ownedCard = await executeSelectOne(sql.selectOwnedMTGOCardByName, { $cardName: card.name })
            }
            if (ownedCard === undefined) {
                return executeSelectOne(sql.selectWishlistCardByName, { $cardName: card.name })
            }
            return ownedCard
        }
    },
    MTGOCard: {
        dekRow(mtgoCard, { num = 1, sideboard = false }) {
            return `<Cards CatID="${mtgoCard.id}" Quantity="${num}" Sideboard="${sideboard ? 'true' : 'false'}" Name="${mtgoCard.mtgoName}" />`
        },
        card(mtgoCard) {
            return {
                name: mtgoCard.name
            }
        }
    },
    Cube: {
        cardNames(cube) {
            return cube.listString.trim().split('\n').map(w => w.trim())
        },
        cards(cube) {
            return resolvers.Cube.cardNames(cube).map(name => ({ name }))
        },
        recentEvents(cube, { howMany = MAX_RESULTS }) {
            return executeSelectSome(sql.selectEventByCube, { $cubeId: cube.id, $howMany: howMany })
        },
        allCubesOfType(cube) {
            return executeSelectSome(sql.selectCubesByType, { $cubeType: cube.cubeType })
        },
        ownedMTGOCards(cube) {
            return Promise.all(resolvers.Cube.cards(cube).map(card => resolvers.Card.ownedMTGOCard(card)))
        },
        async ownedDekString(cube) {
            const ownedCards = await resolvers.Cube.ownedMTGOCards(cube)
            return dekStringFromRows(ownedCards.map(mtgoCard => resolvers.MTGOCard.dekRow(mtgoCard, {})))
        }
    }
}

let typeDefs
try {
    typeDefs = readFileSync("./src/schema.graphql", "utf-8")
} catch (_) {
    // sorry
    typeDefs = readFileSync("./node_modules/ocl-data/src/schema.graphql", "utf-8")
}  

const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
})

const oclData = graphqlHTTP({
    schema,
    graphiql: true,
})

export { oclData }
