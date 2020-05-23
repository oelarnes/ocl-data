"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.oclData = void 0;

var _fs = require("fs");

var _expressGraphql = _interopRequireDefault(require("express-graphql"));

var _graphqlTools = require("graphql-tools");

var _db = require("./db");

var sql = _interopRequireWildcard(require("./sqlTemplates"));

var _updates = require("./updates");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const MAX_RESULTS = 10000;
const MAX_DATE = "9999-12-31";
const MIN_DATE = "0000-00-00";
const ALL_CUBE_TYPES = ['Classic', 'Interactive', 'Powered'];

function getDateAfter(after, asc) {
  return after || asc && MIN_DATE || !asc && MAX_DATE;
}

function cubeTypeArgs(cubeTypes) {
  const ctArgArray = [...cubeTypes, ...new Array(5).fill('_SENTINEL_CUBE_TYPE_XX')];
  return {
    $ct1: ctArgArray[0],
    $ct2: ctArgArray[1],
    $ct3: ctArgArray[2],
    $ct4: ctArgArray[3],
    $ct5: ctArgArray[4]
  };
}

function dekStringFromRows(rows) {
  return `<?xml version="1.0" encoding="utf-8"?>\r
<Deck xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\r
<NetDeckID>0</NetDeckID>\r
<PreconstructedDeckID>0</PreconstructedDeckID>\r
  ${rows.join('\r\n  ')}\r
</Deck>\r
`;
}

