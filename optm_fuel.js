/*
 * This script is designed to automate the process of tracking fuel status for EVE Online structures.
 * It pulls data from the game using GESI as a dependency in Google sheets to access EVE Online's API, 
 * processes the data, and reports the status to a Discord server via a web hook.
 * 
 * The script consists of several functions:
 * - setupSheetsForNewUser: Sets up the necessary sheets for a new user and provides instructions for setting up time-based triggers.
 * - updateStationFuel: Pulls new fuel data from the game and updates the 'Pull' sheet.
 * - getUtcTimestampToS2: Gets the current UTC timestamp and outputs it to cell D1 on the 'CleanData' sheet.
 * - reportStatusToDiscord: Reports the status to a Discord server.
 * - clearCellS2: Clears cell D1 on the 'CleanData' sheet.
 * 
 * The script uses time-based triggers to run these functions at specified intervals.
 */

// This function is triggered when the Google Sheets document is opened
function onOpen() {
    var ui = SpreadsheetApp.getUi();
  
    // Create a custom menu in the spreadsheet named 'Fuel stuff'
    ui.createMenu('Fuel stuff')
      // Add an item to the custom menu. When this item is clicked, it will trigger the 'updateStationFuel' function
      .addItem('Update Station Fuel', 'updateStationFuel')
      // Add an item to the custom menu. When this item is clicked, it will trigger the 'reportStatusToDiscord' function
      .addItem('Report Status to Discord', 'reportStatusToDiscord')
      // Add an item to clear cell D1 on the "CleanData" sheet
      .addItem('Clear Time', 'clearCellS2')
      // Add an item to get the UTC timestamp and output it to cell D1 on the "CleanData" sheet
      .addItem('Get Time', 'getUtcTimestampToS2')
      // Add the custom menu to the user interface
      .addToUi();
  
    // Create a separate menu for the setup function
    ui.createMenu('Setup')
      // Add an item to get Setup the sheet for a new user
      .addItem('Setup', 'setupSheetsForNewUser')
      // Add the setup menu to the user interface
      .addToUi();
  }
  
  // This function clears cell D1 on the "CleanData" sheet
  function clearCellS2() {
    // Get the active spreadsheet
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    // Get the "FuelData" sheet from the active spreadsheet
    var sheet = spreadsheet.getSheetByName("CleanData");
    // Clear the content of cell D1
    sheet.getRange("D1").clearContent();
  }
  
  // This function gets the current UTC timestamp and outputs it to cell D1 on the "CleanData" sheet
  function getUtcTimestampToS2() {
   // Get the stored ID of the spreadsheet
   var spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
   // Get the spreadsheet by its ID
   var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    // Get the "FuelData" sheet from the active spreadsheet
    var sheet = spreadsheet.getSheetByName("CleanData");
    // Get the current UTC timestamp
    var utcTimestamp = getUtcTimestamp();
    // Write the UTC timestamp to cell D1
    sheet.getRange("D1").setValue(utcTimestamp);
  }
  
  // This function returns the current UTC timestamp
  function getUtcTimestamp() {
    // Get the current date and time
    var currentDate = new Date();
    // Convert the current date and time to UTC
    var utcDate = new Date(currentDate.toUTCString());
    // Return the UTC date and time as a string in ISO format
    return utcDate.toISOString();
  }
  
