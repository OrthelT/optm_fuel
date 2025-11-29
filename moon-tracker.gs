
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

//a quick hack to call and see if the page is here 
function checkMoonTrackerScriptExits() {
  return true
}