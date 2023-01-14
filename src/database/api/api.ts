/* eslint-disable camelcase */
// @ts-nocheck
import {google} from "googleapis";
const client_email = process.env.CLIENT_EMAIL?.replace(/\\n/gm, '\n');
const private_key = process.env.PRIVATE_KEY?.replace(/\\n/gm, '\n');
const stoken = process.env.STOKEN?.replace(/\\n/gm, '\n');
const GENERAL = 'GENERAL';

/**
 * Returns an Excel size function of for a given column (counts all values in the column).
 * @param col {string} The column to
 * @return {string} The size function for the column provided
 */
const dbSizeFunc = (col: string) => `=(COUNTA(${col}1:${col})+1)`;

const client2 = new google.auth.JWT(client_email, undefined, private_key, [
  'https://www.googleapis.com/auth/spreadsheets',
]);

/**
 * Authorizes the google client
 */
client2.authorize(function(err: Error | null) {
  if (err) {
    console.log('login-error:', err);
  }
  else {
    console.log('Connected to google apis.');
  }
});

const gsapi = google.sheets({
  version: 'v4',
  auth: client2,
});

/**
 * Logs out of google client.
 * @return {Promise<void>}
 */
const revokeClient = async () => {
  await client2.revokeCredentials();
};

/**
 * Runs an update over the sheet and updates local variables. Returns the respective keys
 * and links within two maps (CongratsDatabase and ReferenceDatabase). The CongratsDatabase represents
 * unaltered keys and values while the ReferenceDatabase contains toUpper key names.
 * @param columnToRun The column letter/string to get the keys
 * @param secondColumn The column letter/string to get the values
 * @param nameOfSheet The name of the sheet to get the values from
 * @param numOfRuns Optional - The number of times this function has run recursively, default is 0
 * @returns {Promise<{congratsDatabase: Map<any, any>, line: Array<any>, referenceDatabase: Map<any, any>, dsInt: number}>}
 */
const gsrun = async (columnToRun: string, secondColumn: string, nameOfSheet: string, numOfRuns = 0): Promise<{congratsDatabase: Map<any, any>, line: any[], referenceDatabase: Map<any, any>, dsInt: number}> => {
  nameOfSheet = nameOfSheet.toString();
  const spreadsheetSizeObjects = {
    spreadsheetId: stoken,
    range: nameOfSheet + '!D1',
  };
  let dataSizeFromSheets;
  let dsInt;
  if (numOfRuns > 2) {
    throw new Error('could not retrieve data');
  }
  try {
    dataSizeFromSheets = await gsapi.spreadsheets.values.get(
      spreadsheetSizeObjects,
    );
    dsInt = dataSizeFromSheets.data.values;
    console.log(dsInt)
    // dataSize.set(nameOfSheet, dataSizeFromSheets.data.values);
  }
  catch (e) {
    await createSheetNoMessage(nameOfSheet);
    await gsUpdateAdd2(dbSizeFunc('A'), 'D', nameOfSheet);
    return gsrun(columnToRun, secondColumn, nameOfSheet, numOfRuns++);
  }

  if (!dsInt) {
    await gsUpdateAdd2(dbSizeFunc('A'), 'D', nameOfSheet);
    return gsrun(columnToRun, secondColumn, nameOfSheet, numOfRuns++);
  }

  const songObjects = {
    spreadsheetId: stoken,
    range: nameOfSheet + '!' + columnToRun + '2:' + secondColumn + 'B' + dsInt,
  };

  const dataSO = await gsapi.spreadsheets.values.get(songObjects);
  const arrayOfSpreadsheetValues = dataSO.data.values;

  let line;
  let keyT;
  let valueT;
  // What is returned when searching the db, uses key-name
  const congratsDatabase = new Map();
  // Reference for the database, uses uppercase key-name
  const referenceDatabase = new Map();
  const keyArray = [];
  for (let i = 0; i < dsInt; i++) {
    // the array of rows (has two columns)
    try {
      line = arrayOfSpreadsheetValues![i];
      if (line && line[0]) {
        keyT = line[0];
        keyArray.push(keyT);
        valueT = line[1];
        congratsDatabase.set(keyT, valueT);
        referenceDatabase.set(keyT.toUpperCase(), valueT);
      }
    }
    catch (e) {}
  }
  return {
    // the keys - case-sensitive
    congratsDatabase,
    // the keys - all uppercase
    referenceDatabase,
    // the array of rows
    line: keyArray,
    // the size of the keys list
    dsInt,
  };
};

