"use strict";

var _db = require("./db");

var _updates = require("./updates");

if (!module.parent) {
  try {
    (0, _db.initializeDb)().then(() => {
      console.log('SQL Database initialized');
    }).then(_updates.dataSync);
  } catch (err) {
    console.log(err);
    console.log('Some error, OCL data not initialized');
  }
}