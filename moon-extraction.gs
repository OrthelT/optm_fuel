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

  var charInfo = GetCharInfo(); // Reusing from fuel-tracker.gs
  var corpId = charInfo.corporation_id;
  
  try {
    var extractions = GESI.corporations_corporation_mining_extractions("en", corpId);
  } catch (e) {
    Logger.log("Error fetching extractions: " + e);
    return;
  }

  if (!extractions || extractions.length === 0) {
    Logger.log("No extractions found.");
    return;
  }

  var outputData = [];
  
  // Cache for structure and moon names to avoid repeated API calls
  var structureCache = {};
  var moonCache = {};



  for (var i = 0; i < extractions.length; i++) {
    var ex = extractions[i];

    
    var structureId = ex.structure_id;
    var moonId = ex.moon_id;
    
    var structureName = structureCache[structureId];
    if (!structureName) {
      structureName = getStructureName(structureId);
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
      ex.extraction_start_time,
      ex.chunk_arrival_time,
      ex.natural_decay_time,
      structureId
    ]);
    
    // Avoid rate limits
    Utilities.sleep(100); 
  }
  
  if (outputData.length > 0) {
    moonPullSheet.getRange(2, 1, outputData.length, outputData[0].length).setValues(outputData);
  }
}

function getStructureName(structureId) {
  try {
    // Try to get from GESI
    var structure = GESI.universe_structures_structure(structureId);
    return structure.name;
  } catch (e) {
    Logger.log("Failed to resolve structure name for " + structureId + ": " + e);
    return "Unknown Structure (" + structureId + ")";
  }
}

function getMoonName(moonId) {
  try {
    var moon = GESI.universe_moons_moon(moonId);
    return moon.name;
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
  var embeds = [];
  var hasUpdates = false;
  

  
  var upcomingExtractions = [];
  var activeExtractions = [];
  
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
    
    if (hoursDiff > 23 && hoursDiff <= 24) {
      status = "24h Warning";
      hasUpdates = true;
    } else if (hoursDiff > 0 && hoursDiff <= 1) {
      status = "1h Warning";
      hasUpdates = true;
    } else if (hoursDiff <= 0 && hoursDiff > -1) {
      status = "READY";
      hasUpdates = true;
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
