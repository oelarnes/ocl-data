"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getDataTable = getDataTable;
exports.writePairingCompletedDate = writePairingCompletedDate;
exports.writeEventCompletedDate = writeEventCompletedDate;
exports.writeEventId = writeEventId;
exports.writeSeatingsToSheet = writeSeatingsToSheet;
exports.closeEntries = closeEntries;

const fs = require('fs');

const readline = require('readline');

const {
  google
} = require('googleapis'); // If modifying these scopes, delete token.json.


const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']; // The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.

const TOKEN_PATH = 'google-auth/token.json';
/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */

function authorize(credentials, callback) {
  const {
    client_secret,
    client_id,
    redirect_uris
  } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]); // Check if we have previously stored a token.

  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token)); // limit 100 requests per 100 seconds per user on google API

    setTimeout(() => callback(oAuth2Client), 1001);
  });
}
/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */


function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', code => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error while trying to retrieve access token', err);
      oAuth2Client.setCredentials(token); // Store the token to disk for later program executions

      fs.writeFile(TOKEN_PATH, JSON.stringify(token), err => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}
/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */


function fetchTableAndResolve(resolve, reject, tableName, spreadsheetId) {
  return function getDataTable(auth) {
    const sheets = google.sheets({
      version: 'v4',
      auth
    });
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tableName}!A1:M`
    }, (err, res) => {
      if (err) {
        reject(err);
      } else {
        resolve(res.data.values);
      }
    });
  };
}

function getDataTable(tableName, spreadsheetId) {
  return new Promise((resolve, reject) => {
    const dataFetch = fetchTableAndResolve(resolve, reject, tableName, spreadsheetId); // Load client secrets from a local file.

    fs.readFile('google-auth/credentials.json', (err, content) => {
      if (err) reject(err); // Authorize a client with credentials, then call the Google Sheets API.

      authorize(JSON.parse(content), dataFetch);
    });
  });
}

async function writePairingCompletedDate(spreadsheetId, values) {
  function writeFn(auth) {
    const sheets = google.sheets({
      version: 'v4',
      auth
    });
    return sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `pairing!K2:K13`,
      valueInputOption: "RAW",
      resource: {
        values
      }
    });
  }

  return new Promise((resolve, reject) => {
    fs.readFile('google-auth/credentials.json', (err, content) => {
      if (err) reject(err); // Authorize a client with credentials, then call the Google Sheets API.

      authorize(JSON.parse(content), resolve);
    });
  }).then(writeFn);
}

async function writeEventCompletedDate(spreadsheetId) {
  function writeFn(auth) {
    const sheets = google.sheets({
      version: 'v4',
      auth
    });
    return sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `event!D2:D2`,
      valueInputOption: "RAW",
      resource: {
        values: [[new Date().toISOString()]]
      }
    });
  }

  return new Promise((resolve, reject) => {
    fs.readFile('google-auth/credentials.json', (err, content) => {
      if (err) reject(err); // Authorize a client with credentials, then call the Google Sheets API.

      authorize(JSON.parse(content), resolve);
    });
  }).then(writeFn);
}

async function writeEventId(spreadsheetId, eventId) {
  function writeFn(auth) {
    const sheets = google.sheets({
      version: 'v4',
      auth
    });
    return sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Bracket!A1:A1`,
      valueInputOption: "RAW",
      resource: {
        values: [[eventId]]
      }
    });
  }

  return new Promise((resolve, reject) => {
    fs.readFile('google-auth/credentials.json', (err, content) => {
      if (err) reject(err); // Authorize a client with credentials, then call the Google Sheets API.

      authorize(JSON.parse(content), resolve);
    });
  }).then(writeFn);
}

async function writeSeatingsToSheet(spreadsheetId, playerIds) {
  function writeFn(auth) {
    const sheets = google.sheets({
      version: 'v4',
      auth
    });
    return sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `entry!B2:B9`,
      valueInputOption: "RAW",
      resource: {
        values: playerIds
      }
    });
  }

  return new Promise((resolve, reject) => {
    fs.readFile('google-auth/credentials.json', (err, content) => {
      if (err) reject(err); // Authorize a client with credentials, then call the Google Sheets API.

      authorize(JSON.parse(content), resolve);
    });
  }).then(writeFn);
}

async function closeEntries(spreadsheetId) {
  function writeFn(auth) {
    const sheets = google.sheets({
      version: 'v4',
      auth
    });
    return sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `entry!E2:E9`,
      valueInputOption: "RAW",
      resource: {
        values: new Array(8).fill([0])
      }
    });
  }

  return new Promise((resolve, reject) => {
    fs.readFile('google-auth/credentials.json', (err, content) => {
      if (err) reject(err); // Authorize a client with credentials, then call the Google Sheets API.

      authorize(JSON.parse(content), resolve);
    });
  }).then(writeFn);
}