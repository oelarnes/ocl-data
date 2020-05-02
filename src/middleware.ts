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
    selectStandingsBySeason
} from "./sqlTemplates";

import { makeExecutableSchema } from "graphql-tools";

const MAX_RESULTS = 10000;
const MAX_DATE = "9999-12-31";
const MIN_DATE = "0000-00-00";

// Initialize a GraphQL schema
const typeDefs = readFileSync("./src/schema.graphql", "utf-8");

function getDateAfter(after: any, asc: boolean) {
    return after || (asc && MIN_DATE) || (!asc && MAX_DATE);
}

const resolvers = {
    Query: {
        player(_parent: any, { id }: any) {
            return executeSelectOne(selectPlayer, { $playerId: id });
        },
        players(
            _parent: any,
            { howMany = MAX_RESULTS, after = "", by = "fullName" }: any
        ): any {
            const resolverQueries = {
                id: selectPlayersOrderByIdAsc,
                fullName: selectPlayersOrderByNameAsc
            } as any;
            return executeSelectSome(resolverQueries[by], {
                $after: after,
                $howMany: howMany,
            });
        },
        event(_parent: any, { id }: any) {
            return executeSelectOne(selectEvent, { $eventId: id });
        },
        events(
            _parent: any,
            { after, howMany = MAX_RESULTS, asc = true }: any
        ): any {
            const query = asc ? selectEventsAsc : selectEventsDesc;

            after = getDateAfter(after, asc);

            return executeSelectSome(query, { $howMany: howMany, $after: after });
        },
        entry(_parent: any, { playerId, eventId }: any) {
            return executeSelectOne(selectEntry, {
                $playerId: playerId,
                $eventId: eventId,
            });
        },
        standings(_parent: any, { season, howMany=MAX_RESULTS, after=0 }: any) {
            const [query, args] = season === undefined ?
                [selectStandingsAllTime, { $howMany: howMany, $after: after }]
                :
                [selectStandingsBySeason, { $season: season, $howMany: howMany, $after: after }];
            return executeSelectSome(query, args);
        }
    },
    Player: {
        eventEntries(
            parent: any,
            { after, howMany = MAX_RESULTS, asc = true }: any
        ) {
            const query = asc ? selectEntriesByPlayerAsc : selectEntriesByPlayerDesc;

            after = getDateAfter(after, asc);

            return executeSelectSome(query, {
                $playerId: parent.id,
                $howMany: howMany,
                $after: after,
            });
        },
        pairingsVs(parent: any, { oppId, howMany = MAX_RESULTS, after, asc = false }: any) {
            const query = asc ? selectPairingsByPlayerPairAsc : selectPairingsByPlayerPairDesc
            after = getDateAfter(after, asc)

            return executeSelectSome(query, { $playerId: parent.id, $oppId: oppId, $howMany: howMany, $after: after }).then((rows) => {
                return rows.map((row: any) => ({
                    ...row,
                    asPlayerId: parent.id
                }))
            })
        }
    },
    OCLEvent: {
        playerEntries(parent: any, { }: any) {
            return executeSelectSome(selectEntriesByEvent, { $eventId: parent.id });
        },
        pairings(parent: any, { roundNum }: any) {
            const [query, args]: any = roundNum === undefined ?
                [selectPairingsByEvent, { $eventId: parent.id }]
                :
                [selectPairingsByEventAndRound, { $eventId: parent.id, $roundNum: roundNum }];

            return executeSelectSome(query, args);
        }
    },
    Entry: {
        player(parent: any, args: any) {
            return executeSelectOne(selectPlayer, { $playerId: parent.playerId });
        },
        event(parent: any, args: any) {
            return executeSelectOne(selectEvent, { $eventId: parent.eventId });
        },
    },
    Pairing: {
        p1Entry(parent: any, args: {}) {
            return executeSelectOne(selectEntry, { $playerId: parent.p1Id, $eventId: parent.eventId })
        },
        p2Entry(parent: any, args: {}) {
            return executeSelectOne(selectEntry, { $playerId: parent.p2Id, $eventId: parent.eventId })
        },
        opponentId(parent: any, args: any) {
            return parent.asPlayerId === undefined ? undefined : parent.asPlayerId === parent.p1Id ? parent.p2Id : parent.p1Id;
        },
        asPlayerGameWins(parent: any, args: any) {
            return parent.asPlayerId === undefined ? undefined : parent.asPlayerId === parent.p1Id ? parent.p1GameWins : parent.p2GameWins;
        },
        asPlayerMatchWin(parent: any, args: any) {
            return parent.asPlayerId === undefined ? undefined :
                parent.asPlayerId == parent.p1Id ? parent.p1MatchWin : parent.p2MatchWin
        },
        opponentMatchWin(parent: any, args: any) {
            return parent.asPlayerId === undefined ? undefined :
                parent.asPlayerId == parent.p1Id ? parent.p2MatchWin : parent.p1MatchWin;
        },
        opponentGameWins(parent: any, args: any) {
            return parent.asPlayerId === undefined ? undefined : parent.asPlayerId === parent.p1Id ? parent.p2GameWins : parent.p1GameWins;
        },
        asPlayerEntry(parent: any, args: any) {
            return parent.asPlayerId === undefined ? undefined :
                executeSelectOne(selectEntry, { $playerId: parent.asPlayerId, $eventId: parent.eventId });
        },
        opponentEntry(parent: any, args: any) {
            return parent.asPlayerId === undefined ? undefined :
                executeSelectOne(selectEntry, { $playerId: resolvers.Pairing.opponentId(parent, args), $eventId: parent.eventId });
        },
        async winnerId(parent: any, args: any) {
            return parent.p1MatchWin === undefined ? undefined : parent.p1MatchWin ? parent.p1Id : parent.p2Id;
        },
        async loserId(parent: any, args: any) {
            return parent.p1MatchWin === undefined ? undefined : parent.p1MatchWin ? parent.p2Id : parent.p1Id;
        },
        async winnerEntry(parent: any, args: any) {
            const winnerId = await resolvers.Pairing.winnerId(parent, args);
            return executeSelectOne(selectEntry, { $playerId: winnerId, $eventId: parent.eventId });
        },
        async loserEntry(parent: any, args: any) {
            const loserId = await resolvers.Pairing.loserId(parent, args);
            return executeSelectOne(selectEntry, { $playerId: loserId, $eventId: parent.eventId });
        },
    },
    Standing: {
        player(parent: any, args: any) {
            return executeSelectOne(selectPlayer, {$playerId: parent.playerId})
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
