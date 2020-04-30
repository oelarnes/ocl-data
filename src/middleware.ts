import { readFileSync } from 'fs';

import graphqlHTTP from 'express-graphql';
import { buildSchema, GraphQLObjectType, GraphQLString, GraphQLSchema, GraphQLInt, GraphQLBoolean, GraphQLList } from 'graphql';
import {select_one_by_id, select_entry, select_entries_by, select_some_of_after, get_qps} from './db';

// Initialize a GraphQL schema
const altSchema = buildSchema(readFileSync('./src/schema.graphql', 'utf-8'));

const resolvers = {
    RootQuery: {
        player(_parent: any, {id}: any) {
            return select_one_by_id('player', id)
        },
        players(_parent: any, {howMany, after, by='fullName', asc=true, season}: any): any {
            const validBy = ['fullName', 'id'];
            const orderBy = validBy.includes(by) ? by : undefined;
            return select_some_of_after('player', after, howMany, orderBy, asc ? 'ASC' : 'DESC');
        },
        event(_parent: any, {id}: any) {
            return select_one_by_id('event', id)
        },
        events(_parent: any, {after, howMany, asc=true}: any): any {
            const sortDir = asc ? 'ASC' : 'DESC';
            return select_some_of_after('event', after, howMany, 'draftDate', sortDir)
        },
        entry(_parent: any, {playerId, eventId}: any) {
            return select_entry(playerId, eventId);
        }
    },
    Player: {
        eventEntries(parent: any, {after, howMany, asc=true}: any) {
            const orderDirection = asc ? 'ASC' : 'DESC';
            return select_entries_by('player', parent.id, howMany, after, orderDirection)
        },
        qps(parent: any, {season}: any) {
            if (parent.qps !== undefined && parent.season !== undefined) {
                return parent.qps;
            }
            return get_qps(parent.id, season)
        }
    },
    OCLEvent: {
        playerEntries(parent: any, {}: any) {
            return select_entries_by('event', parent.id, undefined, undefined, undefined)
        }
    },
    Entry: {
        player(parent: any, args: any) {
            return select_one_by_id('player', parent.playerId)
        },
        event(parent: any, args: any) {
            return select_one_by_id('event', parent.eventId)
        }
    },
    Pairing: {
        opponentId(parent: any, args: any) {
            return parent.asPlayerId === undefined ? undefined : (
                parent.asPlayerId === parent.p1Id ? parent.p2Id : parent.p1Id
            );
        },
        asPlayerGameWins(parent: any, args: any) {
            return parent.asPlayerId === undefined ? undefined : (
                parent.asPlayerId === parent.p1Id ? parent.p1GameWins : parent.p2GameWins
            );
        },
        opponentGameWins(parent: any, args: any) {
            return parent.asPlayerId === undefined ? undefined : (
                parent.asPlayerId === parent.p1Id ? parent.p2GameWins : parent.p1GameWins
            );
        }
    }
}

const Player = new GraphQLObjectType({
    name: 'Player',
    fields: () => ({
        id: {type: GraphQLString},
        fullName: {type: GraphQLString},
        discordHandle: {type: GraphQLString},
        discordIdExt: {type: GraphQLString},
        timeZone: {type: GraphQLString},
        email: {type: GraphQLString},
        eventEntries: {
            type: new GraphQLList(Entry),
            args: {
                howMany: {type: GraphQLInt},
                after: {type: GraphQLString},
                asc: {type: GraphQLBoolean}
            },
            resolve: resolvers.Player.eventEntries
        },
        qps: {
            type: GraphQLInt,
            args: {
                season: {type: GraphQLString}
            },
            resolve: resolvers.Player.qps
        }
    })
}) as any;

const OCLEvent = new GraphQLObjectType({
    name: 'Event',
    fields: () => ({
        id: {type: GraphQLString},
        prizeType: {type: GraphQLString},
        cubeId: {type: GraphQLString},
        season: {type: GraphQLString},
        completeDate: {type: GraphQLString},
        draftDate: {type: GraphQLString},
        playerEntries: {
            type: new GraphQLList(Entry),
            resolve: resolvers.OCLEvent.playerEntries
        }
    })
}) as any;

const Entry = new GraphQLObjectType({
    name: 'Entry',
    fields: () => ({
        playerId: {type: GraphQLString},
        eventId: {type: GraphQLString},
        player: {
            type: Player,
            resolve: resolvers.Entry.player  
        },
        event: {
            type: OCLEvent,
            resolve: resolvers.Entry.event
        },
        seatNum: {type: GraphQLInt},
        finalPosition: {type: GraphQLInt},
        qpsAwarded: {type: GraphQLInt},
        cpsAwarded: {type: GraphQLInt},
        account: {type: GraphQLString},
        accountPw: {type: GraphQLString},
        isOpen: {type: GraphQLBoolean}
    })
}) as any;


const RootQuery = new GraphQLObjectType({
    name: 'RootQueryType',
    fields: {
        player: {
            type: Player,
            args: {id: {type: GraphQLString}},
            resolve: resolvers.RootQuery.player
        },
        event: {
            type: OCLEvent,
            args: {id: {type: GraphQLString}},
            resolve: resolvers.RootQuery.event
        },
        entry: {
            type: Entry,
            args: {playerId: {type: GraphQLString}, eventId: {type: GraphQLString}},
            resolve: resolvers.RootQuery.entry
        },
        players: {
            type: new GraphQLList(Player),
            args: {after: {type: GraphQLString}, howMany: {type: GraphQLInt}, by: {type: GraphQLString}, asc: {type: GraphQLBoolean}},
            resolve: resolvers.RootQuery.players
        },
        events: {
            type: new GraphQLList(OCLEvent),
            args: {after: {type: GraphQLString}, howMany: {type: GraphQLInt}, asc: {type: GraphQLBoolean}},
            resolve: resolvers.RootQuery.events
        }
    }
});

const schema = new GraphQLSchema({
    query: RootQuery
});

const middleware = graphqlHTTP({
    schema,
    graphiql: true
})

export { middleware };