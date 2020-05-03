import { readFileSync } from "fs";

import graphqlHTTP from "express-graphql";
import { executeSelectOne, executeSelectSome } from "./db";
import {
    selectPlayer,
    selectEntry,
    selectEvent,
    selectPlayersOrderByIdAsc,
    selectPlayersOrderByNameAsc,
    selectEventsDesc,
    selectEventsAsc,
    selectEntriesByPlayerAsc,
    selectEntriesByPlayerDesc,
    selectEntriesByEvent,
    selectPairingsByPlayerPairDesc,
    selectPairingsByPlayerPairAsc,
    selectPairingsByEvent,
    selectPairingsByEventAndRound,
    selectStandingsAllTime,
    selectStandingsBySeason,
    selectStandingForPlayerAllTime,
    selectStandingForPlayerBySeason
} from "./sqlTemplates";

import { makeExecutableSchema } from "graphql-tools";

const MAX_RESULTS = 10000;
const MAX_DATE = "9999-12-31";
const MIN_DATE = "0000-00-00";

// Initialize a GraphQL schema
const typeDefs = readFileSync("./src/schema.graphql", "utf-8");

function getDateAfter(after, asc) {
    return after || (asc && MIN_DATE) || (!asc && MAX_DATE);
}

const resolvers = {
    Query: {
        player(_parent, { id }) {
            return executeSelectOne(selectPlayer, { $playerId: id });
        },
        players(
            _parent,
            { howMany = MAX_RESULTS, after = "", by = "fullName" }
        ) {
            const resolverQueries = {
                id: selectPlayersOrderByIdAsc,
                fullName: selectPlayersOrderByNameAsc
            };
            return executeSelectSome(resolverQueries[by], {
                $after: after,
                $howMany: howMany,
            });
        },
        async playerSearch(_parent, { byName, byHandle }) {
            const byNameResults = await (byName === undefined) ? [] :
                executeSelectSome(selectPlayersByNameSearch, { $byName: byName }); 

            const byHandleResults = await (byHandle === undefined) ? [] :
                executeSelectSome(selectPlayerByHandleSearch, { $byHandle: byHandle });

            return [...byNameResults, ...byHandleResults];
        },
        event(_parent, { id }) {
            return executeSelectOne(selectEvent, { $eventId: id });
        },
        events(
            _parent,
            { after, howMany = MAX_RESULTS, asc = true }
        ) {
            const query = asc ? selectEventsAsc : selectEventsDesc;

            after = getDateAfter(after, asc);

            return executeSelectSome(query, { $howMany: howMany, $after: after });
        },
        entry(_parent, { playerId, eventId }) {
            return executeSelectOne(selectEntry, {
                $playerId: playerId,
                $eventId: eventId,
            });
        },
        standings(_parent, { season, howMany = MAX_RESULTS, after = 0 }) {
            const [query, args] = season === undefined ?
                [selectStandingsAllTime, { $howMany: howMany, $after: after }]
                :
                [selectStandingsBySeason, { $season: season, $howMany: howMany, $after: after }];
            return executeSelectSome(query, args);
        }
    },
    Player: {
        eventEntries(
            parent,
            { after, howMany = MAX_RESULTS, asc = true }
        ) {
            const query = asc ? selectEntriesByPlayerAsc : selectEntriesByPlayerDesc;

            after = getDateAfter(after, asc);

            return executeSelectSome(query, {
                $playerId: parent.id,
                $howMany: howMany,
                $after: after,
            });
        },
        pairingsVs(parent, { oppId, howMany = MAX_RESULTS, after, asc = false }) {
            const query = asc ? selectPairingsByPlayerPairAsc : selectPairingsByPlayerPairDesc
            after = getDateAfter(after, asc)

            return executeSelectSome(query, { $playerId: parent.id, $oppId: oppId, $howMany: howMany, $after: after }).then((rows) => {
                return rows.map((row) => ({
                    ...row,
                    asPlayerId: parent.id
                }))
            })
        },
        standing(parent, { season = undefined }) {
            const [query, args] = season === undefined ?
                [selectStandingForPlayerAllTime, { $playerId: parent.id, $howMany: MAX_RESULTS, $after: 0 }]
                :
                [selectStandingForPlayerBySeason, { $playerId: parent.id, $season: season, $howMany: MAX_RESULTS, $after: 0 }];
            return executeSelectOne(query, args)
        }
    },
    OCLEvent: {
        playerEntries(parent, { }) {
            return executeSelectSome(selectEntriesByEvent, { $eventId: parent.id });
        },
        pairings(parent, { roundNum }) {
            const [query, args] = roundNum === undefined ?
                [selectPairingsByEvent, { $eventId: parent.id }]
                :
                [selectPairingsByEventAndRound, { $eventId: parent.id, $roundNum: roundNum }];

            return executeSelectSome(query, args);
        }
    },
    Entry: {
        player(parent, args) {
            return executeSelectOne(selectPlayer, { $playerId: parent.playerId });
        },
        event(parent, args) {
            return executeSelectOne(selectEvent, { $eventId: parent.eventId });
        },
    },
    Pairing: {
        p1Entry(parent, args) {
            return executeSelectOne(selectEntry, { $playerId: parent.p1Id, $eventId: parent.eventId })
        },
        p2Entry(parent, args) {
            return executeSelectOne(selectEntry, { $playerId: parent.p2Id, $eventId: parent.eventId })
        },
        opponentId(parent, args) {
            return parent.asPlayerId === undefined ? undefined : parent.asPlayerId === parent.p1Id ? parent.p2Id : parent.p1Id;
        },
        asPlayerGameWins(parent, args) {
            return parent.asPlayerId === undefined ? undefined : parent.asPlayerId === parent.p1Id ? parent.p1GameWins : parent.p2GameWins;
        },
        asPlayerMatchWin(parent, args) {
            return parent.asPlayerId === undefined ? undefined :
                parent.asPlayerId == parent.p1Id ? parent.p1MatchWin : parent.p2MatchWin
        },
        opponentMatchWin(parent, args) {
            return parent.asPlayerId === undefined ? undefined :
                parent.asPlayerId == parent.p1Id ? parent.p2MatchWin : parent.p1MatchWin;
        },
        opponentGameWins(parent, args) {
            return parent.asPlayerId === undefined ? undefined : parent.asPlayerId === parent.p1Id ? parent.p2GameWins : parent.p1GameWins;
        },
        asPlayerEntry(parent, args) {
            return parent.asPlayerId === undefined ? undefined :
                executeSelectOne(selectEntry, { $playerId: parent.asPlayerId, $eventId: parent.eventId });
        },
        opponentEntry(parent, args) {
            return parent.asPlayerId === undefined ? undefined :
                executeSelectOne(selectEntry, { $playerId: resolvers.Pairing.opponentId(parent, args), $eventId: parent.eventId });
        },
        async winnerId(parent, args) {
            return parent.p1MatchWin === undefined ? undefined : parent.p1MatchWin ? parent.p1Id : parent.p2Id;
        },
        async loserId(parent, args) {
            return parent.p1MatchWin === undefined ? undefined : parent.p1MatchWin ? parent.p2Id : parent.p1Id;
        },
        async winnerEntry(parent, args) {
            const winnerId = await resolvers.Pairing.winnerId(parent, args);
            return executeSelectOne(selectEntry, { $playerId: winnerId, $eventId: parent.eventId });
        },
        async loserEntry(parent, args) {
            const loserId = await resolvers.Pairing.loserId(parent, args);
            return executeSelectOne(selectEntry, { $playerId: loserId, $eventId: parent.eventId });
        },
    },
    Standing: {
        player(parent, args) {
            return executeSelectOne(selectPlayer, { $playerId: parent.playerId })
        }
    }
};

const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
});

const middleware = graphqlHTTP({
    schema,
    graphiql: true,
});

export { middleware };