const resolvers = {
  Query: {
    player(_parent, {
      id
    }) {
      return (0, _db.executeSelectOne)(sql.selectPlayer, {
        $playerId: id
      });
    },

    players(_parent, {
      howMany = MAX_RESULTS,
      after = "",
      by = "fullName"
    }) {
      const resolverQueries = {
        id: sql.selectPlayersOrderByIdAsc,
        fullName: sql.selectPlayersOrderByNameAsc
      };
      return (0, _db.executeSelectSome)(resolverQueries[by], {
        $after: after,
        $howMany: howMany
      });
    },

    playerSearch(_, {
      byName = '_FULLNAME_SENTINEL_XX',
      byHandle = '_HANDLE_SENTINEL_XX'
    }) {
      return (0, _db.executeSelectSome)(sql.selectPlayersByNameOrHandleSearch, {
        $byName: byName,
        $byHandle: byHandle
      });
    },

    event(_, {
      id
    }) {
      return (0, _db.executeSelectOne)(sql.selectEvent, {
        $eventId: id
      });
    },

    events(_parent, {
      after,
      howMany = MAX_RESULTS,
      asc = false
    }) {
      const query = asc ? sql.selectEventsAsc : sql.selectEventsDesc;
      after = getDateAfter(after, asc);
      return (0, _db.executeSelectSome)(query, {
        $howMany: howMany,
        $after: after
      });
    },

    entry(_, {
      playerId,
      eventId
    }) {
      return (0, _db.executeSelectOne)(sql.selectEntry, {
        $playerId: playerId,
        $eventId: eventId
      });
    },

    standings(_, {
      season,
      howMany = MAX_RESULTS,
      after = 0
    }) {
      const [query, args] = season === undefined ? [sql.selectStandingsAllTime, {
        $howMany: howMany,
        $after: after
      }] : [sql.selectStandingsBySeason, {
        $season: season,
        $howMany: howMany,
        $after: after
      }];
      return (0, _db.executeSelectSome)(query, args);
    },

    card(_, {
      name
    }) {
      return {
        name
      };
    },

    cubeByType(_, {
      cubeType
    }) {
      return (0, _db.executeSelectOne)(sql.selectCubesByType, {
        $cubeType: cubeType
      });
    },

    async ownedDekString(_parent, {
      mainCardNames,
      sideboardCardNames
    }) {
      const mainCards = await Promise.all(mainCardNames.map(name => resolvers.Card.ownedMTGOCard({
        name
      })));
      const sideboardCards = await Promise.all(sideboardCardNames.map(name => resolvers.Card.ownedMTGOCard({
        name
      })));
      return dekStringFromRows(mainCards.map(card => resolvers.MTGOCard.dekRow(card)).concat(sideboardCards.map(card => resolvers.MTGOCard.dekRow(card, {
        sideboard: true
      }))));
    }

  },
  Mutation: {
    async syncData(_) {
      await (0, _updates.dataSync)();
      return true;
    }

  },
  Player: {
    eventEntries(parent, {
      after,
      howMany = MAX_RESULTS,
      asc = false
    }) {
      const query = asc ? sql.selectEntriesByPlayerAsc : sql.selectEntriesByPlayerDesc;
      after = getDateAfter(after, asc);
      return (0, _db.executeSelectSome)(query, {
        $playerId: parent.id,
        $howMany: howMany,
        $after: after
      });
    },

    async pairingsVs(parent, {
      oppId,
      howMany = MAX_RESULTS,
      after,
      asc = false
    }) {
      const query = asc ? sql.selectPairingsByPlayerPairAsc : sql.selectPairingsByPlayerPairDesc;
      after = getDateAfter(after, asc);
      const rows = await (0, _db.executeSelectSome)(query, {
        $playerId: parent.id,
        $oppId: oppId,
        $howMany: howMany,
        $after: after
      });
      return rows.map(row => ({ ...row,
        asPlayerId: parent.id
      }));
    },

    standing(parent, {
      season = undefined
    }) {
      const [query, args] = season === undefined ? [sql.selectStandingForPlayerAllTime, {
        $playerId: parent.id,
        $howMany: MAX_RESULTS,
        $after: 0
      }] : [sq.selectStandingForPlayerBySeason, {
        $playerId: parent.id,
        $season: season,
        $howMany: MAX_RESULTS,
        $after: 0
      }];
      return (0, _db.executeSelectOne)(query, args);
    },

    async openPairings(parent) {
      const pairings = await (0, _db.executeSelectSome)(sql.selectOpenPairingsByPlayer, {
        $playerId: parent.id,
        $nowTime: new Date().toISOString()
      });
      return pairings.map(pairing => ({ ...pairing,
        asPlayerId: parent.id
      }));
    },

    openEntries(parent) {
      return (0, _db.executeSelectSome)(sql.selectOpenEntriesByPlayer, {
        $playerId: parent.id
      });
    }

  },
  OCLEvent: {
    playerEntries(parent, {
      byFinish = false
    }) {
      if (byFinish) {
        return (0, _db.executeSelectSome)(sql.selectEntriesByEventByPosition, {
          $eventId: parent.id
        });
      }

      return (0, _db.executeSelectSome)(sql.selectEntriesByEvent, {
        $eventId: parent.id
      });
    },

    pairings(parent, {
      roundNum
    }) {
      const [query, args] = roundNum === undefined ? [sql.selectPairingsByEvent, {
        $eventId: parent.id
      }] : [sql.selectPairingsByEventAndRound, {
        $eventId: parent.id,
        $roundNum: roundNum
      }];
      return (0, _db.executeSelectSome)(query, args);
    },

    cube(parent) {
      return (0, _db.executeSelectOne)(sql.selectCube, {
        $cubeId: parent.cubeId
      });
    },

    winningEntry(parent) {
      return (0, _db.executeSelectOne)(sql.selectEventWinner, {
        $eventId: parent.id
      });
    }

  },
  Entry: {
    player(parent) {
      return (0, _db.executeSelectOne)(sql.selectPlayer, {
        $playerId: parent.playerId
      });
    },

    event(parent) {
      return (0, _db.executeSelectOne)(sql.selectEvent, {
        $eventId: parent.eventId
      });
    },

    async pairings(parent) {
      const pairings = await (0, _db.executeSelectSome)(sql.selectPairingsByEntry, {
        $eventId: parent.eventId,
        $playerId: parent.playerId
      });
      return pairings.map(row => ({ ...row,
        asPlayerId: parent.playerId
      }));
    },

    async matchWins(parent) {
      const winsRow = await (0, _db.executeSelectOne)(sql.selectEntryWins, {
        $eventId: parent.eventId,
        $playerId: parent.playerId
      });
      return winsRow?.wins;
    },

    async matchLosses(parent) {
      const lossesRow = await (0, _db.executeSelectOne)(sql.selectEntryLosses, {
        $eventId: parent.eventId,
        $playerId: parent.playerId
      });
      return lossesRow?.losses;
    },

    async deck(parent) {
      const pool = await (0, _db.executeSelectSome)(sql.selectPicksForEntry, {
        $eventId: parent.eventId,
        $playerId: parent.playerId
      });
      return {
        pool
      };
    }

  },
  Pairing: {
    p1Entry(parent) {
      return (0, _db.executeSelectOne)(sql.selectEntry, {
        $playerId: parent.p1Id,
        $eventId: parent.eventId
      });
    },

    p2Entry(parent) {
      return (0, _db.executeSelectOne)(sql.selectEntry, {
        $playerId: parent.p2Id,
        $eventId: parent.eventId
      });
    },

    opponentId(parent) {
      return parent.asPlayerId === undefined ? undefined : parent.asPlayerId === parent.p1Id ? parent.p2Id : parent.p1Id;
    },

    asPlayerGameWins(parent) {
      return parent.asPlayerId === undefined ? undefined : parent.asPlayerId === parent.p1Id ? parent.p1GameWins : parent.p2GameWins;
    },

    asPlayerMatchWin(parent) {
      return parent.asPlayerId === undefined ? undefined : parent.asPlayerId == parent.p1Id ? parent.p1MatchWin : parent.p2MatchWin;
    },

    opponentMatchWin(parent) {
      return parent.asPlayerId === undefined ? undefined : parent.asPlayerId == parent.p1Id ? parent.p2MatchWin : parent.p1MatchWin;
    },

    opponentGameWins(parent) {
      return parent.asPlayerId === undefined ? undefined : parent.asPlayerId === parent.p1Id ? parent.p2GameWins : parent.p1GameWins;
    },

    asPlayerEntry(parent) {
      return parent.asPlayerId === undefined ? undefined : (0, _db.executeSelectOne)(sql.selectEntry, {
        $playerId: parent.asPlayerId,
        $eventId: parent.eventId
      });
    },

    opponentEntry(parent, args) {
      return parent.asPlayerId === undefined ? undefined : (0, _db.executeSelectOne)(sql.selectEntry, {
        $playerId: resolvers.Pairing.opponentId(parent, args),
        $eventId: parent.eventId
      });
    },

    winnerId(parent) {
      return parent.p1MatchWin === undefined ? undefined : parent.p1MatchWin ? parent.p1Id : parent.p2Id;
    },

    loserId(parent) {
      return parent.p1MatchWin === undefined ? undefined : parent.p1MatchWin ? parent.p2Id : parent.p1Id;
    },

    winnerEntry(parent, args) {
      return (0, _db.executeSelectOne)(sql.selectEntry, {
        $playerId: resolvers.Pairing.winnerId(parent, args),
        $eventId: parent.eventId
      });
    },

    loserEntry(parent, args) {
      return (0, _db.executeSelectOne)(sql.selectEntry, {
        $playerId: resolvers.Pairing.loserId(parent, args),
        $eventId: parent.eventId
      });
    }

  },
  Standing: {
    player(parent) {
      return (0, _db.executeSelectOne)(sql.selectPlayer, {
        $playerId: parent.playerId
      });
    }

  },
  Pick: {
    otherCardNames(parent) {
      return parent.otherCardNamesString?.split('\n') || [];
    },

    poolAsOfNames(parent) {
      if (parent.pickNum === undefined || parent.packNum === undefined) {
        return undefined;
      }

      return (0, _db.executeSelectSome)(`SELECT cardName FROM pick WHERE playerId = $playerId AND eventId = $eventId AND (packNum < $packNum OR (packNum = $packNum AND pickNum < $pickNum))`, {
        $playerId: parent.playerId,
        $eventId: parent.eventId,
        $packNum: parent.packNum,
        $pickNum: parent.pickNum
      }, 'cardName');
    },

    card(parent) {
      return {
        name: parent.cardName
      };
    },

    poolAsOf(parent) {
      return resolvers.Pick.poolAsOfNames(parent).map(name => ({
        name
      }));
    },

    otherCards(parent) {
      return resolvers.Pick.otherCardNames(parent).map(name => ({
        name
      }));
    }

  },
  Deck: {
    main(parent) {
      return parent.pool.filter(row => row.isMain || row.isMain === null);
    },

    sideboard(parent) {
      return parent.pool.filter(row => row.isMain === 0);
    },

    async ownedDekString(parent) {
      const mainMTGOCards = await Promise.all(resolvers.Deck.main(parent).map(pick => resolvers.Card.ownedMTGOCard(resolvers.Pick.card(pick))));
      const sbMTGOCards = await Promise.all(resolvers.Deck.sideboard(parent).map(pick => resolvers.Card.ownedMTGOCard(resolvers.Pick.card(pick))));
      const mainRows = mainMTGOCards.map(card => resolvers.MTGOCard.dekRow(card, {
        sideboard: false
      }));
      const sbRows = sbMTGOCards.map(card => resolvers.MTGOCard.dekRow(card, {
        sideboard: true
      }));
      const dekRows = mainRows.concat(sbRows);
      return dekStringFromRows(dekRows);
    }

  },
  Card: {
    avgPickOrder(parent, {
      cubeTypes = ALL_CUBE_TYPES
    }) {
      const args = { ...cubeTypeArgs(cubeTypes),
        $cardName: parent.name
      };
      return (0, _db.executeSelectOne)(sql.selectPickOrderByCard, args, 'avgPickOrder');
    },

    mainDeckPct(parent, {
      cubeTypes = ALL_CUBE_TYPES
    }) {
      const args = { ...cubeTypeArgs(cubeTypes),
        $cardName: parent.name
      };
      return (0, _db.executeSelectOne)(sql.selectIsMainPctByCard, args, 'isMainPct');
    },

    recentEntries(parent, {
      howMany = MAX_RESULTS
    }) {
      return (0, _db.executeSelectSome)(sql.selectEntriesByCardName, {
        $cardName: parent.name,
        $howMany: howMany
      });
    },

    wheelPct(parent, {
      cubeTypes = ALL_CUBE_TYPES
    }) {
      const args = { ...cubeTypeArgs(cubeTypes),
        $cardName: parent.name
      };
      return (0, _db.executeSelectOne)(sql.selectWheelPctByCard, args, 'wheelPct');
    },

    inEventPoolCount(parent, {
      cubeTypes = ALL_CUBE_TYPES
    }) {
      const args = { ...cubeTypeArgs(cubeTypes),
        $cardName: parent.name
      };
      return (0, _db.executeSelectOne)(sql.selectInPoolCountByCard, args, 'inPoolCount');
    },

    matchWinsInPool(parent, {
      cubeTypes = ALL_CUBE_TYPES
    }) {
      const args = { ...cubeTypeArgs(cubeTypes),
        $cardName: parent.name
      };
      return (0, _db.executeSelectOne)(sql.selectMatchWinsByCard, args, 'wins');
    },

    matchLossesInPool(parent, {
      cubeTypes = ALL_CUBE_TYPES
    }) {
      const args = { ...cubeTypeArgs(cubeTypes),
        $cardName: parent.name
      };
      return (0, _db.executeSelectOne)(sql.selectMatchLossesByCard, args, 'losses');
    },

    async bayesianWinRate(parent, {
      cubeTypes = ALL_CUBE_TYPES,
      vol = 0.03
    }) {
      const wins = await resolvers.Card.matchWinsInPool(parent, {
        cubeTypes
      });
      const losses = await resolvers.Card.matchLossesInPool(parent, {
        cubeTypes
      });
      const priorMatches = Math.pow(vol, -2) / 4 - 1;
      return (wins + priorMatches / 2) / (wins + losses + priorMatches);
    },

    cubesIn(parent, {
      asOf = new Date().toISOString()
    }) {
      return (0, _db.executeSelectSome)(sql.selectCubesForCard, {
        $cardName: parent.name,
        $asOf: asOf
      });
    },

    ownedMTGOCard(parent) {
      return (0, _db.executeSelectOne)(sql.selectOwnedMTGOCardByName, {
        $cardName: parent.name
      });
    }

  },
  MTGOCard: {
    dekRow(parent, {
      num = 1,
      sideboard = false
    }) {
      return `<Cards CatID="${parent.id}" Quantity="${num}" Sideboard="${sideboard ? 'true' : 'false'}" Name="${parent.mtgoName}" />`;
    },

    card(parent) {
      return {
        name: parent.name
      };
    }

  },
  Cube: {
    cardNames(parent) {
      return parent.listString.trim().split('\n').map(w => w.trim());
    },

    cards(parent) {
      return resolvers.Cube.cardNames(parent).map(name => ({
        name
      }));
    },

    recentEvents(parent, {
      howMany = MAX_RESULTS
    }) {
      return (0, _db.executeSelectSome)(sql.selectEventByCube, {
        $cubeId: parent.id,
        $howMany: howMany
      });
    },

    allCubesOfType(parent) {
      return (0, _db.executeSelectSome)(sql.selectCubesByType, {
        $cubeType: parent.cubeType
      });
    },

    ownedMTGOCards(parent) {
      return Promise.all(resolvers.Cube.cards(parent).map(card => resolvers.Card.ownedMTGOCard(card)));
    },

    async ownedDekString(parent) {
      const ownedCards = await resolvers.Cube.ownedMTGOCards(parent);
      return dekStringFromRows(ownedCards.map(mtgoCard => resolvers.MTGOCard.dekRow(mtgoCard, {})));
    }

  }
};
let typeDefs;

try {
  typeDefs = (0, _fs.readFileSync)("./src/schema.graphql", "utf-8");
} catch (_) {
  // sorry
  typeDefs = (0, _fs.readFileSync)("./node_modules/ocl-data/src/schema.graphql", "utf-8");
}

const schema = (0, _graphqlTools.makeExecutableSchema)({
  typeDefs,
  resolvers
});
const oclData = (0, _expressGraphql.default)({
  schema,
  graphiql: true
});
exports.oclData = oclData;