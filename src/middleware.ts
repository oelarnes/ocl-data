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
      { howMany = MAX_RESULTS, after="", by = "fullName"}: any
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
  },
  OCLEvent: {
    playerEntries(parent: any, {}: any) {
      return executeSelectSome(selectEntriesByEvent, { $eventId: parent.id });
    },
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
    opponentId(parent: any, args: any) {
      return parent.asPlayerId === undefined
        ? undefined
        : parent.asPlayerId === parent.p1Id
        ? parent.p2Id
        : parent.p1Id;
    },
    asPlayerGameWins(parent: any, args: any) {
      return parent.asPlayerId === undefined
        ? undefined
        : parent.asPlayerId === parent.p1Id
        ? parent.p1GameWins
        : parent.p2GameWins;
    },
    opponentGameWins(parent: any, args: any) {
      return parent.asPlayerId === undefined
        ? undefined
        : parent.asPlayerId === parent.p1Id
        ? parent.p2GameWins
        : parent.p1GameWins;
    },
  },
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
