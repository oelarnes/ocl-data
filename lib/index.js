"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "oclData", {
  enumerable: true,
  get: function () {
    return _middleware.oclData;
  }
});
Object.defineProperty(exports, "initializeDb", {
  enumerable: true,
  get: function () {
    return _db.initializeDb;
  }
});
Object.defineProperty(exports, "oclMongo", {
  enumerable: true,
  get: function () {
    return _db.oclMongo;
  }
});
Object.defineProperty(exports, "syncData", {
  enumerable: true,
  get: function () {
    return _updates.syncData;
  }
});
Object.defineProperty(exports, "dataSyncLoop", {
  enumerable: true,
  get: function () {
    return _updates.dataSyncLoop;
  }
});
Object.defineProperty(exports, "getIdForHandle", {
  enumerable: true,
  get: function () {
    return _direct.getIdForHandle;
  }
});

var _http = _interopRequireDefault(require("http"));

var _express = _interopRequireDefault(require("express"));

var _middleware = require("./middleware");

var _db = require("./db");

var _updates = require("./updates");

var _direct = require("./direct");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

if (require.main === module) {
  const app = (0, _express.default)();
  (0, _updates.dataSyncLoop)();
  app.use('/data', _middleware.oclData);

  const server = _http.default.createServer(app);

  server.listen(4000);
  console.log('GraphQL server started on port %s', server.address().port);
}