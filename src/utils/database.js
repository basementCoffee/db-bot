const {google} = require('googleapis');
const client_email = process.env.CLIENT_EMAIL.replace(/\\n/gm, '\n');
const private_key = process.env.PRIVATE_KEY.replace(/\\n/gm, '\n');
const stoken = process.env.STOKEN.replace(/\\n/gm, '\n');

const client2 = new google.auth.JWT(client_email, null, private_key, [
  'https://www.googleapis.com/auth/spreadsheets'
]);

/**
 * Authorizes the google client
 */
client2.authorize(function (err) {
  if (err) {
    console.log('login-error:', err);
  } else {
    console.log('Connected to google apis.');
  }
});

const gsapi = google.sheets({
  version: 'v4',
  auth: client2
});

/**
 * Runs an update over the sheet and updates local variables. Returns the respective keys
 * and links within two maps (CongratsDatabase and ReferenceDatabase). The CongratsDatabase represents
 * unaltered keys and values while the ReferenceDatabase contains toUpper key names.
 * @param columnToRun The column letter/string to get the keys
 * @param secondColumn The column letter/string to get the values
 * @param nameOfSheet The name of the sheet to get the values from
 * @param numOfRuns Optional - The number of times this function has run recursively, default is 0
 * @returns {Promise<{congratsDatabase: Map<any, any>, line: [], referenceDatabase: Map<any, any>}|*>}
 */
const gsrun = async (columnToRun, secondColumn, nameOfSheet, numOfRuns = 0) => {
  nameOfSheet = nameOfSheet.toString();
  const spreadsheetSizeObjects = {
    spreadsheetId: stoken,
    range: nameOfSheet + '!D1'
  };
  let dataSizeFromSheets;
  let dsInt;
  if (numOfRuns > 2) return;
  try {
    dataSizeFromSheets = await gsapi.spreadsheets.values.get(
      spreadsheetSizeObjects
    );
    dsInt = dataSizeFromSheets.data.values;
    // dataSize.set(nameOfSheet, dataSizeFromSheets.data.values);
  } catch (e) {
    await createSheetNoMessage(nameOfSheet);
    return gsrun(columnToRun, secondColumn, nameOfSheet, numOfRuns++);
  }

  if (!dsInt) {
    await gsUpdateAdd2(1, 'D', nameOfSheet);
    return gsrun(columnToRun, secondColumn, nameOfSheet, numOfRuns++);
  }

  const songObjects = {
    spreadsheetId: stoken,
    range: nameOfSheet + '!' + columnToRun + '2:' + secondColumn + 'B' + dsInt
  };

  const dataSO = await gsapi.spreadsheets.values.get(songObjects);
  const arrayOfSpreadsheetValues = dataSO.data.values;

  let line;
  let keyT;
  let valueT;
  congratsDatabase.clear();
  referenceDatabase.clear();
  const keyArray = [];
  for (let i = 0; i < dsInt; i++) {
    // the array of rows (has two columns)
    line = arrayOfSpreadsheetValues[i];
    if (!line) continue;
    keyT = line[0];
    keyArray.push(keyT);
    valueT = line[1];
    congratsDatabase.set(keyT, valueT);
    referenceDatabase.set(keyT.toUpperCase(), valueT);
  }
  return {
    // the keys - case sensitive
    congratsDatabase: congratsDatabase,
    // the keys - all uppercase
    referenceDatabase: referenceDatabase,
    // the array of rows
    line: keyArray,
    // the size of the keys list
    dsInt: dsInt
  };
};

/**
 * Deletes the respective rows within the google sheets
 * @param message The message that triggered the command
 * @param sheetName The name of the sheet to edit
 * @param rowNumber The row to delete
 * @returns {Promise<void>}
 */
