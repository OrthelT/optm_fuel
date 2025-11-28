/**
 * Moon Extraction Monitor
 * 
 * This script monitors moon extractions and sends Discord notifications.
 * It operates independently from the main fuel tracker but shares the GESI configuration.
 */

// Menu hook is in fuel-tracker.gs

/**
 * Sets up the necessary sheets for the Moon Extraction Monitor.
 */
function setupMoonSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Setup MoonPull sheet
  var moonPullSheet = ss.getSheetByName("MoonPull");
  if (!moonPullSheet) {
    moonPullSheet = ss.insertSheet("MoonPull");
    moonPullSheet.getRange("A1:F1").setValues([["Structure Name", "Moon Name", "Extraction Start", "Chunk Arrival", "Natural Decay", "Structure ID"]]);
    moonPullSheet.getRange("A1:F1").setFontWeight("bold");
  }

  // 2. Setup Settings for Moon Webhook
  var settingsSheet = ss.getSheetByName("Settings");
  if (!settingsSheet) {
    // Should exist if fuel tracker is set up, but just in case
    settingsSheet = ss.insertSheet("Settings");
  }
  
  // Check if G3 is already set (Moon Webhook)
  var moonWebhookLabel = settingsSheet.getRange("G3");
  if (moonWebhookLabel.getValue() === "") {

    settingsSheet.getRange("F3").setValue("Moon Webhook:");
    settingsSheet.getRange("G3").setValue("https://discord.com/api/webhooks/1443330282903306261/VOWsG9E7y-0qxjP7pKl8_63K6d78kKS8Jm7IRmuS-ttrjfkJtAYWReSVZfRy2AM-bWXt");
    settingsSheet.getRange("G3").setBackground("yellow");
  }
  
  SpreadsheetApp.getUi().alert('Moon Sheets Setup Complete. Please verify the Moon Webhook in Settings!G3.');
}

/**
 * Fetches moon extractions and updates the MoonPull sheet.
 */
function updateMoonExtractions() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var moonPullSheet = ss.getSheetByName("MoonPull");
  if (!moonPullSheet) {
    setupMoonSheets();
    moonPullSheet = ss.getSheetByName("MoonPull");
  }

  // Clear old data (keep headers)
  if (moonPullSheet.getLastRow() > 1) {
    moonPullSheet.getRange(2, 1, moonPullSheet.getLastRow() - 1, moonPullSheet.getLastColumn()).clearContent();
  }

  // Get character name from Settings sheet for GESI authentication
  var settingsSheet = ss.getSheetByName("Settings");
  var characterName = settingsSheet.getRange("A2").getValue();

  if (!characterName) {
    Logger.log("No character name found in Settings A2");
    return;
  }

  try {
    // Pass language and character name for authentication
    var extractions = GESI.corporations_corporation_mining_extractions("en", characterName);
  } catch (e) {
    Logger.log("Error fetching extractions: " + e);
    return;
  }

  if (!extractions || extractions.length <= 1) {
    Logger.log("No extractions found.");
    return;
  }

  // GESI returns a 2D array where row 0 contains column headers
  // Find column indices from headers
  var headers = extractions[0];
  var colStructureId = headers.indexOf("structure_id");
  var colMoonId = headers.indexOf("moon_id");
  var colExtractionStart = headers.indexOf("extraction_start_time");
  var colChunkArrival = headers.indexOf("chunk_arrival_time");
  var colNaturalDecay = headers.indexOf("natural_decay_time");

  var outputData = [];

  // Cache for structure and moon names to avoid repeated API calls
  var structureCache = {};
  var moonCache = {};

  // Start from row 1 to skip headers
  for (var i = 1; i < extractions.length; i++) {
    var ex = extractions[i];

    var structureId = ex[colStructureId];
    var moonId = ex[colMoonId];

    var structureName = structureCache[structureId];
    if (!structureName) {
      structureName = getStructureName(structureId, characterName);
      structureCache[structureId] = structureName;
    }

    var moonName = moonCache[moonId];
    if (!moonName) {
      moonName = getMoonName(moonId);
      moonCache[moonId] = moonName;
    }

    outputData.push([
      structureName,
      moonName,
      ex[colExtractionStart],
      ex[colChunkArrival],
      ex[colNaturalDecay],
      structureId
    ]);

    // Avoid rate limits
    Utilities.sleep(100);
  }
  
  if (outputData.length > 0) {
    moonPullSheet.getRange(2, 1, outputData.length, outputData[0].length).setValues(outputData);
  }
}

function getStructureName(structureId, characterName) {
  try {
    // Get structure info - requires authentication for player-owned structures
    // GESI returns a 2D array: [[header1, header2, ...], [value1, value2, ...]]
    var structure = GESI.universe_structures_structure(structureId, characterName);

    // Find the 'name' column index from headers
    if (structure && structure.length > 1) {
      var headers = structure[0];
      var nameIndex = headers.indexOf("name");
      if (nameIndex >= 0) {
        return structure[1][nameIndex];
      }
    }

    Logger.log("Could not parse structure name for " + structureId);
    return "Unknown Structure (" + structureId + ")";
  } catch (e) {
    Logger.log("Failed to resolve structure name for " + structureId + ": " + e);
    return "Unknown Structure (" + structureId + ")";
  }
}

