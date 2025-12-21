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
var ss = SpreadsheetApp.getActiveSpreadsheet()

// This function is triggered when the Google Sheets document is opened
function onOpen() {
    var ui = SpreadsheetApp.getUi();
  
    // Create a custom menu in the spreadsheet named 'Fuel stuff'
    ui.createMenu('Fuel Bot')
      // Add an item to the custom menu. When this item is clicked, it will trigger the 'updateStationFuel' function
      .addItem('Update Fuel Status', 'updateFuelStatus')
      // Add an item to the custom menu. When this item is clicked, it will trigger the 'reportStatusToDiscord' function
      .addItem('Report Fuel Status to Discord', 'reportFuelStatusToDiscord')
      // Add an item for chunked reporting (for large structure lists)
      .addItem('Report Fuel Status to Discord (Chunked)', 'reportFuelStatusToDiscordChunked')
      // Add an item to clear cell D1 on the "CleanData" sheet
      .addItem('Clear Time', 'clearCellS2')
      // Add an item to get the UTC timestamp and output it to cell D1 on the "CleanData" sheet
      .addItem('Get Time', 'getUtcTimestampToS2')
      .addToUi();

    // Create a custom menu for Moon Extraction
    ui.createMenu('Moon Bot')
      .addItem('Update Moon Extractions', 'updateMoonExtractions')
      .addItem('Report Moon Status to Discord', 'reportDailyMoonSummary')
      .addToUi();
  
    // Create a separate menu for the setup function
    ui.createMenu('Setup')
      // Add an item to get Setup the sheet for a new user
      .addItem('Create Fuel and Moon Sheets', 'setupSheetsForNewUser')
      .addItem('Configure Settings', 'jumpToSettings')
      .addItem('Help', 'jumpToInstructions')
      
      // Add the setup menu to the user interface
      .addToUi();
  }

  function jumpToInstructions() {
    var _instructions = ss.getSheetByName("Instructions");
    ss.setActiveSheet(_instructions);
  }

  function jumpToSettings() {
    var _settings = ss.getSheetByName("Settings");
    ss.setActiveSheet(_settings);
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

  function check_GESI() {
    try{
      var authCharacters = GESI.getAuthenticatedCharacterNames();
    } catch(err) {
      ui.alert("Error" + err + "did your forget to set up GESI?");
      return false;
    }
    try {
    var num_chars = authCharacters.length;
    Logger.log("Found " + num_chars + "character(s): " + authCharacters);
    } catch {
      Logger.log("No authenticated characters found.");
      ui.alert("No authenticated characters found. Go to Extensions -> GESI -> Authorize Character to fix.");
      return false;
    }

    if (num_chars>0) {
      Logger.log(authCharacters);
      Logger.log("authCharacters: " + authCharacters.length);
      return true;

    } else {
      return false;
    }
  }

  function GetCharInfo() {
    //Gets info about the main character listed at Settings cell A2 and returns a dictionary of information.

    // Get the stored ID of the spreadsheet
    
    var spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
    // Get the spreadsheet by its ID
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var settingsSheet = ss.getSheetByName("Settings");
    var mainchar = settingsSheet.getRange("A2").getValue();
    Logger.log("Main Char Set from Settings sheet as " + mainchar);

    if (mainchar == "") {
      Logger.log("Main Char missing from settings sheet. Trying to set from ESI_List instead")
      var ESI_List = ss.getSheetByName("ESI_List");
      var altMainChar =ESI_List.getRange("A2").getValue();
      if (altMainChar != "") {
        mainchar = altMainChar
      
      ui.alert("Using alternate settings from ESI_list: " + mainchar + "Please set mainchar in Settings Sheet")
      } else if (altMainChar == "") {
          ui.alert("Missing main character information. Please go to Settings Sheet to set it.")
          return
        }
      
    }
    try {
        var charinfo = GESI.getCharacterData(mainchar);
        Logger.log("data: %s",charinfo)
    } catch (err) {
      Logger.log("error: " + err)
    }

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
  
// This function updates the structures's fuel.
function updateFuelStatus() {

    //clear and reset the timestamp
    clearCellS2()
    getUtcTimestampToS2()

    // Get the stored ID of the spreadsheet
    var spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
    // Get the spreadsheet by its ID
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var settingsSheet = spreadsheet.getSheetByName("Settings");
    var fuelPullSheet = spreadsheet.getSheetByName("FuelPull");

    // If the 'FuelPull' sheet does not exist, create it.
    if (!fuelPullSheet) {
      fuelPullSheet = spreadsheet.insertSheet("FuelPull");
    }

    // Clear the 'FuelPull' sheet.
    fuelPullSheet.clear();

    // Get the names from the 'Settings' sheet.
    var names = settingsSheet.getRange("A2:A").getValues();
  
    // Initialize the row counter for the 'FuelPull' sheet.
    var fuelPullSheetRow = 3;
  
    // Loop through the names.
    for (var i = 0; i < names.length; i++) {
      if (names[i][0] !== "") {
        // Call the 'corporations_corporation_structures' function with the current name.
        var result = GESI.corporations_corporation_structures("en", names[i][0]);

        // If the 'result' array is not empty, populate the 'FuelPull' sheet with the data.

        if (Array.isArray(result) && result.length > 0) {
          fuelPullSheet.getRange(fuelPullSheetRow, 1, result.length, result[0].length).setValues(result);
          fuelPullSheetRow += result.length + 5;  // Skip 5 rows after each output.
        }

        // Wait for 5 seconds before moving to the next name.
        Utilities.sleep(5000);
      }
    }
}


  function sortFunction(a, b) {
      if (a[0] === b[0]) {
          return 0;
      }
      else {
          return (a[0] < b[0]) ? -1 : 1;
      }
  }
  function verify_pulldata(spreadsheet) {
    var rawPull = spreadsheet.getSheetByName("FuelPull").getDataRange().getValues();
    if (rawPull[1] == null) {
      Logger.log("pull data missing, updating now.")
      return false
    }
    Logger.log("pulldata found")
    Logger.log(rawPull[1])
    return true
  }
  // This function reports the status to Discord
  function reportFuelStatusToDiscord() {
    //clear and reset the timestamp
    getUtcTimestampToS2()
    
    // Get the stored ID of the spreadsheet
    var spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
    // Get the spreadsheet by its ID
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      
    // Get the Discord webhook URL from cell G2 of the "Settings" sheet
    var discordWebhookUrl = spreadsheet.getSheetByName("Settings").getRange("G2").getValue();
    
    if (!verify_pulldata(spreadsheet)) {
      updateFuelStatus()
    }
    
    // Get the sheet named "CleanData" from the active spreadsheet
    var sheet = spreadsheet.getSheetByName("CleanData");

    // Get all the data from the "CleanData" sheet
    var data = sheet.getDataRange().getValues();
    var timeupdate = data[0][4];
    Logger.log(data)  

    // set name and logo for the Discord Bot. Either corp name/logo (default) or custon name/logo (optional)
    var settingsSheet = spreadsheet.getSheetByName("Settings");
    var customName = settingsSheet.getRange('G5').getValue();
    var customURL = settingsSheet.getRange('G8').getValue();

    // Use customn name if configured or <CorpName> Fuel Bot if not
    if (customName) {
      var botName = customName;
    } else {
      var corpName = getCorpName();
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
    //If its healthy just note the days
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

  /**
   * Splits an array of structures into chunks that fit within Discord's embed description limit.
   * @param {Array} structures - Array of structure objects
   * @param {number} maxChars - Maximum characters per chunk (default 3500, safe margin under 4096)
   * @param {Function} formatFn - Function to format each structure entry into a string
   * @returns {Array} Array of description strings, each under maxChars
   */
  function chunkStructures(structures, maxChars, formatFn) {
    var chunks = [];
    var currentChunk = "";

    for (var i = 0; i < structures.length; i++) {
      var entry = formatFn(structures[i]);

      // If adding this entry would exceed the limit, save current chunk and start new one
      if (currentChunk.length + entry.length > maxChars && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      currentChunk += entry;
    }

    // Don't forget the last chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Sends multiple Discord messages sequentially with delays to avoid rate limiting.
   * @param {Array} messages - Array of embed arrays, each will be sent as a separate message
   * @param {string} webhookUrl - Discord webhook URL
   */
  function sendToDiscordChunked(messages, webhookUrl) {
    for (var i = 0; i < messages.length; i++) {
      sendToDiscord(messages[i], webhookUrl);

      // Wait 1 second between messages to respect Discord rate limits
      if (i < messages.length - 1) {
        Utilities.sleep(1000);
      }
    }
  }

  /**
   * Reports fuel status to Discord with chunking support for large structure lists.
   * This function always splits messages into smaller chunks to avoid Discord's size limits.
   * Use this function instead of reportFuelStatusToDiscord when you have 50+ structures.
   */
  function reportFuelStatusToDiscordChunked() {
    // Maximum characters per embed description (safe margin under Discord's 4096 limit)
    var MAX_DESCRIPTION_LENGTH = 3000;

    // Update timestamp
    getUtcTimestampToS2();

    // Get the stored ID of the spreadsheet
    var spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);

    var settingsSheet = spreadsheet.getSheetByName("Settings");

    // Get the Discord webhook URL from cell G2 of the "Settings" sheet
    var discordWebhookUrl = settingsSheet.getRange("G2").getValue();

    if (!verify_pulldata(spreadsheet)) {
      updateFuelStatus();
    }

    // Get data from CleanData sheet
    var sheet = spreadsheet.getSheetByName("CleanData");
    var data = sheet.getDataRange().getValues();

    // Get bot name and logo settings
    var customName = settingsSheet.getRange('G5').getValue();
    var customURL = settingsSheet.getRange('G8').getValue();

    var botName = customName ? customName : getCorpName() + " Fuel Bot";
    var logoUrl = customURL ? customURL : getCorpLogoUrl();

    // Slice the array from index 3:end and sort A-Z
    var dataStnsOnly = data.slice(3).sort(sortFunction);

    // Create arrays for different urgency levels
    var criticalStructures = [];
    var warningStructures = [];
    var healthyStructures = [];

    // Sort structures by fuel status
    for (var i = 0; i < dataStnsOnly.length; i++) {
      var stationName = dataStnsOnly[i][0];

      if (!stationName) continue;

      var daysHours = dataStnsOnly[i][1].split(' ');
      var daysremain = parseInt(daysHours[0]);
      var hoursremain = parseInt(daysHours[2]);

      var futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysremain);
      futureDate.setHours(futureDate.getHours() + hoursremain);
      var futureTimestamp = Math.floor(futureDate.getTime() / 1000);

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

    // Format functions for each category
    var formatCriticalWarning = function(structure) {
      return "**" + structure.name + "** -- " + structure.days + " days " + structure.hours + " hours remaining\n";
    };

    var formatHealthy = function(structure) {
      return "**" + structure.name + "** -- " + structure.days + " days\n";
    };

    // Build messages array - each element is an array of embeds to send as one message
    var messages = [];

    // First message: Header embed
    var headerEmbed = {
      title: "Fuel Status Update",
      description: "",
      color: 3447003,
      timestamp: new Date().toISOString(),
      author: {
        name: botName,
        icon_url: logoUrl
      },
      footer: {
        text: "EVE Online Structure Tracker"
      }
    };
    messages.push([headerEmbed]);

    // Process critical structures
    if (criticalStructures.length > 0) {
      var criticalChunks = chunkStructures(criticalStructures, MAX_DESCRIPTION_LENGTH, formatCriticalWarning);

      for (var c = 0; c < criticalChunks.length; c++) {
        var title = "🔴 CRITICAL - Immediate Action Required";
        if (criticalChunks.length > 1) {
          title += " (" + (c + 1) + "/" + criticalChunks.length + ")";
        }

        messages.push([{
          title: title,
          description: criticalChunks[c],
          color: 15158332
        }]);
      }
    }

    // Process warning structures
    if (warningStructures.length > 0) {
      var warningChunks = chunkStructures(warningStructures, MAX_DESCRIPTION_LENGTH, formatCriticalWarning);

      for (var w = 0; w < warningChunks.length; w++) {
        var title = "🟠 WARNING - Action Needed Soon";
        if (warningChunks.length > 1) {
          title += " (" + (w + 1) + "/" + warningChunks.length + ")";
        }

        messages.push([{
          title: title,
          description: warningChunks[w],
          color: 16763904
        }]);
      }
    }

    // Process healthy structures
    if (healthyStructures.length > 0) {
      var healthyChunks = chunkStructures(healthyStructures, MAX_DESCRIPTION_LENGTH, formatHealthy);

      for (var h = 0; h < healthyChunks.length; h++) {
        var title = "🟢 HEALTHY - No Immediate Action Required";
        if (healthyChunks.length > 1) {
          title += " (" + (h + 1) + "/" + healthyChunks.length + ")";
        }

        messages.push([{
          title: title,
          description: healthyChunks[h],
          color: 3066993
        }]);
      }
    }

    // Send all messages with delays between them
    sendToDiscordChunked(messages, discordWebhookUrl);
  }

  // This function sets up the sheets for a new user
  function setupSheetsForNewUser() {
    // Get the active Google Sheets document
    var ss = SpreadsheetApp.getActiveSpreadsheet();
  
    // Store the ID of the active spreadsheet
    PropertiesService.getScriptProperties().setProperty('spreadsheetId', ss.getId());
  
    // Check if the "FuelPull" sheet exists, if not, create it
    var fuelPullSheet = ss.getSheetByName("FuelPull");
    if (!fuelPullSheet) {
      fuelPullSheet = ss.insertSheet("FuelPull");
    }

    var moonPullSheet = ss.getSheetByName("MoonPull");
    if (!moonPullSheet) {
    moonPullSheet = ss.insertSheet("MoonPull");
    moonPullSheet.getRange("A1:F1").setValues([["Structure Name", "Moon Name", "Extraction Start", "Chunk Arrival", "Natural Decay", "Structure ID"]]);
    moonPullSheet.getRange("A1:F1").setFontWeight("bold");
  }

    // Check if the "CleanData" sheet exists, if not, create it
    var cleanDataSheet = ss.getSheetByName("CleanData");
    if (!cleanDataSheet) {
      cleanDataSheet = ss.insertSheet("CleanData");
      // Set formulas for the "CleanData" sheet
      cleanDataSheet.getRange("C1").setFormula('=IFERROR(SPLIT(CleanData!$D$1, "Z"),now())');
      cleanDataSheet.getRange("A2").setFormula('=UNIQUE(FuelPull!C:C)');
      cleanDataSheet.getRange("B3").setValue('Days Remaining');
      for (var i = 4; i <= 104; i++) {
        cleanDataSheet.getRange("B" + i).setFormula('=IF(C' + i + '="","",TEXT(INT((C' + i + '-$C$1)), "0") & " days " & TEXT(MOD((C' + i + '-$C$1), 1), "h") & " hours")');
        cleanDataSheet.getRange("C" + i).setFormula('=IFERROR(IF(A' + i + '="","", LEFT(XLOOKUP($A' + i + ',FuelPull!$C:$C,FuelPull!B:B),LEN(XLOOKUP($A' + i + ',FuelPull!$C:$C,FuelPull!B:B))-1)-0),"")');
        cleanDataSheet.getRange("D" + i).setFormula('=IFERROR(XLOOKUP($A' + i + ',FuelPull!$C:$C,FuelPull!I:I,""),"")');
      }
      // Format column C as Date Time
      cleanDataSheet.getRange("C1:C104").setNumberFormat('yyyy-mm-dd hh:mm:ss');
    }
  
   // Check if the "Instructions" sheet exists, if not, create it
   var instructionsSheet = ss.getSheetByName("Instructions");
   
   if (!instructionsSheet) {
     instructionsSheet = ss.insertSheet("Instructions");
     var heading_style = SpreadsheetApp.newTextStyle().setFontSize(18).setBold(true).build();
     // Write the instructions to the "Instructions" sheet

     instructionsSheet.getRange("A1").setValue("Instructions for setting up the script:").setTextStyle(heading_style)
     instructionsSheet.getRange("A3").setValue("1. Enter the EVE character name in cell A2 of the 'Settings' sheet.");
     instructionsSheet.getRange("A4").setValue("2. Enter the Discord webhook URL in cell G2 of the 'Settings' sheet.");
     instructionsSheet.getRange("A5").setValue("3. Make sure GESI is setup from https://blacksmoke16.github.io/GESI/");
     instructionsSheet.getRange("A6").setValue("4. Open the App Script editor by clicking on 'Extensions' > 'Apps Script'.");
     instructionsSheet.getRange("A7").setValue("5. Click on the clock icon, which represents 'Triggers' in the left sidebar.");
     instructionsSheet.getRange("A8").setValue("6. Click on '+ Add Trigger' in the lower right corner.");
     instructionsSheet.getRange("A9").setValue("7. Choose the 'getUtcTimestampToS2' function.");
     instructionsSheet.getRange("A10").setValue("8. Choose the deployment from the dropdown.");
     instructionsSheet.getRange("A11").setValue("9. Under 'Select event source', choose 'Time-driven'.");
     instructionsSheet.getRange("A12").setValue("10. Configure the frequency of the trigger to 'Every 6 hours'.");
     instructionsSheet.getRange("A13").setValue("11. Click 'Save'.");
     instructionsSheet.getRange("A14").setValue("12. Repeat steps 6-11 for the 'updateFuelStatus' and 'updateMoonExtractions' function, but set the frequency to 'Day timer' set time of day.");
     instructionsSheet.getRange("A15").setValue("13. Repeat steps 6-11 for the 'report(Moon/Fuel)StatusToDiscord' functions, but set the frequency to 'Day Timer' set later than the update functions in step 12 to make sure that the data has been refreshed before sending to Discord.");
     instructionsSheet.getRange("A16").setValue("14. Repeat steps 6-11 for the 'reportHourlyMoonStatusToDiscord' function, set the frequency to 'Hourly.' Configure the frequency of the trigger to 'Every 1 hour'");
     

     instructionsSheet.getRange("A20").setValue("NOTE: If you see a GESI undefined error, you probably need to enable the GESI Script library in Extensions->AppScripts->Libraries mentioned in Step 3.");
     instructionsSheet.getRange("A21").setValue("NOTE: Some locales use different syntax, which will cause formulas to work incorrectly. If you encounter errors, try changing your locale to US.")
     instructionsSheet.getRange("A22").setValue("When you first run this, Google will warn you that this app has not been approved by Google -- which is true. You will need to go to 'Advanced' to enable it.");
     instructionsSheet.getRange("A23").setValue("You can set custom values for the name and logo of your app in Settings. (optional)")
     instructionsSheet.getRange("A25").setValue("For more detailed instructions go to https://github.com/OrthelT/optm_fuel/blob/main/README.md")
   
   }



    // Check if the "Settings" sheet exists, if not, create it
    var settingsSheet = ss.getSheetByName("Settings");
    if (!settingsSheet) {
      settingsSheet = ss.insertSheet("Settings");
      // Set headers for the "Settings" sheet
      settingsSheet.getRange("A1").setValue("Name(s)");
      settingsSheet.getRange("G1").setValue("discordWebHook");
      settingsSheet.getRange("F2").setValue("Fuel Webhook");
      settingsSheet.getRange("F3").setValue("Moon Webhook")
      settingsSheet.getRange("G4").setValue("Custom Bot Name (optional)");
      settingsSheet.getRange("H5").setValue('<-- Give your bot a custom name here or leave blank to use "<Corp Name> Fuel Bot"');
      settingsSheet.getRange("G7").setValue("Logo URL (optional)");
      settingsSheet.getRange("H8").setValue("<-- Enter a URL for a logo to use with your Fuel Bot. Default is Corp Logo for character in A2")
      settingsSheet.getRange("F10").setValue("Enable Chunking");
      settingsSheet.getRange("H10").setValue("<-- Set to 'Yes' to split large reports into multiple messages (for 50+ structures)")

      // Define a range of cells where values should be entered so we can format them differently
      var valueCells = settingsSheet.getRangeList(['A2','G2','G3','G5','G8','G10'])
      valueCells.setBackground('yellow')
    }
    //setup moon sheets (code is in moon_tracker.gs)
    var ui = SpreadsheetApp.getUi();

    try {
    moonScript = checkMoonTrackerScriptExits();
    } catch (err) {
      ui.alert('Moon sheets not set up. Did you forget to copy moon-tracker.gs to AppScripts?');
    }
    //prompt user for incomplete setup and next steps to configure
    if (moonScript === true) {
      var status_msg = "Setup complete. Please go to the setting sheet to configure the app. If you have not already done so, please setup GESI from https://blacksmoke16.github.io/GESI/'"
    } else {
      var status_msg = "Setup incomplete. Moon sheets were not created. Copy moon-tracker.gs into AppScrips and run setup again. Then go to the setting sheet to configure the app. If you have not already done so, please setup GESI from https://blacksmoke16.github.io/GESI/'."
    }

   ui.alert(status_msg);

    // 👉 Jump user to Settings sheet
    ss.setActiveSheet(settingsSheet); 
 }
