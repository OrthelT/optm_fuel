# Code Annotations and Removed Comments

This file contains "internal reasoning", "instructions", and other non-code comments removed from the source scripts to improve readability.

## From `fuel-tracker.gs`

### User Instructions / Context (Found at the top of `onOpen`)
```text
I would like to create additional functionality for a Discord bot to monitor moon extractions that functions that works similarly to the the existing Discord bot for structure fuel. This is a local copy of the code that runs as a Google App Script in Google Sheets. This new functionality should:
- Be segregated from the existing functionality, operating independently with its own script within the same Google sheet. 
- Send a ping to Discord once daily, with additional pings one day and one hour before extraction times. It should send a final ping at extraction time. 

RESOURCES
The existing Google Sheet is here:
https://docs.google.com/spreadsheets/d/18icwZ7In9UIn495vxVdQJcLrYmvyjGVDLCqvPGArT44/edit?usp=sharing

The Discord web hook should be easily configurable for alternate Discord servers. This is the current testing webhook for the moon extraction function. It can also be found in cell G3 of the ESI_list sheet. 
https://discord.com/api/webhooks/1443330282903306261/VOWsG9E7y-0qxjP7pKl8_63K6d78kKS8Jm7IRmuS-ttrjfkJtAYWReSVZfRy2AM-bWXt
```

## From `moon-extraction.gs`

### Reasoning on Settings/Webhook Setup (in `setupMoonSheets`)
```text
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
```

### Reasoning on Data Fetching / API Structure (in `updateMoonExtractions`)
```text
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
```

### Reasoning on Notification Logic (in `reportMoonStatusToDiscord`)
```text
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
```

### Reasoning on Ping Timing (in `reportMoonStatusToDiscord`)
```text
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
```

### Reasoning on Daily Summary (in `reportMoonStatusToDiscord`)
```text
  // Daily Summary Logic
  // Check if it's around 11:00 UTC (or any fixed time)
  // Or maybe we just send a summary if the user manually triggers it?
  // The requirement says "Send a ping to Discord once daily".
  // I'll add a separate function `reportDailyMoonSummary` that can be triggered daily.
  // And this `reportMoonStatusToDiscord` can be the hourly one.
  // But the user might want one function to rule them all.
  // I'll add `reportDailyMoonSummary` and let the user set a daily trigger for it.
```
