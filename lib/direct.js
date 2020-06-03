"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getIdForHandle = getIdForHandle;

var _db = require("./db");

function getIdForHandle(handle) {
  return (0, _db.executeSelectOne)(`SELECT id FROM player WHERE discordHandle = $handle`, {
    $handle: handle
  }, 'id');
}