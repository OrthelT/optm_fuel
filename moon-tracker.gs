
/*
Moon Extraction Monitor
This script monitors moon extractions and sends Discord notifications.
It operates independently from the main fuel tracker but shares the GESI configuration.
Menu hook is in fuel-tracker.gs
Sets up the necessary sheets for the Moon Extraction Monitor.
*/

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
    var extractions = GESI.corporation_corporation_mining_extractions(characterName);
    Logger.log(extractions)
    
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
  Logger.log["headers: " + headers]
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
    Logger.log("structure_id: " + structureId)
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
function reportHourlyMoonStatusToDiscord() {
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
  Logger.log(customName)
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
    if (hoursDiff >= 24 && hoursDiff < 25) {
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
      title: "Moon Extraction Update",
      color: 16776960, // Yellow
      timestamp: now.toISOString(),
      author: { name: botName, icon_url: logoUrl },
      fields: []
    };

    upcomingExtractions.forEach(function(ex) {
      var msg = "";
      if (ex.status === "READY") {
        msg = "🟢 **EXTRACTION READY NOW**";
      } else if (ex.status === "1h Warning") {
        msg = "🟠 **Extraction in < 1 Hour**";
      } else if (ex.status === "24h Warning") {
        msg = "🟡 **Extraction coming up in 24 Hours**";
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
 */function reportDailyMoonSummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var moonPullSheet = ss.getSheetByName("MoonPull");
  var settingsSheet = ss.getSheetByName("Settings");

  if (!moonPullSheet) {
    setupSheetsForNewUser();
  };

  var check_data = moonPullSheet.getDataRange().getValues();
  if (check_data.length <= 1) {
    updateMoonExtractions();
  };
  data = moonPullSheet.getDataRange().getValues();
  if (data.length <= 1) {
    ui = SpreadsheetApp.getUi()
    ui.alert("No moon data found")
    return;
  }
  var webhookUrl = settingsSheet.getRange("G3").getValue();
  if (!webhookUrl) return;

  var customName = settingsSheet.getRange('G5').getValue();
  var customURL = settingsSheet.getRange('G8').getValue();
  var botName = customName ? customName : (getCorpName() + " Mining Bot");
  var logoUrl = customURL ? customURL : getCorpLogoUrl();

  var now = new Date();

  // Start of "today"
  var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Start of "yesterday"
  var startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  var upcoming = [];
  var recent = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var arrivalTime = new Date(row[3]);
    if (isNaN(arrivalTime)) continue; // skip bad data

    if (arrivalTime > now) {
      // Future extraction
      upcoming.push({
        structure: row[0],
        moon: row[1],
        arrival: arrivalTime
      });
    } else if (arrivalTime >= startOfYesterday) {
      // Past extraction, but only today or yesterday
      recent.push({
        structure: row[0],
        moon: row[1],
        arrival: arrivalTime
      });
    }
  }

  // Sort both buckets by time
  upcoming.sort(function(a, b) { return a.arrival - b.arrival; });
  recent.sort(function(a, b) { return a.arrival - b.arrival; });

  // Only send a message if we have something to say
  if (upcoming.length === 0 && recent.length === 0) {
    return;
  }

  var embed = {
    title: "Daily Moon Extraction Summary",
    description: "Recent and upcoming extractions.",
    color: 3447003, // Blue
    timestamp: now.toISOString(),
    author: { name: botName, icon_url: logoUrl },
    fields: []
  };

  var MS_PER_HOUR = 1000 * 60 * 60;
  var MS_PER_DAY = MS_PER_HOUR * 24;

  // 1) Recent extractions (today / yesterday)
  if (recent.length > 0) {
  // Section header
  embed.fields.push({
    name: "🟪 **Recent Extractions**",
    value: "Completed today or yesterday.",
    inline: false
  });

  recent.forEach(function(ex) {
    embed.fields.push({
      name: ex.structure + " - " + ex.moon,
      value: "Completed: " + ex.arrival.toUTCString(),
      inline: false
    });
  });

  // Spacer before next section
  embed.fields.push({
    name: "\u200B",
    value: " ",
    inline: false
  });
}

  // 2) Upcoming extractions
  if (upcoming.length > 0) {
  embed.fields.push({
    name: "🟦 **Upcoming Extractions**",
    value: "Scheduled in the next few days.",
    inline: false
  });

  upcoming.forEach(function(ex) {
    embed.fields.push({
      name: ex.structure + " - " + ex.moon,
      value: "Ready in: " + formatCountdown(ex.arrival, now),
      inline: false
    });
  });
}


  sendToDiscord([embed], webhookUrl);

}

function formatCountdown(arrival, now) {
  var ms = arrival.getTime() - now.getTime();
  var days = Math.floor(ms / (1000 * 60 * 60 * 24));
  var hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days === 0) return hours + " hours\n(" + arrival.toUTCString() + ")";
  return days + " days " + hours + " hours\n(" + arrival.toUTCString() + ")";
}

/**
 * Chunks an array of embed fields into groups that fit within Discord's limits.
 * Discord allows max 25 fields per embed.
 * @param {Array} fields - Array of field objects
 * @param {number} maxFields - Maximum fields per chunk (default 20, leaving room for headers)
 * @returns {Array} Array of field arrays, each under maxFields
 */
function chunkFields(fields, maxFields) {
  maxFields = maxFields || 20;
  var chunks = [];

  for (var i = 0; i < fields.length; i += maxFields) {
    chunks.push(fields.slice(i, i + maxFields));
  }

  return chunks;
}

/**
 * Reports hourly moon status to Discord with chunking for large extraction lists.
 * Use this instead of reportHourlyMoonStatusToDiscord when you have many simultaneous extractions.
 */
function reportHourlyMoonStatusToDiscordChunked() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var moonPullSheet = ss.getSheetByName("MoonPull");
  var settingsSheet = ss.getSheetByName("Settings");

  if (!moonPullSheet) return;

  var data = moonPullSheet.getDataRange().getValues();
  if (data.length <= 1) return;

  var webhookUrl = settingsSheet.getRange("G3").getValue();
  if (!webhookUrl) {
    Logger.log("No Moon Webhook URL found in Settings!G3");
    return;
  }

  var customName = settingsSheet.getRange('G5').getValue();
  var customURL = settingsSheet.getRange('G8').getValue();
  var botName = customName ? customName : (getCorpName() + " Mining Bot");
  var logoUrl = customURL ? customURL : getCorpLogoUrl();

  var now = new Date();
  var upcomingExtractions = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var structureName = row[0];
    var moonName = row[1];
    var arrivalTimeStr = row[3];

    var arrivalTime = new Date(arrivalTimeStr);
    var timeDiff = arrivalTime.getTime() - now.getTime();
    var hoursDiff = timeDiff / (1000 * 60 * 60);

    var status = "";

    if (hoursDiff >= 24 && hoursDiff < 25) {
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

  if (upcomingExtractions.length === 0) return;

  // Build fields array
  var fields = [];
  upcomingExtractions.forEach(function(ex) {
    var msg = "";
    if (ex.status === "READY") {
      msg = "🟢 **EXTRACTION READY NOW**";
    } else if (ex.status === "1h Warning") {
      msg = "🟠 **Extraction in < 1 Hour**";
    } else if (ex.status === "24h Warning") {
      msg = "🟡 **Extraction coming up in 24 Hours**";
    }

    fields.push({
      name: ex.structure + " - " + ex.moon,
      value: msg + "\nArrival: " + ex.arrival.toUTCString()
    });
  });

  // Chunk fields and send multiple messages if needed
  var fieldChunks = chunkFields(fields, 20);
  var messages = [];

  for (var c = 0; c < fieldChunks.length; c++) {
    var title = "Moon Extraction Update";
    if (fieldChunks.length > 1) {
      title += " (" + (c + 1) + "/" + fieldChunks.length + ")";
    }

    messages.push([{
      title: title,
      color: 16776960,
      timestamp: now.toISOString(),
      author: { name: botName, icon_url: logoUrl },
      fields: fieldChunks[c]
    }]);
  }

  // Send with delays between messages
  for (var m = 0; m < messages.length; m++) {
    sendToDiscord(messages[m], webhookUrl);
    if (m < messages.length - 1) {
      Utilities.sleep(1000);
    }
  }
}

/**
 * Reports daily moon summary to Discord with chunking for large extraction lists.
 * Use this instead of reportDailyMoonSummary when you have many extractions.
 */
function reportDailyMoonSummaryChunked() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var moonPullSheet = ss.getSheetByName("MoonPull");
  var settingsSheet = ss.getSheetByName("Settings");

  if (!moonPullSheet) {
    setupSheetsForNewUser();
  }

  var check_data = moonPullSheet.getDataRange().getValues();
  if (check_data.length <= 1) {
    updateMoonExtractions();
  }

  var data = moonPullSheet.getDataRange().getValues();
  if (data.length <= 1) {
    var ui = SpreadsheetApp.getUi();
    ui.alert("No moon data found");
    return;
  }

  var webhookUrl = settingsSheet.getRange("G3").getValue();
  if (!webhookUrl) return;

  var customName = settingsSheet.getRange('G5').getValue();
  var customURL = settingsSheet.getRange('G8').getValue();
  var botName = customName ? customName : (getCorpName() + " Mining Bot");
  var logoUrl = customURL ? customURL : getCorpLogoUrl();

  var now = new Date();
  var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  var upcoming = [];
  var recent = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var arrivalTime = new Date(row[3]);
    if (isNaN(arrivalTime)) continue;

    if (arrivalTime > now) {
      upcoming.push({
        structure: row[0],
        moon: row[1],
        arrival: arrivalTime
      });
    } else if (arrivalTime >= startOfYesterday) {
      recent.push({
        structure: row[0],
        moon: row[1],
        arrival: arrivalTime
      });
    }
  }

  upcoming.sort(function(a, b) { return a.arrival - b.arrival; });
  recent.sort(function(a, b) { return a.arrival - b.arrival; });

  if (upcoming.length === 0 && recent.length === 0) {
    return;
  }

  // Build all fields
  var recentFields = [];
  var upcomingFields = [];

  recent.forEach(function(ex) {
    recentFields.push({
      name: ex.structure + " - " + ex.moon,
      value: "Completed: " + ex.arrival.toUTCString(),
      inline: false
    });
  });

  upcoming.forEach(function(ex) {
    upcomingFields.push({
      name: ex.structure + " - " + ex.moon,
      value: "Ready in: " + formatCountdown(ex.arrival, now),
      inline: false
    });
  });

  var messages = [];

  // Header message
  messages.push([{
    title: "Daily Moon Extraction Summary",
    description: "Recent and upcoming extractions.",
    color: 3447003,
    timestamp: now.toISOString(),
    author: { name: botName, icon_url: logoUrl }
  }]);

  // Recent extractions (chunked)
  if (recentFields.length > 0) {
    var recentChunks = chunkFields(recentFields, 18);
    for (var r = 0; r < recentChunks.length; r++) {
      var title = "🟪 Recent Extractions";
      if (recentChunks.length > 1) {
        title += " (" + (r + 1) + "/" + recentChunks.length + ")";
      }

      var fields = [{
        name: title,
        value: "Completed today or yesterday.",
        inline: false
      }];
      fields = fields.concat(recentChunks[r]);

      messages.push([{
        color: 10181046, // Purple
        fields: fields
      }]);
    }
  }

  // Upcoming extractions (chunked)
  if (upcomingFields.length > 0) {
    var upcomingChunks = chunkFields(upcomingFields, 18);
    for (var u = 0; u < upcomingChunks.length; u++) {
      var title = "🟦 Upcoming Extractions";
      if (upcomingChunks.length > 1) {
        title += " (" + (u + 1) + "/" + upcomingChunks.length + ")";
      }

      var fields = [{
        name: title,
        value: "Scheduled in the next few days.",
        inline: false
      }];
      fields = fields.concat(upcomingChunks[u]);

      messages.push([{
        color: 3447003, // Blue
        fields: fields
      }]);
    }
  }

  // Send with delays
  for (var m = 0; m < messages.length; m++) {
    sendToDiscord(messages[m], webhookUrl);
    if (m < messages.length - 1) {
      Utilities.sleep(1000);
    }
  }
}

//a quick hack to call and see if the page is here
function checkMoonTrackerScriptExits() {
  return true
}