function getMoonName(moonId) {
  try {
    // GESI returns a 2D array: [[header1, header2, ...], [value1, value2, ...]]
    var moon = GESI.universe_moons_moon(moonId);

    // Find the 'name' column index from headers
    if (moon && moon.length > 1) {
      var headers = moon[0];
      var nameIndex = headers.indexOf("name");
      if (nameIndex >= 0) {
        return moon[1][nameIndex];
      }
    }

    Logger.log("Could not parse moon name for " + moonId);
    return "Unknown Moon (" + moonId + ")";
  } catch (e) {
    Logger.log("Failed to resolve moon name for " + moonId + ": " + e);
    return "Unknown Moon (" + moonId + ")";
  }
}

/**
 * Reports moon extraction status to Discord.
 * Should be triggered hourly.
 */
function reportMoonStatusToDiscord() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var moonPullSheet = ss.getSheetByName("MoonPull");
  var settingsSheet = ss.getSheetByName("Settings");
  
  if (!moonPullSheet) return;
  
  var data = moonPullSheet.getDataRange().getValues();
  if (data.length <= 1) return; // No data
  
  var webhookUrl = settingsSheet.getRange("G3").getValue();
  if (!webhookUrl) {
    Logger.log("No Moon Webhook URL found in Settings!G3");
    return;
  }

  // Bot identity
  var customName = settingsSheet.getRange('G5').getValue();
  var customURL = settingsSheet.getRange('G8').getValue();
  var botName = customName ? customName : (getCorpName() + " Mining Bot");
  var logoUrl = customURL ? customURL : getCorpLogoUrl();

  var now = new Date();
  var upcomingExtractions = [];
  
  // Skip header
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var structureName = row[0];
    var moonName = row[1];
    var arrivalTimeStr = row[3]; // Chunk Arrival
    
    var arrivalTime = new Date(arrivalTimeStr);
    var timeDiff = arrivalTime.getTime() - now.getTime();
    var hoursDiff = timeDiff / (1000 * 60 * 60);

    var status = "";

    // Use wider time windows to avoid missing notifications if hourly trigger doesn't align perfectly
    if (hoursDiff >= 23 && hoursDiff < 25) {
      status = "24h Warning";
    } else if (hoursDiff >= 0.5 && hoursDiff < 1.5) {
      status = "1h Warning";
    } else if (hoursDiff >= -0.5 && hoursDiff < 0.5) {
      status = "READY";
    }
    
    if (status) {
      upcomingExtractions.push({
        structure: structureName,
        moon: moonName,
        arrival: arrivalTime,
        status: status,
        hours: hoursDiff
      });
    }
  }
  
  if (upcomingExtractions.length > 0) {
    var embed = {
      title: "Moon Extraction Updates",
      color: 16776960, // Yellow
      timestamp: now.toISOString(),
      author: { name: botName, icon_url: logoUrl },
      fields: []
    };
    
    upcomingExtractions.forEach(function(ex) {
      var msg = "";
      if (ex.status === "READY") {
        msg = "🔴 **EXTRACTION READY NOW**";
      } else if (ex.status === "1h Warning") {
        msg = "🟠 **Extraction in < 1 Hour**";
      } else if (ex.status === "24h Warning") {
        msg = "🟡 **Extraction in 24 Hours**";
      }
      
      embed.fields.push({
        name: ex.structure + " - " + ex.moon,
        value: msg + "\nArrival: " + ex.arrival.toUTCString()
      });
    });
    
    sendToDiscord([embed], webhookUrl);
  }
  

}

/**
 * Sends a daily summary of all pending extractions.
 * Should be triggered daily.
 */
function reportDailyMoonSummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var moonPullSheet = ss.getSheetByName("MoonPull");
  var settingsSheet = ss.getSheetByName("Settings");
  
  if (!moonPullSheet) return;
  
  var data = moonPullSheet.getDataRange().getValues();
  if (data.length <= 1) return;
  
  var webhookUrl = settingsSheet.getRange("G3").getValue();
  if (!webhookUrl) return;

  var customName = settingsSheet.getRange('G5').getValue();
  var customURL = settingsSheet.getRange('G8').getValue();
  var botName = customName ? customName : (getCorpName() + " Mining Bot");
  var logoUrl = customURL ? customURL : getCorpLogoUrl();

  var now = new Date();
  var extractions = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var arrivalTime = new Date(row[3]);
    if (arrivalTime > now) {
      extractions.push({
        structure: row[0],
        moon: row[1],
        arrival: arrivalTime
      });
    }
  }
  
  // Sort by arrival time
  extractions.sort(function(a, b) { return a.arrival - b.arrival; });
  
  if (extractions.length > 0) {
    var embed = {
      title: "Daily Moon Extraction Summary",
      description: "Upcoming extractions for the next few days.",
      color: 3447003, // Blue
      timestamp: now.toISOString(),
      author: { name: botName, icon_url: logoUrl },
      fields: []
    };
    
    extractions.forEach(function(ex) {
      var timeDiff = ex.arrival.getTime() - now.getTime();
      var days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      var hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      embed.fields.push({
        name: ex.structure + " - " + ex.moon,
        value: "Arrives in: " + days + "d " + hours + "h\n(" + ex.arrival.toUTCString() + ")"
      });
    });
    
    sendToDiscord([embed], webhookUrl);
  }
}