const gsrun_P = async (columnToRun: string, secondColumn: string, nameOfSheet: string, numOfRuns = 0): Promise<{ playlists: Map<string, Map<string, { name: string, timeStamp: string, link: string }>>, playlistArray: string[], globalKeys: Map<string, { name: string, timeStamp: string, link: string }>}> => {
  nameOfSheet = nameOfSheet.toString();
  const spreadsheetSizeObjects = {
    spreadsheetId: stoken,
    range: nameOfSheet + '!G1',
  };
  let dataSizeFromSheets;
  let dsInt;
  if (numOfRuns > 3) {
    throw new Error('could not retrieve data');
  }
  try {
    dataSizeFromSheets = await gsapi.spreadsheets.values.get(
      spreadsheetSizeObjects,
    );
    dsInt = dataSizeFromSheets.data.values;
    // dataSize.set(nameOfSheet, dataSizeFromSheets.data.values);
  }
  catch (e) {
    await createSheetNoMessage(nameOfSheet);
    return await gsrun_P(columnToRun, secondColumn, nameOfSheet, ++numOfRuns);
  }

  if (!dsInt) {
    await gsUpdateOverwrite([dbSizeFunc('E')], nameOfSheet, 'G', 1);
    return await gsrun_P(columnToRun, secondColumn, nameOfSheet, ++numOfRuns);
  }
  const songRange = `${nameOfSheet}!${columnToRun}2:${secondColumn}${dsInt + 1}`;
  const songObjects = {
    spreadsheetId: stoken,
    range: songRange,
  };

  const dataSO = await gsapi.spreadsheets.values.get(songObjects);
  const arrayOfSpreadsheetValues = dataSO.data.values;
  let line;
  // What is returned when searching the db, uses key-name
  const allPlaylists = new Map();
  const globalKeys = new Map();
  // array of playlist, is in order
  const playlistArray = [];
  for (let i = 0; i < dsInt; i++) {
    // the array of rows (has two columns)
    try {
      line = arrayOfSpreadsheetValues[i];
      if (line && line[0]) {
        // convert to -------
        // playlistMap [playlist, keysMap]
        // keysMap [upper(key), keyDataObj]
        // keyDataObj {name: "", timeStamp: "", link: ""}
        // getting -------
        // pn - playlist name & ks - keys array & kn - key name & ts: time stamp
        // {pn: "", ks: [{kn: "", ts}]}
        const playlistData = JSON.parse(line[0]);
        // Reference for the database, uses uppercase key-name
        const referenceDatabase = new Map();
        let incrementor = 0;
        const values = line[1]?.split(',');
        // create the keyDataObjects and put in maps
        if (values) {
          for (const keyObject of playlistData.ks) {
            const deserializedKeyObject = {
              name: keyObject.kn,
              link: values[incrementor++].trim(),
              timeStamp: keyObject.ts,
              playlistName: playlistData.pn,
            };
            referenceDatabase.set(keyObject.kn.toUpperCase(), deserializedKeyObject);
            globalKeys.set(keyObject.kn.toUpperCase(), deserializedKeyObject);
          }
        }
        allPlaylists.set(playlistData.pn.toUpperCase(), referenceDatabase);
        playlistArray.push(playlistData.pn);
      }
    }
    catch (e) {

    }
  }
  if (playlistArray.length < 1) {
    // if no playlist data is in sheets - add general
    allPlaylists.set(GENERAL, (new Map()));
    playlistArray.push(GENERAL);
  }
  return {
    playlists: allPlaylists, playlistArray, globalKeys,
  };
};

const getJSON = async (cellToRun: string, nameOfSheet: string) => {
  nameOfSheet = nameOfSheet.toString();

  const songObjects = {
    spreadsheetId: stoken,
    range: nameOfSheet + `!${cellToRun}:${cellToRun}`,
  };

  const dataSO = await gsapi.spreadsheets.values.get(songObjects);
  const arrayOfSpreadsheetValues = dataSO.data.values;

  let line;
  // What is returned when searching the db, uses key-name
  // the array of rows (has two columns)
  try {
    line = arrayOfSpreadsheetValues[0];
    if (line && line[0]) {
      let parsed;
      try {
        parsed = JSON.parse(line[0]);
      }
      catch (e) {
        console.log(e);
        parsed = {};
      }
      return parsed;
    }
  }
  catch (e) {}
};

/**
 * Deletes the respective rows within the google sheets
 * @param sheetName The name of the sheet to edit
 * @param rowNumber The row to delete
 * @returns {Promise<void>}
 */