// This function updates the station's fuel.
function updateStationFuel() {
    // Get the stored ID of the spreadsheet
    var spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
    // Get the spreadsheet by its ID
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var esiListSheet = spreadsheet.getSheetByName("ESI_List");
    var pullSheet = spreadsheet.getSheetByName("Pull");
  
    // If the 'Pull' sheet does not exist, create it.
    if (!pullSheet) {
      pullSheet = spreadsheet.insertSheet("Pull");
    }
  
    // Clear the 'Pull' sheet.
    pullSheet.clear();
  
    // Get the names from the 'ESI_List' sheet.
    var names = esiListSheet.getRange("A2:A").getValues();
  
    // Initialize the row counter for the 'Pull' sheet.
    var pullSheetRow = 3;
  
    // Loop through the names.
    for (var i = 0; i < names.length; i++) {
      if (names[i][0] !== "") {
        // Call the 'corporations_corporation_structures' function with the current name.
        var result = GESI.corporations_corporation_structures("en", names[i][0]);
  
        // If the 'result' array is not empty, populate the 'Pull' sheet with the data.
      
        if (Array.isArray(result) && result.length > 0) {
          pullSheet.getRange(pullSheetRow, 1, result.length, result[0].length).setValues(result);
          pullSheetRow += result.length + 5;  // Skip 5 rows after each output.
        }
  
        // Wait for 5 seconds before moving to the next name.
        Utilities.sleep(5000);
      }
    }
  }
  
  // I want to sort a multi-dim array so I have to write a custom sort function
  // sort() will send the two elements that it is comparing to this function
  // The station name is in element [0] not [0][0] as in teh original array
  function sortFunction(a, b) {
      if (a[0] === b[0]) {
          return 0;
      }
      else {
          return (a[0] < b[0]) ? -1 : 1;
      }
  }
  
  // This function reports the status to Discord
  function reportStatusToDiscord() {
    // Get the stored ID of the spreadsheet
    var spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
    // Get the spreadsheet by its ID
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      
    // Get the Discord webhook URL from cell G2 of the "CleanData" sheet
    var discordWebhookUrl = spreadsheet.getSheetByName("ESI_List").getRange("G2").getValue();   

    // Get the sheet named "CleanData" from the active spreadsheet
    var sheet = spreadsheet.getSheetByName("CleanData");
  
    // Get all the data from the "CleanData" sheet
    var data = sheet.getDataRange().getValues();
    var timeupdate = data[0][4]

    //Slice the array from index 3:end and then sort it A-Z
    //This skips the 1st 4 lines.  Are we skipping 1 too many?
    var dataStnsOnly = data.slice(3).sort(sortFunction)

    // Prepare the message to be sent to Discord
    var message = "**OPTM Fuel Status Update (" + timeupdate + "):**\n\n";
  
    // We already cut the 1st 4 lines so just run through the sorted array like usual
    for (var i = 0; i < dataStnsOnly.length; i++) {
      // Get the station name from the current row
      var stationName = dataStnsOnly[i][0];
      
      // Get the days and hours remaining from the current row and parse them as integers
      var daysHours = dataStnsOnly[i][1].split(' ');
      var daysremain = parseInt(daysHours[0]);
      var hoursremain = parseInt(daysHours[2]);

      // Calculate the future date that is 'daysremain' days and 'hoursremain' hours away from now
      var futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysremain);
      futureDate.setHours(futureDate.getHours() + hoursremain);
      // Convert the future date to a Unix timestamp
      var futureTimestamp = Math.floor(futureDate.getTime() / 1000);        
      // Get the state from the current row
      var state = dataStnsOnly[i][3];
        
      // Skip rows with empty station name
      if (stationName) {
        // Prepare the line to be added to the message
        var line = "**" + stationName + "**";
        
        // Add appropriate spacing for alignment
        line += " - expires <t:" + futureTimestamp + ":R> - <t:" + futureTimestamp + ":f>";

        // If days remaining is less than 7, make the line bold and underlined
        if (daysremain < 7) {
          line = "__" + line + "__";
        }

        // Check for msg length over 2000; if yes, send it and start new msg
        if ((message.length + line.length) > 2000) {
          sendToDiscord(message, discordWebhookUrl);
          message = "";
        }

        // Add the line to the message with a newline
        message += line + "\n";
      }
    }
    
    // Send the message to Discord if it's not empty
    if (message.length > 0) {
      sendToDiscord(message, discordWebhookUrl);
    }
  }
  
  // This function sends a message to Discord using a webhook
  function sendToDiscord(message, webhookUrl) {
      // Prepare the payload to be sent to Discord
      var payload = {
        // The HTTP method to be used for the request
        method: "POST",
        
        // The content type of the request
        contentType: "application/json",
        
        // The body of the request. It's a JSON string that contains the message to be sent to Discord
        payload: JSON.stringify({ content: message }),
      };
    
      // Send the HTTP request to the Discord webhook URL
      UrlFetchApp.fetch(webhookUrl, payload);
  }
  
  // This function sets up the sheets for a new user
  function setupSheetsForNewUser() {
    // Get the active Google Sheets document
    var ss = SpreadsheetApp.getActiveSpreadsheet();
  
    // Store the ID of the active spreadsheet
    PropertiesService.getScriptProperties().setProperty('spreadsheetId', ss.getId());
  
    // Check if the "Pull" sheet exists, if not, create it
    var pullSheet = ss.getSheetByName("Pull");
    if (!pullSheet) {
      pullSheet = ss.insertSheet("Pull");
    }
  
    // Check if the "ESI_List" sheet exists, if not, create it
    var esiListSheet = ss.getSheetByName("ESI_List");
    if (!esiListSheet) {
      esiListSheet = ss.insertSheet("ESI_List");
      // Set headers for the "ESI_List" sheet
      esiListSheet.getRange("A1").setValue("Names");
      esiListSheet.getRange("G1").setValue("discordWebHook");
    }
  
    // Check if the "CleanData" sheet exists, if not, create it
    var cleanDataSheet = ss.getSheetByName("CleanData");
    if (!cleanDataSheet) {
      cleanDataSheet = ss.insertSheet("CleanData");
      // Set formulas for the "CleanData" sheet
      cleanDataSheet.getRange("C1").setFormula('=IFERROR(SPLIT(CleanData!$D$1, "Z"))');
      cleanDataSheet.getRange("A2").setFormula('=UNIQUE(Pull!C:C)');
      cleanDataSheet.getRange("B3").setValue('Days Remaining');
      for (var i = 4; i <= 104; i++) {
        cleanDataSheet.getRange("B" + i).setFormula('=IF(C' + i + '="","",TEXT(INT((C' + i + '-$C$1)), "0") & " days " & TEXT(MOD((C' + i + '-$C$1), 1), "h") & " hours")');
        cleanDataSheet.getRange("C" + i).setFormula('=IFERROR(IF(A' + i + '="","", LEFT(XLOOKUP($A' + i + ',Pull!$C:$C,Pull!B:B),LEN(XLOOKUP($A' + i + ',Pull!$C:$C,Pull!B:B))-1)-0))');
        cleanDataSheet.getRange("D" + i).setFormula('=IFERROR(XLOOKUP($A' + i + ',Pull!$C:$C,Pull!I:I))');
      }
      // Format column C as Date Time
      cleanDataSheet.getRange("C1:C104").setNumberFormat('yyyy-mm-dd hh:mm:ss');
    }
  
   // Check if the "Instructions" sheet exists, if not, create it
   var instructionsSheet = ss.getSheetByName("Instructions");
   if (!instructionsSheet) {
     instructionsSheet = ss.insertSheet("Instructions");
     // Write the instructions to the "Instructions" sheet
     instructionsSheet.getRange("A1").setValue("Instructions for setting up the script:");
     instructionsSheet.getRange("A2").setValue("1. Enter the EVE character names in column A of the 'ESI_List' sheet, starting from cell A2.");
     instructionsSheet.getRange("A3").setValue("2. Enter the Discord webhook URL in cell G2 of the 'ESI_List' sheet.");
     instructionsSheet.getRange("A4").setValue("3. Make sure GESI is setup from https://blacksmoke16.github.io/GESI/");
     instructionsSheet.getRange("A5").setValue("4. Open the App Script editor by clicking on 'Extensions' > 'Apps Script'.");
     instructionsSheet.getRange("A6").setValue("5. Click on the clock icon, which represents 'Triggers' in the left sidebar.");
     instructionsSheet.getRange("A7").setValue("6. Click on '+ Add Trigger' in the lower right corner.");
     instructionsSheet.getRange("A8").setValue("7. Choose the 'getUtcTimestampToS2' function.");
     instructionsSheet.getRange("A9").setValue("8. Choose the deployment from the dropdown.");
     instructionsSheet.getRange("A10").setValue("9. Under 'Select event source', choose 'Time-driven'.");
     instructionsSheet.getRange("A11").setValue("10. Configure the frequency of the trigger to 'Every 6 hours'.");
     instructionsSheet.getRange("A12").setValue("11. Click 'Save'.");
     instructionsSheet.getRange("A13").setValue("12. Repeat steps 6-11 for the 'updateStationFuel' function, but set the frequency to 'Day timer' set time of day.");
     instructionsSheet.getRange("A14").setValue("13. Repeat steps 6-11 for the 'reportStatusToDiscord' function, but set the frequency to 'Day Timer' and an hour later then updateStationFuel.");
   }
 
   // Display a dependency prompt
   var ui = SpreadsheetApp.getUi();
   ui.alert('Please setup GESI from https://blacksmoke16.github.io/GESI/');
 }
