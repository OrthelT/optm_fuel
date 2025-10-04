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

  function getCorpName() {
    //Gets the name of the corp associated with the main character listed at Settings cell A2.
    var charinfo = GetCharInfo();
    var corpID = charinfo.corporation_id
    var corpName = GESI.corporations_corporation(corpID)[1][8]
    return corpName
  }

  function getCorpLogoUrl() {
    // Returns the Eve image server URL of the corp logo for the main character listed at Settings cell A2
    var charinfo = GetCharInfo();
    var logoUrl = "https://images.evetech.net/corporations/"+charinfo.corporation_id+"/logo?size=64";

    return logoUrl
  }

  function GetCharInfo() {
    //Gets info about the main character listed at Settings cell A2 and returns a dictionary of information.

    // Get the stored ID of the spreadsheet
    var spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
    // Get the spreadsheet by its ID
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var settingsSheet = ss.getSheetByName("Settings");
    var mainchar = settingsSheet.getRange("A2").getValue();
    var charinfo = GESI.getCharacterData(mainchar);
    Logger.log("data: %s",charinfo)

    return charinfo
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

    //clear and reset the timestamp
    clearCellS2()
    getUtcTimestampToS2()

    // Get the stored ID of the spreadsheet
    var spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
    // Get the spreadsheet by its ID
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var settingsSheet = spreadsheet.getSheetByName("Settings");
    var pullSheet = spreadsheet.getSheetByName("Pull");

    // If the 'Pull' sheet does not exist, create it.
    if (!pullSheet) {
      pullSheet = spreadsheet.insertSheet("Pull");
    }

    // Clear the 'Pull' sheet.
    pullSheet.clear();

    // Get the names from the 'Settings' sheet.
    var names = settingsSheet.getRange("A2:A").getValues();
  
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
    //clear and reset the timestamp
    getUtcTimestampToS2()
    
    // Get the stored ID of the spreadsheet
    var spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
    // Get the spreadsheet by its ID
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      
    // Get the Discord webhook URL from cell G2 of the "Settings" sheet
    var discordWebhookUrl = spreadsheet.getSheetByName("Settings").getRange("G2").getValue();

    // Get the sheet named "CleanData" from the active spreadsheet
    var sheet = spreadsheet.getSheetByName("CleanData");

    // Get all the data from the "CleanData" sheet
    var data = sheet.getDataRange().getValues();
    var timeupdate = data[0][4];

    // set name and logo for the Discord Bot. Either corp name/logo (default) or custon name/logo (optional)
    var settingsSheet = spreadsheet.getSheetByName("Settings");
    var customName = settingsSheet.getRange('G5').getValue();
    var customURL = settingsSheet.getRange('G8').getValue();

    // Use customn name if configured or <CorpName> Fuel Bot if not
    if (customName) {
      var botName = customName;
    } else {
      corpID = GetCharInfo().corporation_id;
      corpName = getCorpName();
      var botName = corpName + " Fuel Bot";
    }
    
    // Use corp logo or custom logo if configured
    if (customURL) {
      var logoUrl = customURL;
    } else {
      logoUrl = getCorpLogoUrl()
    }

    //Slice the array from index 3:end and then sort it A-Z
    var dataStnsOnly = data.slice(3).sort(sortFunction);

    // Create arrays for different urgency levels
    var criticalStructures = [];
    var warningStructures = [];
    var healthyStructures = [];

    // Sort structures by fuel status
    for (var i = 0; i < dataStnsOnly.length; i++) {
      // Get the station name from the current row
      var stationName = dataStnsOnly[i][0];
      
      if (!stationName) continue;
      
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
      
      // Add structure to appropriate array based on remaining fuel
      var structureInfo = {
        name: stationName,
        days: daysremain,
        hours: hoursremain,
        timestamp: futureTimestamp,
        state: dataStnsOnly[i][3]
      };
      
      if (daysremain < 3) {
        criticalStructures.push(structureInfo);
      } else if (daysremain < 7) {
        warningStructures.push(structureInfo);
      } else {
        healthyStructures.push(structureInfo);
      }
    }
    
    // Create embeds for each category
    var embeds = [];
    
    // Add a main embed with summary information and OPTM logo
    embeds.push({
      title: "Fuel Status Update",
      description: "",
      color: 3447003, // Blue color
      timestamp: new Date().toISOString(),
      author: {
        name: botName,
        icon_url: logoUrl
      },
      footer: {
        text: "EVE Online Structure Tracker"
      }
    });
    
    // Add critical structures embed if any exist
    if (criticalStructures.length > 0) {
      var criticalEmbed = {
        title: "🔴 CRITICAL - Immediate Action Required",
        description: "",
        color: 15158332 // Red color
      };
      
      criticalStructures.forEach(function(structure) {
        criticalEmbed.description += `**${structure.name}** -- ${structure.days} days ${structure.hours} hours remaining\n` //+
                                    // `Expires: <t:${structure.timestamp}:R> (<t:${structure.timestamp}:f>)\n\n`;
      });
      
      embeds.push(criticalEmbed);
    }
    
    // Add warning structures embed if any exist
    if (warningStructures.length > 0) {
      var warningEmbed = {
        title: "🟠 WARNING - Action Needed Soon",
        description: "",
        color: 16763904 // Orange color
      };
      
      warningStructures.forEach(function(structure) {
        warningEmbed.description += `**${structure.name}** -- ${structure.days} days ${structure.hours} hours remaining\n` //+
                                  //  `Expires: <t:${structure.timestamp}:R> (<t:${structure.timestamp}:f>)\n\n`;
      });
      
      embeds.push(warningEmbed);
    }
    
    // Add healthy structures embed
    //If its helthy just note the days
    if (healthyStructures.length > 0) {
      var healthyEmbed = {
        title: "🟢 HEALTHY - No Immediate Action Required",
        description: "",
        color: 3066993 // Green color
      };
      
      healthyStructures.forEach(function(structure) {
        healthyEmbed.description += `**${structure.name}** -- ${structure.days} days\n` // ${structure.hours} hours remaining\n` +
                                  //  `Expires: <t:${structure.timestamp}:R> (<t:${structure.timestamp}:f>)\n\n`;
      });
      
      embeds.push(healthyEmbed);
    }
    
    // Send embeds to Discord
    sendToDiscord(embeds, discordWebhookUrl);
  }
  
  // This function sends a message to Discord using a webhook
  function sendToDiscord(embeds, webhookUrl) {
    // Prepare the payload to be sent to Discord
    var payload = {
      method: "POST",
      contentType: "application/json",
      payload: JSON.stringify({ embeds: embeds }),
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
  
    // Check if the "Settings" sheet exists, if not, create it
    var settingsSheet = ss.getSheetByName("Settings");
    if (!settingsSheet) {
      settingsSheet = ss.insertSheet("Settings");
      // Set headers for the "Settings" sheet
      settingsSheet.getRange("A1").setValue("Name(s)");
      settingsSheet.getRange("G1").setValue("discordWebHook");
      settingsSheet.getRange("G4").setValue("Custom Bot Name (optional)");
      settingsSheet.getRange("H5").setValue('<-- Give your bot a custom name here or leave blank to use "<Corp Name> Fuel Bot"');
      settingsSheet.getRange("G7").setValue("Logo URL (optional)");
      settingsSheet.getRange("H8").setValue("<-- Enter a URL for a logo to use with your Fuel Bot. Default is Corp Logo for character in A2")

      // Define a range of cells where values should be entered so we can format them differently
      var valueCells = settingsSheet.getRangeList(['A2','G2','G5','G8'])
      valueCells.setBackground('yellow')
    }
  
    // Check if the "CleanData" sheet exists, if not, create it
    var cleanDataSheet = ss.getSheetByName("CleanData");
    if (!cleanDataSheet) {
      cleanDataSheet = ss.insertSheet("CleanData");
      // Set formulas for the "CleanData" sheet
      cleanDataSheet.getRange("C1").setFormula('=IFERROR(SPLIT(CleanData!$D$1, "Z"),now())');
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
     instructionsSheet.getRange("A2").setValue("1. Enter the EVE character name in cell A2 of the 'Settings' sheet.");
     instructionsSheet.getRange("A3").setValue("2. Enter the Discord webhook URL in cell G2 of the 'Settings' sheet.");
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
     instructionsSheet.getRange("A16").setValue("NOTE: If you see a GESI undefined error, you probably need to enable the GESI Script library in Extensions->AppScripts->Libraries mentioned in Step 3.");
     instructionsSheet.getRange("A18").setValue("When you first run this, Google will warn you that this app has not been approved by Google -- which is true. You will need to go to 'Advanced' to enable it.");
     instructionsSheet.getRange("A20").setValue("You can set custom values for the name and logo of your app in Settings. (optional)")
   }
 
   // Display a dependency prompt
   var ui = SpreadsheetApp.getUi();
   ui.alert('Please setup GESI from https://blacksmoke16.github.io/GESI/');
 }