const deleteRows = async (message, sheetName, rowNumber) => {
  let res;
  try {
    const request = {
      spreadsheetId: '1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0',
      ranges: [sheetName],
      includeGridData: false,
      auth: client2
    };

    res = await gsapi.spreadsheets.get(request);
  } catch (error) {
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
              startIndex: rowNumber,
              endIndex: rowNumber + 1
            }
          }
        }]
      }
    },
    function (err, response) {
      if (err) {
        console.log('deleteRows error:', err);
      } else {
        gsrun('A', 'B', message.guild.id).then(() => {
        });
      }
      return response;
    }
  );
};

/**
 * Creates a google sheet with the given name and adds an initial
 * value to the database size column d.
 * @param nameOfSheet The name of the sheet to create
 */
const createSheetNoMessage = async (nameOfSheet) => {
  console.log('within create sheets');

  await gsapi.spreadsheets.batchUpdate({
      spreadsheetId: '1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0',
      resource: {
        requests: [{
          addSheet: {
            properties: {
              title: nameOfSheet
            }
          }
        }]
      }
    },
    async function (err, response) {
      if (err) {
      } else {
        await gsUpdateAdd2(1, 'D', nameOfSheet);
      }
      return response;
    }
  );
};

/**
 * Adds the entry into the column as a key, value pair.
 * @param {*} key The name of the key to add, goes into the last row of the firstColumnLetter
 * @param {*} link The name of the value to add, goes into the last row of the LastColumnLetter
 * @param {*} firstColumnLetter The key column letter, should be uppercase
 * @param {*} secondColumnLetter The link column letter, should be uppercase
 * @param nameOfSheet The name of the sheet to update
 * @param dsInt The size of the database plus 1
 */
const gsUpdateAdd = (key, link, firstColumnLetter, secondColumnLetter, nameOfSheet, dsInt) => {

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
          [key, link]
        ]
      }
    })
    .then(
      function (response) {
        // Handle the results here (response.result has the parsed body).
        // console.log("Response", response);
      },
      function (err) {
        console.error('Execute error', err);
      }
    );

  gsUpdateOverwrite(-1, 1, nameOfSheet, dsInt);
};

/**
 * Single cell add to the respective google sheets. Adds to the first row by default.
 * @param givenValue The value to input into the cell
 * @param firstColumnLetter The column name to update
 * @param nameOfSheet The name of the sheet to add to
 */
const gsUpdateAdd2 = async (givenValue, firstColumnLetter, nameOfSheet) => {

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
          [givenValue]
        ]
      }
    }).then(
      function (response) {
        // Handle the results here (response.result has the parsed body).
        return response;
      },
      function (err) {
        console.error('Execute error', err);
      }
    );
};

/**
 * Overwrites the cell D1.
 * @param value the final DB value, overrides addOn unless negative
 * @param addOn the number to mutate the current DB size by
 * @param nameOfSheet the name of the sheet to change
 * @param dsInt The size of the database plus 1
 */
const gsUpdateOverwrite = (value, addOn, nameOfSheet, dsInt) => {
  if (value < 0) {
    try {
      value = parseInt(dsInt) + addOn;
    } catch (e) {
      value = 1;
    }
  }
  const gsapi = google.sheets({
    version: 'v4',
    auth: client2
  });
  gsapi.spreadsheets.values
    .update({
      spreadsheetId: '1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0',
      range: nameOfSheet + '!D1',
      includeValuesInResponse: true,
      responseDateTimeRenderOption: 'FORMATTED_STRING',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [
          [value]
        ]
      }
    })
    .then(
      function (response) {
        // Handle the results here (response.result has the parsed body).
        // console.log("Response", response);
      },
      function (err) {
        console.error('Execute error', err);
      }
    );
};

// What is returned when searching the db, uses key-name
const congratsDatabase = new Map();
// Reference for the congrats database, uses uppercase key-name
const referenceDatabase = new Map();

exports.gsrun = gsrun;
exports.gsUpdateAdd = gsUpdateAdd;
exports.deleteRows = deleteRows;
exports.gsUpdateOverwrite = gsUpdateOverwrite;
