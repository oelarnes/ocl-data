"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.oclData = void 0;

var _fs = _interopRequireWildcard(require("fs"));

var _expressGraphql = _interopRequireDefault(require("express-graphql"));

var _graphqlTools = require("graphql-tools");

var _db = require("./db");

var sql = _interopRequireWildcard(require("./sqlTemplates"));

var _updates = require("./updates");

var _axios = _interopRequireDefault(require("axios"));

var _formData = _interopRequireDefault(require("form-data"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

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
    player(_, {
      id
    }) {
      return (0, _db.executeSelectOne)(sql.selectPlayer, {
        $playerId: id
      });
    },

    players(_, {
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

    events(_, {
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

    async ownedDekString(_, {
      mainCardNames = [],
      sideboardCardNames = []
    }) {
      const mainCards = await Promise.all(mainCardNames.map(name => resolvers.Card.ownedMTGOCard({
        name
      })));
      const sideboardCards = await Promise.all(sideboardCardNames.map(name => resolvers.Card.ownedMTGOCard({
        name
      })));
      return dekStringFromRows(mainCards.map(card => resolvers.MTGOCard.dekRow(card, {
        num: 1,
        sideboard: false
      })).concat(sideboardCards.map(card => resolvers.MTGOCard.dekRow(card, {
        num: 1,
        sideboard: true
      }))));
    },

    async MTGOCards(_, {
      owned = true,
      wishlist = true
    }) {
      let cards = [];

      if (owned) {
        const newCards = await (0, _db.executeSelectSome)(sql.selectOwnedCards);
        cards = cards.concat(newCards);
      }

      if (wishlist) {
        const newCards = await (0, _db.executeSelectSome)(sql.selectWishlistCards);
        cards = cards.concat(newCards);
      }

      return cards;
    }

  },
  Mutation: {
    async syncData(_) {
      await (0, _updates.syncData)();
      return true;
    },

    async addEvent(_, {
      eventId,
      sheetId
    }) {
      (0, _db.addEventToConfig)(eventId, sheetId);
      await (0, _updates.syncData)();
      return true;
    }

  },
  Player: {
    eventEntries(player, {
      after,
      howMany = MAX_RESULTS,
      asc = false
    }) {
      const query = asc ? sql.selectEntriesByPlayerAsc : sql.selectEntriesByPlayerDesc;
      after = getDateAfter(after, asc);
      return (0, _db.executeSelectSome)(query, {
        $playerId: player.id,
        $howMany: howMany,
        $after: after
      });
    },

    async pairingsVs(player, {
      oppId,
      howMany = MAX_RESULTS,
      after,
      asc = false
    }) {
      const query = asc ? sql.selectPairingsByPlayerPairAsc : sql.selectPairingsByPlayerPairDesc;
      after = getDateAfter(after, asc);
      const rows = await (0, _db.executeSelectSome)(query, {
        $playerId: player.id,
        $oppId: oppId,
        $howMany: howMany,
        $after: after
      });
      return rows.map(row => ({ ...row,
        asPlayerId: player.id
      }));
    },

    standing(player, {
      season = undefined
    }) {
      const [query, args] = season === undefined ? [sql.selectStandingForPlayerAllTime, {
        $playerId: player.id,
        $howMany: MAX_RESULTS,
        $after: 0
      }] : [sq.selectStandingForPlayerBySeason, {
        $playerId: player.id,
        $season: season,
        $howMany: MAX_RESULTS,
        $after: 0
      }];
      return (0, _db.executeSelectOne)(query, args);
    },

    async openPairings(player) {
      const pairings = await (0, _db.executeSelectSome)(sql.selectOpenPairingsByPlayer, {
        $playerId: player.id,
        $nowTime: new Date().toISOString()
      });
      return pairings.map(pairing => ({ ...pairing,
        asPlayerId: player.id
      }));
    },

    openEntries(player) {
      return (0, _db.executeSelectSome)(sql.selectOpenEntriesByPlayer, {
        $playerId: player.id
      });
    }

  },
  OCLEvent: {
    playerEntries(event, {
      byFinish = false
    }) {
      if (byFinish) {
        return (0, _db.executeSelectSome)(sql.selectEntriesByEventByPosition, {
          $eventId: event.id
        });
      }

      return (0, _db.executeSelectSome)(sql.selectEntriesByEvent, {
        $eventId: event.id
      });
    },

    pairings(event, {
      roundNum
    }) {
      const [query, args] = roundNum === undefined ? [sql.selectPairingsByEvent, {
        $eventId: event.id
      }] : [sql.selectPairingsByEventAndRound, {
        $eventId: event.id,
        $roundNum: roundNum
      }];
      return (0, _db.executeSelectSome)(query, args);
    },

    cube(event) {
      return (0, _db.executeSelectOne)(sql.selectCube, {
        $cubeId: event.cubeId
      });
    },

    winningEntry(event) {
      return (0, _db.executeSelectOne)(sql.selectEventWinner, {
        $eventId: event.id
      });
    },

    async standingsJpgURL(event) {
      const jpgURL = (0, _db.executeSelectOne)(`SELECT standingsJpgURL FROM eventExtra WHERE id = $eventId`, {
        $eventId: event.id
      }, 'standingsJpgURL');

      if (jpgURL != null) {
        return jrgURL;
      }

      const today = new Date().toISOString();
      const htciConfig = (0, _db.getFreshDbConfig)().htciapi;
      const latestEventId = await (0, _db.executeSelectOne)(`SELECT id FROM event WHERE completedDate < $today ORDER BY completedDate DESC`, {
        $today: today
      }, 'id');

      if (latestEventId !== event.id || config == undefined) {
        return null;
      }

      const standings = await (0, _db.executeSelectSome)(sql.selectStandingsWithDiscordHandle, {
        $howMany: MAX_RESULTS,
        $season: event.season,
        $howMany: MAX_RESULTS,
        $after: 0
      });
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
}`;
      const rowsHtml = standings.reduce((html, row) => html.concat(`<tr>
        <td>${row.rank}</td>
        <td>${row.discordHandle}</td>
        <td>${row.qps}</td>
        <td>${row.matchWins}</td>
        <td>${row.matchLosses}</td>
        <td>${row.allTimeRank}</td>
    </tr>
`), '');
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
`;
      const token = Buffer.from(`${htciConfig.user}:${htciConfig.key}`, 'utf8').toString('base64');
      const {
        data
      } = await _axios.default.post('https://hcti.io/v1/image', {
        html,
        css,
        google_fonts: "Roboto"
      }, {
        headers: {
          'Authorization': `Basic ${token}`
        }
      });

      if ((data === null || data === void 0 ? void 0 : data.url) !== undefined) {
        await (0, _db.executeRun)(`UPDATE eventExtra SET standingsJpgURL = $standingsJpgURL WHERE id = $eventId`, {
          $eventId: event.id,
          $standingsJpgURL: data.url
        });
        return data.url;
      }

      return null;
    }

  },
  Entry: {
    player(entry) {
      return (0, _db.executeSelectOne)(sql.selectPlayer, {
        $playerId: entry.playerId
      });
    },

    event(entry) {
      return (0, _db.executeSelectOne)(sql.selectEvent, {
        $eventId: entry.eventId
      });
    },

    async pairings(entry) {
      const pairings = await (0, _db.executeSelectSome)(sql.selectPairingsByEntry, {
        $eventId: entry.eventId,
        $playerId: entry.playerId
      });
      return pairings.map(row => ({ ...row,
        asPlayerId: entry.playerId
      }));
    },

    async matchWins(entry) {
      const winsRow = await (0, _db.executeSelectOne)(sql.selectEntryWins, {
        $eventId: entry.eventId,
        $playerId: entry.playerId
      });
      return winsRow === null || winsRow === void 0 ? void 0 : winsRow.wins;
    },

    async matchLosses(entry) {
      const lossesRow = await (0, _db.executeSelectOne)(sql.selectEntryLosses, {
        $eventId: entry.eventId,
        $playerId: entry.playerId
      });
      return lossesRow === null || lossesRow === void 0 ? void 0 : lossesRow.losses;
    },

    pool(entry) {
      return (0, _db.executeSelectSome)(sql.selectPicksForEntry, {
        $eventId: entry.eventId,
        $playerId: entry.playerId
      });
    },

    main(entry) {
      return entry.pool.filter(row => row.isMain || row.isMain === null);
    },

    sideboard(entry) {
      return entry.pool.filter(row => row.isMain === 0);
    },

    async ownedDekString(entry) {
      const mainMTGOCards = await Promise.all(resolvers.Entry.main(entry).map(pick => resolvers.Card.ownedMTGOCard(resolvers.Pick.card(pick))));
      const sbMTGOCards = await Promise.all(resolvers.Entry.sideboard(entry).map(pick => resolvers.Card.ownedMTGOCard(resolvers.Pick.card(pick))));
      const mainRows = mainMTGOCards.map(card => resolvers.MTGOCard.dekRow(card, {
        num: 1,
        sideboard: false
      }));
      const sbRows = sbMTGOCards.map(card => resolvers.MTGOCard.dekRow(card, {
        num: 1,
        sideboard: true
      }));
      const dekRows = mainRows.concat(sbRows);
      return dekStringFromRows(dekRows);
    },

    async draftlogURL(entry) {
      const extraRow = await (0, _db.executeSelectOne)(`SELECT draftlogURL, draftlogSource FROM entryExtra WHERE playerId = $playerId AND eventId = $eventId`, {
        $playerId: entry.playerId,
        $eventId: entry.eventId
      });

      if (extraRow == null) {
        return null;
      }

      if (extraRow.draftlogURL != null || extraRow.draftlogSource == null) {
        return extraRow.draftlogURL;
      } else {
        return new Promise((resolve, reject) => {
          console.log(extraRow.draftlogSource);
          const form = new _formData.default();
          form.append('draft', _fs.default.createReadStream(`data/events/${entry.eventId}/${extraRow.draftlogSource}`));
          form.submit('https://magicprotools.com/draft/upload', (err, res) => {
            if (err) {
              reject(err);
            }

            console.log(res.headers);
            const logURL = `https://magicprotools.com${res.headers.location}`;
            resolve(logURL);
          });
        }).then(async logURL => {
          await (0, _db.executeRun)('UPDATE entryExtra SET draftlogURL = $draftlogURL WHERE eventId = $eventId AND playerId = $playerId', {
            $eventId: entry.eventId,
            $playerId: entry.playerId,
            $draftlogURL: logURL
          });
          return logURL;
        });
      }
    }

  },
  Pairing: {
    p1Entry(pairing) {
      return (0, _db.executeSelectOne)(sql.selectEntry, {
        $playerId: pairing.p1Id,
        $eventId: pairing.eventId
      });
    },

    p2Entry(pairing) {
      return (0, _db.executeSelectOne)(sql.selectEntry, {
        $playerId: pairing.p2Id,
        $eventId: pairing.eventId
      });
    },

    opponentId(pairing) {
      return pairing.asPlayerId === undefined ? undefined : pairing.asPlayerId === pairing.p1Id ? pairing.p2Id : pairing.p1Id;
    },

    asPlayerGameWins(pairing) {
      return pairing.asPlayerId === undefined ? undefined : pairing.asPlayerId === pairing.p1Id ? pairing.p1GameWins : pairing.p2GameWins;
    },

    asPlayerMatchWin(pairing) {
      return pairing.asPlayerId === undefined ? undefined : pairing.asPlayerId == pairing.p1Id ? pairing.p1MatchWin : pairing.p2MatchWin;
    },

    opponentMatchWin(pairing) {
      return pairing.asPlayerId === undefined ? undefined : pairing.asPlayerId == pairing.p1Id ? pairing.p2MatchWin : pairing.p1MatchWin;
    },

    opponentGameWins(pairing) {
      return pairing.asPlayerId === undefined ? undefined : pairing.asPlayerId === pairing.p1Id ? pairing.p2GameWins : pairing.p1GameWins;
    },

    asPlayerEntry(pairing) {
      return pairing.asPlayerId === undefined ? undefined : (0, _db.executeSelectOne)(sql.selectEntry, {
        $playerId: pairing.asPlayerId,
        $eventId: pairing.eventId
      });
    },

    opponentEntry(pairing, args) {
      return pairing.asPlayerId === undefined ? undefined : (0, _db.executeSelectOne)(sql.selectEntry, {
        $playerId: resolvers.Pairing.opponentId(pairing, args),
        $eventId: pairing.eventId
      });
    },

    winnerId(pairing) {
      return pairing.p1MatchWin === undefined ? undefined : pairing.p1MatchWin ? pairing.p1Id : pairing.p2Id;
    },

    loserId(pairing) {
      return pairing.p1MatchWin === undefined ? undefined : pairing.p1MatchWin ? pairing.p2Id : pairing.p1Id;
    },

    winnerEntry(pairing, args) {
      return (0, _db.executeSelectOne)(sql.selectEntry, {
        $playerId: resolvers.Pairing.winnerId(pairing, args),
        $eventId: pairing.eventId
      });
    },

    loserEntry(pairing, args) {
      return (0, _db.executeSelectOne)(sql.selectEntry, {
        $playerId: resolvers.Pairing.loserId(pairing, args),
        $eventId: pairing.eventId
      });
    }

  },
  Standing: {
    player(standing) {
      return (0, _db.executeSelectOne)(sql.selectPlayer, {
        $playerId: standing.playerId
      });
    }

  },
  Pick: {
    otherCardNames(pick) {
      var _pick$otherCardNamesS;

      return ((_pick$otherCardNamesS = pick.otherCardNamesString) === null || _pick$otherCardNamesS === void 0 ? void 0 : _pick$otherCardNamesS.split('\n')) || [];
    },

    poolAsOfNames(pick) {
      if (pick.pickNum === undefined || pick.packNum === undefined) {
        return undefined;
      }

      return (0, _db.executeSelectSome)(`SELECT cardName FROM pick WHERE playerId = $playerId AND eventId = $eventId AND (packNum < $packNum OR (packNum = $packNum AND pickNum < $pickNum))`, {
        $playerId: pick.playerId,
        $eventId: pick.eventId,
        $packNum: pick.packNum,
        $pickNum: pick.pickNum
      }, 'cardName');
    },

    card(pick) {
      return {
        name: pick.cardName
      };
    },

    poolAsOf(pick) {
      return resolvers.Pick.poolAsOfNames(pick).map(name => ({
        name
      }));
    },

    otherCards(pick) {
      return resolvers.Pick.otherCardNames(pick).map(name => ({
        name
      }));
    }

  },
  Card: {
    avgPickOrder(card, {
      cubeTypes = ALL_CUBE_TYPES
    }) {
      const args = { ...cubeTypeArgs(cubeTypes),
        $cardName: card.name
      };
      return (0, _db.executeSelectOne)(sql.selectPickOrderByCard, args, 'avgPickOrder');
    },

    mainDeckPct(card, {
      cubeTypes = ALL_CUBE_TYPES
    }) {
      const args = { ...cubeTypeArgs(cubeTypes),
        $cardName: card.name
      };
      return (0, _db.executeSelectOne)(sql.selectIsMainPctByCard, args, 'isMainPct');
    },

    recentEntries(card, {
      howMany = MAX_RESULTS
    }) {
      return (0, _db.executeSelectSome)(sql.selectEntriesByCardName, {
        $cardName: card.name,
        $howMany: howMany
      });
    },

    wheelPct(card, {
      cubeTypes = ALL_CUBE_TYPES
    }) {
      const args = { ...cubeTypeArgs(cubeTypes),
        $cardName: card.name
      };
      return (0, _db.executeSelectOne)(sql.selectWheelPctByCard, args, 'wheelPct');
    },

    inEventPoolCount(card, {
      cubeTypes = ALL_CUBE_TYPES
    }) {
      const args = { ...cubeTypeArgs(cubeTypes),
        $cardName: card.name
      };
      return (0, _db.executeSelectOne)(sql.selectInPoolCountByCard, args, 'inPoolCount');
    },

    matchWinsInPool(card, {
      cubeTypes = ALL_CUBE_TYPES
    }) {
      const args = { ...cubeTypeArgs(cubeTypes),
        $cardName: card.name
      };
      return (0, _db.executeSelectOne)(sql.selectMatchWinsByCard, args, 'wins');
    },

    matchLossesInPool(card, {
      cubeTypes = ALL_CUBE_TYPES
    }) {
      const args = { ...cubeTypeArgs(cubeTypes),
        $cardName: card.name
      };
      return (0, _db.executeSelectOne)(sql.selectMatchLossesByCard, args, 'losses');
    },

    async bayesianWinRate(card, {
      cubeTypes = ALL_CUBE_TYPES,
      vol = 0.03
    }) {
      const wins = await resolvers.Card.matchWinsInPool(card, {
        cubeTypes
      });
      const losses = await resolvers.Card.matchLossesInPool(card, {
        cubeTypes
      });
      const priorMatches = Math.pow(vol, -2) / 4 - 1;
      return (wins + priorMatches / 2) / (wins + losses + priorMatches);
    },

    cubesIn(card, {
      asOf = new Date().toISOString()
    }) {
      return (0, _db.executeSelectSome)(sql.selectCubesForCard, {
        $cardName: card.name,
        $asOf: asOf
      });
    },

    async ownedMTGOCard(card) {
      const ownedCard = await (0, _db.executeSelectOne)(sql.selectOwnedMTGOCardByName, {
        $cardName: card.name
      });

      if (ownedCard === undefined) {
        return (0, _db.executeSelectOne)(sql.selectWishlistCardByName, {
          $cardName: card.name
        });
      }

      return ownedCard;
    }

  },
  MTGOCard: {
    dekRow(mtgoCard, {
      num = 1,
      sideboard = false
    }) {
      return `<Cards CatID="${mtgoCard.id}" Quantity="${num}" Sideboard="${sideboard ? 'true' : 'false'}" Name="${mtgoCard.mtgoName}" />`;
    },

    card(mtgoCard) {
      return {
        name: mtgoCard.name
      };
    }

  },
  Cube: {
    cardNames(cube) {
      return cube.listString.trim().split('\n').map(w => w.trim());
    },

    cards(cube) {
      return resolvers.Cube.cardNames(cube).map(name => ({
        name
      }));
    },

    recentEvents(cube, {
      howMany = MAX_RESULTS
    }) {
      return (0, _db.executeSelectSome)(sql.selectEventByCube, {
        $cubeId: cube.id,
        $howMany: howMany
      });
    },

    allCubesOfType(cube) {
      return (0, _db.executeSelectSome)(sql.selectCubesByType, {
        $cubeType: cube.cubeType
      });
    },

    ownedMTGOCards(cube) {
      return Promise.all(resolvers.Cube.cards(cube).map(card => resolvers.Card.ownedMTGOCard(card)));
    },

    async ownedDekString(cube) {
      const ownedCards = await resolvers.Cube.ownedMTGOCards(cube);
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