const deleteRows = async (sheetName: string, rowNumber: number) => {
  let res;
  try {
    const request = {
      spreadsheetId: '1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0',
      ranges: [sheetName],
      includeGridData: false,
      auth: client2,
    };

    res = await gsapi.spreadsheets.get(request);
  }
  catch (error) {
    console.log('Error get sheetId:', error);
  }

  // gets the sheetId
  const sheetId = res.data.sheets[0].properties.sheetId;

  // ----------------------------------------------------------
  await gsapi.spreadsheets.batchUpdate({
    spreadsheetId: '1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0',
    resource: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheetId,
            dimension: 'ROWS',
            startIndex: rowNumber - 1,
            endIndex: rowNumber,
          },
        },
      }],
    },
  },
  function(err: Error | null, response: any) {
    if (err) {
      console.log('deleteRows error:', err);
    }
    return response;
  },
  );
};

/**
 * Creates a google sheet with the given name and adds an initial
 * value to the database size column d.
 * @param nameOfSheet The name of the sheet to create
 */
const createSheetNoMessage = async (nameOfSheet: string) => {
  console.log('within create sheets');

  await gsapi.spreadsheets.batchUpdate({
    spreadsheetId: '1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0',
    resource: {
      requests: [{
        addSheet: {
          properties: {
            title: nameOfSheet,
          },
        },
      }],
    },
  },
  async function(err: Error | undefined, response: any) {
    if (err) {
    }
    else {
      await gsUpdateOverwrite([dbSizeFunc('E')], nameOfSheet, 'G', 1);
    }
    return response;
  },
  );
};

/**
 * Adds the entry into the column as a key, value pair.
 * @param key The name of the key to add, goes into the last row of the firstColumnLetter
 * @param link The name of the value to add, goes into the last row of the LastColumnLetter
 * @param firstColumnLetter The key column letter, should be uppercase
 * @param secondColumnLetter The link column letter, should be uppercase
 * @param nameOfSheet The name of the sheet to update
 */
const gsUpdateAdd = (key: string, link: string, firstColumnLetter: string, secondColumnLetter: string, nameOfSheet: string) => {
  gsapi.spreadsheets.values
    .append({
      spreadsheetId: '1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0',
      range: nameOfSheet + '!' + firstColumnLetter + '2:' + secondColumnLetter + '2',
      includeValuesInResponse: true,
      insertDataOption: 'INSERT_ROWS',
      responseDateTimeRenderOption: 'FORMATTED_STRING',
      responseValueRenderOption: 'FORMATTED_VALUE',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [
          [key, link],
        ],
      },
    })
    .then(
      function(response: any) {
        // Handle the results here (response.result has the parsed body).
        // console.log("Response", response);
      },
      function(err: Error | null) {
        console.error('Execute error', err);
      },
    );
};

/**
 * Single cell add to the respective google sheets. Adds to the first row by default.
 * @param givenValue The value to input into the cell
 * @param firstColumnLetter The column name to update
 * @param nameOfSheet The name of the sheet to add to
 */
const gsUpdateAdd2 = async (givenValue: string, firstColumnLetter: string, nameOfSheet: string) => {
  await gsapi.spreadsheets.values
    .append({
      spreadsheetId: '1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0',
      range: nameOfSheet + '!' + firstColumnLetter + '1',
      includeValuesInResponse: true,
      insertDataOption: 'INSERT_ROWS',
      responseDateTimeRenderOption: 'FORMATTED_STRING',
      responseValueRenderOption: 'FORMATTED_VALUE',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [
          [givenValue],
        ],
      },
    }).then(
      function(response: any) {
        // Handle the results here (response.result has the parsed body).
        return response;
      },
      function(err: Error | null) {
        console.error('Execute error', err);
      },
    );
};

/**
 * Overwrites any cell. Overwrites cell D1 by default (if cell is not specified).
 * @param values {Array<string>} The value to input into the cell(s)
 * @param nameOfSheet the name of the sheet to change
 * @param column1 The first column to update
 * @param row1 The first row to update
 * @param column2 The second column to update
 * @param row2 The second row to update
 */
const gsUpdateOverwrite = (values: (string | number | (string | number)[]), nameOfSheet: string, column1 = 'D', row1 = 1, column2?: string, row2?: number) => {
  const range = `${nameOfSheet}!${column1}${row1}` + (row2 ? `:${column2}${row2}` : '');
  gsapi.spreadsheets.values
    .update({
      spreadsheetId: '1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0',
      range: range,
      includeValuesInResponse: true,
      responseDateTimeRenderOption: 'FORMATTED_STRING',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [
          values,
        ],
      },
    })
    .then(
      function(response: any) {
        // Handle the results here (response.result has the parsed body).
        // console.log("Response", response);
      },
      function(err: Error | null) {
        console.error('Execute error', err);
      },
    );
};

export { gsrun, gsUpdateAdd, gsUpdateOverwrite, deleteRows, gsrun_P, getJSON, revokeClient };
