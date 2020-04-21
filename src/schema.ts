import { GraphQLObjectType, GraphQLString, GraphQLSchema, GraphQLInt, GraphQLBoolean, GraphQLList } from 'graphql';
import {select_one_by_id, select_entry, select_entries_by, select_some_of_after, get_qps} from './db';

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
            resolve(parent: any, {after, howMany, asc=true}: any) {
                const orderDirection = asc ? 'ASC' : 'DESC';
                return select_entries_by('player', parent.id, howMany, after, orderDirection)
            }
        },
        qps: {
            type: GraphQLInt,
            args: {
                season: {type: GraphQLString}
            },
            resolve(parent: any, {season}: any) {
                return get_qps(parent.id, season)
            }
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
            resolve(parent: any, {}: any) {
                return select_entries_by('event', parent.id, undefined, undefined, undefined)
            }
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
            resolve(parent: any, args: any) {
                return select_one_by_id('player', parent.playerId)
            }         
        },
        event: {
            type: OCLEvent,
            resolve(parent: any, args: any) {
                return select_one_by_id('event', parent.eventId)
            }
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

const Pairing = new GraphQLObjectType({
    name: 'Pairing',
    fields: () => ({
        eventId: {type: GraphQLString},
        roundNum: {type: GraphQLInt},
        tableNum: {type: GraphQLInt},
        p1Id: {type: GraphQLString},
        p1: {
            type: Player,
            resolve(parent: any, args: any) {
                return select_one_by_id('player', parent.p1Id)
            }
        },
        p2Id: {type: GraphQLString},
        p2: {
            type: Player,
            resolve(parent: any, args: any) {
                return select_one_by_id('player', parent.p2Id)
            }
        },
        asPlayerId: {type: GraphQLString},
        asPlayer: {
            type: Player,
            resolve(parent: any, args: any) {
                return select_one_by_id('player', parent.asPlayerId)
            }
        },
        opponentId: {
            type: GraphQLString,
            resolve(parent: any, args: any) {
                return parent.asPlayerId === undefined ? undefined : (
                    parent.asPlayerId === parent.p1Id ? parent.p2Id : parent.p1Id
                );
            }
        },
        opponent: {
            type: Player,
            resolve(parent: any, args: any) {
                return select_one_by_id('player', parent.opponentId)
            }
        },
        p1GameWins: {type: GraphQLInt},
        p2GameWins: {type: GraphQLInt},
        asPlayerGameWins: {
            type: GraphQLInt,
            resolve(parent: any, args: any) {
                return parent.asPlayerId === undefined ? undefined : (
                    parent.asPlayerId === parent.p1Id ? parent.p1GameWins : parent.p2GameWins
                );
            }
        },
        opponentGameWins: {
            type: GraphQLInt,
            resolve(parent: any, args: any) {
                return parent.asPlayerId === undefined ? undefined : (
                    parent.asPlayerId === parent.p1Id ? parent.p2GameWins : parent.p1GameWins
                );
            }
        },
    })
})

const RootQuery = new GraphQLObjectType({
    name: 'RootQueryType',
    fields: {
        player: {
            type: Player,
            args: {id: {type: GraphQLString}},
            resolve(_parent: any, {id}: any) {
                return select_one_by_id('player', id)
            }
        },
        event: {
            type: OCLEvent,
            args: {id: {type: GraphQLString}},
            resolve(_parent: any, {id}: any) {
                return select_one_by_id('event', id)
            }
        },
        entry: {
            type: Entry,
            args: {playerId: {type: GraphQLString}, eventId: {type: GraphQLString}},
            resolve(_parent: any, {playerId, eventId}: any) {
                return select_entry(playerId, eventId);
            }
        },
        players: {
            type: new GraphQLList(Player),
            args: {after: {type: GraphQLString}, howMany: {type: GraphQLInt}, by: {type: GraphQLString}, asc: {type: GraphQLBoolean}},
            resolve(_parent: any, {after, howMany, by='fullName', asc=true}: any): any {
                const validBy = ['fullName', 'id'];
                const orderBy = validBy.includes(by) ? by : undefined;
                return select_some_of_after('player', after, howMany, orderBy, asc ? 'ASC' : 'DESC');
            }
        },
        events: {
            type: new GraphQLList(OCLEvent),
            args: {after: {type: GraphQLString}, howMany: {type: GraphQLInt}, asc: {type: GraphQLBoolean}},
            resolve(_parent: any, {after, howMany, asc=true}: any): any {
                const sortDir = asc ? 'ASC' : 'DESC';
                return select_some_of_after('event', after, howMany, 'draftDate', sortDir)
            }
        }
    }
})

const schema = new GraphQLSchema({
    query: RootQuery
});

export {schema};