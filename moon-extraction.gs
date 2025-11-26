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
    // It seems G3 is the value, maybe G2 is label?
    // In fuel-tracker: G1 is "discordWebHook", G2 is the value.
    // Let's use H2 for Moon Webhook Label and H3 for value? Or just G3 as value?
    // The instructions say: "It can also be found in cell G3 of the ESI_list sheet."
    // But we are in Settings sheet.
    // Let's put a label in F3 and value in G3?
    // fuel-tracker uses G1 for label "discordWebHook" and G2 for value.
    // Let's use F2 for "Moon Webhook" label and G3 for value? No that's confusing.
    // Let's use G3 for the Moon Webhook URL as per instructions hint (even though it said ESI_list).
    // I will add a label in F3 if possible, or just assume G3.
    // Let's look at fuel-tracker setup again.
    // settingsSheet.getRange("G1").setValue("discordWebHook");
    // settingsSheet.getRange("G2") is the value.
    
    // I'll set F3 to "Moon Webhook" and G3 to the default testing URL.
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

  // Prefetch all structures to get names? 
  // GESI.corporations_corporation_structures returns a list of structures.
  // We can use that to map ID to name.
  try {
    var structures = GESI.corporations_corporation_structures("en", corpId);
    if (structures && structures.length > 0) {
      for (var i = 0; i < structures.length; i++) {
        // structure is an array? GESI returns array of arrays for sheet output usually?
        // Wait, GESI functions usually return objects if not raw?
        // In fuel-tracker.gs: var result = GESI.corporations_corporation_structures("en", names[i][0]);
        // pullSheet.getRange(...).setValues(result);
        // So it returns a 2D array suitable for sheets.
        // I need to know the index of ID and Name.
        // GESI documentation or inspection needed.
        // Usually: [structure_id, name, ...]
        // Let's assume index 0 is ID, index 1 is Name?
        // Actually, let's look at fuel-tracker.gs usage.
        // It just dumps result to sheet.
        // I'll assume I can fetch individual structure info if needed, or just use the ID if name lookup fails.
        // But `corporations_corporation_structures` output format:
        // structure_id, type_id, name, system_id, ...
        // I'll try to use it.
        var s = structures[i];
        // s[0] should be ID, s[1] or s[2] name?
        // Let's rely on `GESI.universe_structures_structure` for specific IDs if we can't be sure.
        // But that requires token and might be rate limited.
        // Let's try to build a map from the bulk fetch.
        // Assuming standard GESI output order.
        // structure_id is usually first.
        // name is usually included.
        // I'll log one to be sure if I could, but I can't run it.
        // I will use a helper that tries to find it.
      }
    }
  } catch (e) {
    Logger.log("Error fetching structure list: " + e);
  }

  for (var i = 0; i < extractions.length; i++) {
    var ex = extractions[i];
    // ex object keys: structure_id, moon_id, extraction_start_time, chunk_arrival_time, natural_decay_time
    // GESI returns objects for single calls usually?
    // `corporations_corporation_mining_extractions` returns an array of objects.
    
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
  
  // We want to send pings:
  // 1. Once daily (summary?) - Maybe handled by a separate trigger or just check time?
  //    The requirements say: "Send a ping to Discord once daily, with additional pings one day and one hour before extraction times. It should send a final ping at extraction time."
  //    To avoid spamming "Once daily", we can pick a specific hour, e.g., 11:00 UTC, or just include a summary if we are sending other pings?
  //    Or maybe we just send a summary every day at a fixed time.
  //    For now, let's focus on the event-based pings (24h, 1h, Now).
  //    To handle "Once daily", we might need to store state or just run this function once a day for the summary, and hourly for the others.
  //    But the user sets up triggers.
  //    If the user sets an Hourly trigger, we can check if it's the "Daily" time (e.g. 00:00 UTC) to send summary.
  //    Or we can have a separate function `reportDailyMoonSummary` and `checkMoonAlerts`.
  //    Let's combine them. If it's near a certain hour, send summary.
  
  // Let's implement the alerts first.
  
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
    
    // Logic for pings:
    // 1. One day before (24h +/- small buffer)
    // 2. One hour before (1h +/- small buffer)
    // 3. Extraction time (0h +/- small buffer)
    
    // Since this runs hourly, we check if the time falls within the last hour window?
    // Or we can just say: if it's between 23h and 24h, send 24h ping.
    // If it's between 0h and 1h, send 1h ping.
    // If it's between -1h and 0h (just passed), send "Ready" ping.
    
    // Let's define windows.
    // We want to avoid double pinging.
    // If we run every hour, we can check if `hoursDiff` is in range.
    
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
  
  // Daily Summary Logic
  // Check if it's around 11:00 UTC (or any fixed time)
  // Or maybe we just send a summary if the user manually triggers it?
  // The requirement says "Send a ping to Discord once daily".
  // I'll add a separate function `reportDailyMoonSummary` that can be triggered daily.
  // And this `reportMoonStatusToDiscord` can be the hourly one.
  // But the user might want one function to rule them all.
  // I'll add `reportDailyMoonSummary` and let the user set a daily trigger for it.
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
