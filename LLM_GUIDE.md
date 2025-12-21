# LLM Guide - EVE Online Structure Manager

This guide provides comprehensive technical information for LLM assistants helping users set up and troubleshoot this Google Apps Script project.

## Project Overview

A dual-purpose Discord notification bot for EVE Online corporation management:
1. **Fuel Bot**: Monitors structure fuel levels and sends daily status reports
2. **Moon Bot**: Tracks moon extraction schedules with advance warnings

**Technology Stack:**
- **Runtime**: Google Apps Script (JavaScript environment, runs in Google Cloud)
- **Data Storage**: Google Sheets (multiple sheets for data processing)
- **External APIs**:
  - EVE Online ESI API (via GESI library)
  - Discord Webhooks for notifications
- **Authentication**: EVE SSO via GESI plugin

**Critical Constraint**: This CANNOT run locally. It must execute within Google Apps Script. The `.gs` files are for version control only.

## Architecture Overview

### File Structure

**fuel-tracker.gs** (Primary script)
- Creates UI menus: "Fuel Bot", "Moon Bot", "Setup"
- Manages fuel tracking functionality
- Sets up sheets for new users
- Provides shared utility functions (GetCharInfo, getCorpName, getCorpLogoUrl, sendToDiscord)

**moon-tracker.gs** (Secondary script)
- Moon extraction monitoring
- Hourly alert checking
- Daily summary generation
- Uses shared functions from fuel-tracker.gs

### Menu Structure

When the spreadsheet opens, `onOpen()` creates three custom menus:

**Fuel Bot Menu:**
- "Update Fuel Status" → `updateFuelStatus()`
- "Report Fuel Status to Discord" → `reportFuelStatusToDiscord()`
- "Report Fuel Status to Discord (Chunked)" → `reportFuelStatusToDiscordChunked()`
- "Clear Time" → `clearCellS2()`
- "Get Time" → `getUtcTimestampToS2()`

**Moon Bot Menu:**
- "Update Moon Extractions" → `updateMoonExtractions()`
- "Report Moon Status to Discord" → `reportDailyMoonSummary()`
- "Report Moon Status to Discord (Chunked)" → `reportDailyMoonSummaryChunked()`

**Setup Menu:**
- "Create Fuel and Moon Sheets" → `setupSheetsForNewUser()`
- "Configure Settings" → `jumpToSettings()`
- "Help" → `jumpToInstructions()`

### Sheet Structure

**Settings Sheet:**
- `A1`: "Name(s)" (header)
- `A2`: EVE character name (CRITICAL - must be exact match, case-sensitive)
- `G1`: "discordWebHook" (header)
- `F2`: "Fuel Webhook" (label)
- `G2`: Fuel Discord webhook URL
- `F3`: "Moon Webhook" (label)
- `G3`: Moon Discord webhook URL
- `G4`: "Custom Bot Name (optional)" (label)
- `G5`: Custom bot name (optional, defaults to "[Corp Name] Fuel Bot" or "[Corp Name] Mining Bot")
- `G7`: "Logo URL (optional)" (label)
- `G8`: Custom logo URL (optional, defaults to corp logo)
- `G13`: Fuel Warning role ping id
- `G14`: Fuel Critical role ping id

**FuelPull Sheet:**
- Raw data from `GESI.corporations_corporation_structures()`
- Cleared and refreshed on each update
- Contains all structure data including fuel expiration timestamps

**CleanData Sheet:**
- Row 1: Headers and formulas
  - `C1`: `=IFERROR(SPLIT(CleanData!$D$1, "Z"),now())` (extracts timestamp)
  - `D1`: UTC timestamp (set by `getUtcTimestampToS2()`)
- Row 2:
  - `A2`: `=UNIQUE(FuelPull!C:C)` (unique structure names)
  - `B3`: "Days Remaining" (header)
- Rows 4-104: Formulas for up to 100 structures
  - Column A: Structure names
  - Column B: Calculated days/hours remaining (formula: `=IF(C' + i + '="","",TEXT(INT((C' + i + '-$C$1)), "0") & " days " & TEXT(MOD((C' + i + '-$C$1), 1), "h") & " hours")`)
  - Column C: Fuel expiration timestamp (formula: `=IFERROR(IF(A' + i + '="","", LEFT(XLOOKUP($A' + i + ',FuelPull!$C:$C,FuelPull!B:B),LEN(XLOOKUP($A' + i + ',FuelPull!$C:$C,FuelPull!B:B))-1)-0))`)
  - Column D: Structure state (formula: `=IFERROR(XLOOKUP($A' + i + ',FuelPull!$C:$C,FuelPull!I:I))`)

**MoonPull Sheet:**
- Headers (row 1): "Structure Name", "Moon Name", "Extraction Start", "Chunk Arrival", "Natural Decay", "Structure ID"
- Data rows: Populated by `updateMoonExtractions()`

**Instructions Sheet:**
- Quick reference for users on setting up triggers

## Function Reference

### Fuel Tracking Functions (fuel-tracker.gs)

#### `onOpen()`
- **Trigger**: Automatically when spreadsheet opens
- **Purpose**: Creates custom menus in the UI
- **Calls**: Creates "Fuel Bot", "Moon Bot", and "Setup" menus

#### `setupSheetsForNewUser()`
- **Trigger**: Manual via "Setup" → "Create Fuel and Moon Sheets"
- **Purpose**: Initial setup - creates all required sheets
- **Actions**:
  1. Stores spreadsheet ID in script properties
  2. Creates FuelPull sheet
  3. Creates MoonPull sheet with headers
  4. Creates CleanData sheet with formulas
  5. Creates Instructions sheet with setup guide
  6. Creates Settings sheet with configuration cells
  7. Calls moon tracker setup (if moon-tracker.gs exists)
  8. Navigates user to Settings sheet
- **Returns**: Alert message with setup status

#### `GetCharInfo()`
- **Purpose**: Retrieves character data for the main character
- **Source**: Settings sheet cell A2
- **GESI Call**: `GESI.getCharacterData(characterName)`
- **Returns**: Character info object with `corporation_id` and other character details
- **Fallback**: Checks ESI_List sheet A2 if Settings A2 is empty
- **Error Handling**: Shows alert if no character found

#### `getCorpName()`
- **Purpose**: Gets corporation name for Discord bot identity
- **GESI Call**: `GESI.corporations_corporation(corpID)`
- **Returns**: Corporation name (string)
- **Data Access**: Result is 2D array, name is at `[1][8]`

#### `getCorpLogoUrl()`
- **Purpose**: Gets corporation logo URL for Discord bot avatar
- **Returns**: EVE image server URL: `https://images.evetech.net/corporations/{corpID}/logo?size=64`

#### `updateFuelStatus()`
- **Trigger**: Daily (user-configured time) OR manual via "Fuel Bot" menu
- **Purpose**: Fetches structure fuel data from EVE API
- **Process**:
  1. Clears and resets timestamp via `clearCellS2()` and `getUtcTimestampToS2()`
  2. Clears FuelPull sheet
  3. Reads character names from Settings A2:A
  4. For each character: calls `GESI.corporations_corporation_structures("en", characterName)`
  5. Writes results to FuelPull sheet
  6. Waits 5 seconds between API calls (rate limiting)
- **GESI Response**: 2D array of structure data

#### `reportFuelStatusToDiscord()`
- **Trigger**: Daily (1 hour after updateFuelStatus) OR manual via menu
- **Purpose**: Sends Discord notification with fuel status
- **Process**:
  1. Updates timestamp
  2. Reads data from CleanData sheet
  3. Categorizes structures:
     - **Critical**: < 3 days fuel remaining (🔴 red, color: 15158332)
     - **Warning**: 3-7 days fuel remaining (🟠 orange, color: 16763904)
     - **Healthy**: > 7 days fuel remaining (🟢 green, color: 3066993)
  4. Creates Discord embeds for each category
  5. Sends to webhook via `sendToDiscord()`
- **Bot Identity**: Uses custom name/logo from Settings G5/G8 or defaults to corp name/logo

#### `sendToDiscord(embeds, webhookUrl)`
- **Purpose**: Sends formatted embeds to Discord webhook
- **Parameters**:
  - `embeds`: Array of Discord embed objects
  - `webhookUrl`: Discord webhook URL
- **Method**: HTTP POST with JSON payload
- **Payload Format**:
  ```javascript
  {
    "embeds": [
      {
        "title": "String",
        "description": "String",
        "color": integer,
        "timestamp": "ISO 8601 string",
        "author": { "name": "String", "icon_url": "URL" },
        "fields": [ { "name": "String", "value": "String", "inline": boolean } ],
        "footer": { "text": "String" }
      }
    ]
  }
  ```

#### `reportFuelStatusToDiscordChunked()`
- **Trigger**: Daily (1 hour after updateFuelStatus) OR manual via menu
- **Purpose**: Sends Discord notification with fuel status, splitting large lists into multiple messages
- **Use Case**: For corporations with 50+ structures that exceed Discord's 4096 character embed limit
- **Process**:
  1. Updates timestamp
  2. Reads data from CleanData sheet
  3. Categorizes structures (Critical/Warning/Healthy)
  4. Chunks each category into segments under 3000 characters
  5. Sends each chunk as a separate message with 1-second delays
- **Chunk Titles**: When split, titles show "(1/3)", "(2/3)", etc.
- **Bot Identity**: Uses custom name/logo from Settings G5/G8 or defaults to corp name/logo

#### `chunkStructures(structures, maxChars, formatFn)`
- **Purpose**: Helper function that splits structure arrays into chunks under character limit
- **Parameters**:
  - `structures`: Array of structure objects
  - `maxChars`: Maximum characters per chunk (default 3000)
  - `formatFn`: Function to format each structure entry
- **Returns**: Array of description strings, each under maxChars

#### `sendToDiscordChunked(messages, webhookUrl)`
- **Purpose**: Sends multiple Discord messages sequentially with delays
- **Parameters**:
  - `messages`: Array of embed arrays, each sent as a separate message
  - `webhookUrl`: Discord webhook URL
- **Rate Limiting**: 1-second delay between messages

#### `getUtcTimestampToS2()`
- **Trigger**: Every 6 hours OR manual via menu
- **Purpose**: Updates current UTC timestamp in CleanData D1
- **Returns**: ISO 8601 formatted timestamp

#### `clearCellS2()`
- **Purpose**: Clears timestamp from CleanData D1
- **Use Case**: Called before updating timestamp

#### `sortFunction(a, b)`
- **Purpose**: Alphabetical sorting comparator for structure arrays
- **Returns**: -1, 0, or 1 for sort order

### Moon Tracking Functions (moon-tracker.gs)

#### `updateMoonExtractions()`
- **Trigger**: Daily (user-configured time) OR manual via "Moon Bot" menu
- **Purpose**: Fetches active moon extractions from EVE API
- **Process**:
  1. Gets character name from Settings A2
  2. Clears old data from MoonPull sheet (keeps headers)
  3. Calls `GESI.corporation_corporation_mining_extractions(characterName)`
  4. Parses 2D array response (row 0 = headers, row 1+ = data)
  5. Resolves structure and moon IDs to names via helper functions
  6. Writes to MoonPull sheet
- **GESI Response Format**: 2D array with columns:
  - `structure_id`
  - `moon_id`
  - `extraction_start_time`
  - `chunk_arrival_time`
  - `natural_decay_time`
- **Caching**: Uses `structureCache` and `moonCache` objects to avoid repeated API calls
- **Rate Limiting**: 100ms sleep between lookups

#### `getStructureName(structureId, characterName)`
- **Purpose**: Resolves structure ID to name
- **GESI Call**: `GESI.universe_structures_structure(structureId, characterName)`
- **Authentication**: Requires character name for player-owned structures
- **Response Parsing**:
  - GESI returns 2D array: `[[headers...], [values...]]`
  - Finds "name" column index from headers
  - Returns name from data row
- **Error Handling**: Returns "Unknown Structure (ID)" if lookup fails

#### `getMoonName(moonId)`
- **Purpose**: Resolves moon ID to name
- **GESI Call**: `GESI.universe_moons_moon(moonId)`
- **Response Parsing**: Same 2D array format as getStructureName
- **Error Handling**: Returns "Unknown Moon (ID)" if lookup fails

#### `reportHourlyMoonStatusToDiscord()`
- **Trigger**: Every hour (automated)
- **Purpose**: Sends alerts for upcoming extractions
- **Alert Windows** (to handle trigger timing variance):
  - **24h Warning**: 24-25 hours before chunk arrival (🟡 yellow)
  - **1h Warning**: 0.5-1.5 hours before chunk arrival (🟠 orange)
  - **READY**: -0.5 to +0.5 hours from chunk arrival (🟢 green)
- **Process**:
  1. Reads MoonPull sheet
  2. Calculates time difference for each extraction
  3. If within any window, creates alert embed
  4. Sends to webhook (Settings G3)
- **Webhook**: Uses Moon webhook (G3)
- **Bot Identity**: Uses custom settings or defaults to "[Corp Name] Mining Bot"

#### `reportDailyMoonSummary()`
- **Trigger**: Daily (user-configured time) OR manual via menu
- **Purpose**: Sends comprehensive summary of all extractions
- **Categories**:
  - **Recent**: Completed today or yesterday (🟪 purple)
  - **Upcoming**: Scheduled for future (🟦 blue)
- **Sorting**: Both categories sorted by arrival time
- **Format**: Discord embed with fields for each extraction
- **Countdown Format**: "X days Y hours" for upcoming extractions

#### `formatCountdown(arrival, now)`
- **Purpose**: Formats time remaining for upcoming extractions
- **Returns**: String like "2 days 5 hours" or "14 hours"
- **Includes**: UTC timestamp in parentheses

#### `checkMoonTrackerScriptExits()`
- **Purpose**: Verification function called by setupSheetsForNewUser
- **Returns**: `true` (simple existence check)

#### `chunkFields(fields, maxFields)`
- **Purpose**: Helper function that splits embed fields arrays into chunks
- **Parameters**:
  - `fields`: Array of Discord embed field objects
  - `maxFields`: Maximum fields per chunk (default 20, leaving room for headers)
- **Returns**: Array of field arrays, each under maxFields
- **Use Case**: Discord allows max 25 fields per embed

#### `reportHourlyMoonStatusToDiscordChunked()`
- **Trigger**: Every hour (automated) OR manual
- **Purpose**: Sends alerts for upcoming extractions, with chunking for large lists
- **Use Case**: For corporations with many simultaneous extractions in the same time window
- **Process**:
  1. Same as `reportHourlyMoonStatusToDiscord()` but chunks fields
  2. Splits into multiple messages if >20 extractions in alert window
  3. Sends with 1-second delays between messages
- **Chunk Titles**: When split, titles show "(1/3)", "(2/3)", etc.

#### `reportDailyMoonSummaryChunked()`
- **Trigger**: Daily (user-configured time) OR manual via menu
- **Purpose**: Sends comprehensive summary of all extractions, with chunking
- **Use Case**: For corporations with 20+ moon extractions
- **Process**:
  1. Sends header message first
  2. Chunks recent extractions into groups of 18 fields
  3. Chunks upcoming extractions into groups of 18 fields
  4. Sends each chunk as separate message with 1-second delays
- **Chunk Titles**: When split, section titles show "(1/3)", "(2/3)", etc.

## GESI Integration Details

### GESI Library Setup

**Script ID**: `1KjnRVVFr2KiHH55sqBfHcZ-yXweJ7iv89V99ubaLy4A7B_YH8rB5u0s3`
**Identifier**: `GESI` (case-sensitive, MUST be exactly this)

**Installation**:
1. Apps Script editor → Libraries (+ button)
2. Paste Script ID
3. Look up → Select latest version → Add
4. Verify identifier is `GESI`

### GESI Plugin vs Library

**GESI Library** (Script library):
- Added in Apps Script editor
- Provides API functions like `GESI.corporations_corporation_structures()`
- Required for code to work

**GESI Plugin** (Add-on):
- Installed via Extensions → Add-ons
- Provides character authorization via EVE SSO
- Manages authentication tokens
- Adds "GESI" menu to Google Sheets

Both are required. Library provides code, plugin provides authentication.

### GESI Function Calls Used

#### `GESI.corporations_corporation_structures(language, characterName)`
- **Purpose**: Get all corporation structures
- **Parameters**:
  - `language`: "en" (English)
  - `characterName`: Authenticated character name from Settings A2
- **Returns**: 2D array (rows × columns) of structure data
- **Auth Required**: Yes (via character name)
- **Rate Limit**: Respect 5-second delays between calls
- **Required Scope**: `esi-corporations.read_structures.v1`

#### `GESI.getCharacterData(characterName)`
- **Purpose**: Get character information
- **Returns**: Object with character data including `corporation_id`
- **Auth Required**: Yes

#### `GESI.corporations_corporation(corporationId)`
- **Purpose**: Get corporation information
- **Returns**: 2D array, corporation name at `[1][8]`
- **Auth Required**: No (public data)

#### `GESI.corporation_corporation_mining_extractions(characterName)`
- **Purpose**: Get active moon extractions
- **Returns**: 2D array with headers in row 0, data in rows 1+
- **Columns**: structure_id, moon_id, extraction_start_time, chunk_arrival_time, natural_decay_time
- **Auth Required**: Yes
- **Required Scope**: `esi-industry.read_corporation_mining.v1`

#### `GESI.universe_structures_structure(structureId, characterName)`
- **Purpose**: Get structure details (name, location, etc.)
- **Returns**: 2D array `[[headers...], [values...]]`
- **Auth Required**: Yes (for player-owned structures)
- **Required Scope**: `esi-universe.read_structures.v1`

#### `GESI.universe_moons_moon(moonId)`
- **Purpose**: Get moon information
- **Returns**: 2D array with moon name
- **Auth Required**: No (public data)

#### `GESI.getAuthenticatedCharacterNames()`
- **Purpose**: List all authenticated characters
- **Returns**: Array of character name strings
- **Use**: Verification that GESI is set up correctly

### GESI Response Format

IMPORTANT: GESI returns 2D arrays, NOT objects.

**Standard Format**:
```javascript
[
  ["header1", "header2", "header3"],  // Row 0: Column headers
  ["value1", "value2", "value3"],     // Row 1: First data row
  ["value1", "value2", "value3"]      // Row 2: Second data row
]
```

**Parsing Pattern**:
```javascript
var data = GESI.some_function(...);
var headers = data[0];
var columnIndex = headers.indexOf("column_name");
var value = data[1][columnIndex];  // First data row
```

**Common Mistake**: Attempting `data.column_name` or `data[0].column_name` will fail.

### Authentication Flow

1. User installs GESI plugin (Extensions → Add-ons)
2. User enters character name in Settings A2
3. User clicks Extensions → GESI → Authorize Character
4. EVE SSO login opens in new tab
5. User grants requested scopes:
   - `esi-corporations.read_structures.v1`
   - `esi-industry.read_corporation_mining.v1`
   - `esi-universe.read_structures.v1`
6. GESI stores auth token
7. Script passes character name to GESI functions for authenticated calls

**Character Requirements**:
- Must have **Station Manager** OR **Director** corporation role
- Name must match exactly (case-sensitive)
- Must be currently authenticated via GESI plugin

## Time-Based Triggers

### Required Triggers

Users must create these triggers in Apps Script (clock icon):

1. **updateFuelStatus** - Day timer (e.g., 6am-7am daily)
2. **reportFuelStatusToDiscord** - Day timer (1 hour after #1, e.g., 7am-8am)
3. **updateMoonExtractions** - Day timer (e.g., 6am-7am daily, can be same as #1)
4. **reportDailyMoonSummary** - Day timer (1 hour after #3, e.g., 7am-8am)
5. **reportHourlyMoonStatusToDiscord** - Hour timer (every 1 hour)
6. **getUtcTimestampToS2** - Hour timer (every 6 hours)

### Trigger Configuration

**Day Timer**:
- Event source: Time-driven
- Type: Day timer
- Time: Select hour window (e.g., 8am-9am)

**Hour Timer**:
- Event source: Time-driven
- Type: Hour timer
- Hours interval: Select interval (1 hour or 6 hours)

### Timing Considerations

- Update functions should run before report functions
- Allow 1-hour gap between update and report (API processing time)
- Hourly moon checks use wide time windows (±1 hour) to catch alerts even if timing isn't perfect
- Timestamp updates every 6 hours keep CleanData calculations current

## Discord Webhook Integration

### Webhook Configuration

**Fuel Webhook** (Settings G2):
- Receives daily fuel status reports
- Color-coded embeds (red/orange/green)

**Moon Webhook** (Settings G3):
- Receives hourly extraction alerts
- Receives daily extraction summary
- Can be same URL as fuel webhook or different

### Discord Embed Format

**Color Codes**:
- Blue (3447003): Summary header
- Red (15158332): Critical fuel (<3 days)
- Orange (16763904): Warning fuel (3-7 days) or 1h moon alert
- Green (3066993): Healthy fuel (>7 days) or READY moon alert
- Yellow (16776960): 24h moon alert
- Purple: Recent extractions (custom)
- Blue: Upcoming extractions (custom)

**Embed Structure**:
```javascript
{
  "title": "Report Title",
  "description": "Optional description or structure list",
  "color": 3447003,  // Integer, not hex
  "timestamp": "2025-11-29T12:00:00.000Z",  // ISO 8601
  "author": {
    "name": "OPTM Fuel Bot",
    "icon_url": "https://images.evetech.net/corporations/98012345/logo?size=64"
  },
  "fields": [  // Optional, used in moon summaries
    {
      "name": "Structure - Moon",
      "value": "Status message",
      "inline": false
    }
  ],
  "footer": {
    "text": "EVE Online Structure Tracker"
  }
}
```

**Webhook Testing**:
- Paste webhook URL in browser → Should return JSON with "invalid request body"
- This confirms webhook exists
- No response or 404 = invalid webhook

## Common Issues and Solutions

### Setup Issues

**"GESI is not defined"**
- Cause: GESI library not added or identifier wrong
- Solution: Apps Script → Libraries → Add GESI with correct Script ID
- Verify: Identifier must be exactly `GESI` (case-sensitive)

**"No authenticated characters found"**
- Cause: GESI plugin not installed OR character not authorized
- Solution:
  1. Install GESI plugin: Extensions → Add-ons → Get add-ons → Search GESI
  2. Authorize: Extensions → GESI → Authorize Character
  3. Verify character name in Settings A2 matches exactly

**Character name issues**
- EVE character names are case-sensitive
- Extra spaces will break it
- Must be exact match to in-game name
- Common mistake: "character name" vs "Character Name"

**Permission errors during setup**
- User sees "This app hasn't been verified by Google"
- Solution: Click "Advanced" → "Go to [project name] (unsafe)" → "Allow"
- This is normal for personal Apps Script projects

### Data Issues

**No structures showing in FuelPull**
- Check: Character in Settings A2 authorized?
- Check: Character has Station Manager or Director role?
- Check: Character is in a corporation with structures?
- Test: Extensions → GESI → Function Test → Try a GESI call manually

**No moon extractions showing**
- Check: Corporation has active moon extractions?
- Check: Character authorized with correct scopes?
- Note: Empty list is normal if no extractions are running

**Formulas showing #N/A or errors in CleanData**
- Check: FuelPull sheet has data?
- Check: Column references in formulas match FuelPull structure?
- Common cause: GESI response format changed (rare)

### Discord Issues

**No Discord messages sent**
- Check: Webhook URL correct in Settings G2/G3?
- Test webhook: Paste URL in browser
- Check: Did trigger actually run? (Apps Script → Executions)
- Check: Execution logs for errors (Apps Script → Executions → Click row)

**Discord shows "invalid payload"**
- Cause: Malformed embed JSON
- Check: Recent code changes?
- Check: Embed color is integer, not string
- Check: Timestamp is valid ISO 8601 format

**Messages sent but empty/malformed**
- Check: CleanData sheet has processed data?
- Check: Timestamp in CleanData D1 is current?
- Debug: Run reportFuelStatusToDiscord manually and check logs

**Discord error 400 with large structure lists**
- Cause: Discord embed description exceeds 4096 character limit
- Symptom: Error message like "Request failed for https://discord.com/ returned code 400"
- Solution: Use `reportFuelStatusToDiscordChunked()` instead of `reportFuelStatusToDiscord()`
- Menu: Fuel Bot → Report Fuel Status to Discord (Chunked)
- For triggers: Update trigger to use `reportFuelStatusToDiscordChunked` function

**Discord error 400 with large moon extraction lists**
- Cause: Discord embed exceeds 25 fields limit
- Symptom: Error message like "Request failed for https://discord.com/ returned code 400"
- Solution: Use chunked moon functions instead:
  - `reportDailyMoonSummaryChunked()` instead of `reportDailyMoonSummary()`
  - `reportHourlyMoonStatusToDiscordChunked()` instead of `reportHourlyMoonStatusToDiscord()`
- Menu: Moon Bot → Report Moon Status to Discord (Chunked)
- For triggers: Update triggers to use chunked function names

### Trigger Issues

**Triggers not running**
- Check: Apps Script → Triggers → All triggers listed?
- Check: Apps Script → Executions → Recent runs?
- If missing: Recreate trigger with exact function name (case-sensitive)
- Common mistake: Wrong function name (e.g., "updateStationFuel" vs "updateFuelStatus")

**Triggers running but errors**
- Check: Apps Script → Executions → Click failed execution
- Look for error message
- Common errors: GESI not defined, character not authorized, webhook invalid

### Code Issues

**Editing locally**
- `.gs` files may not have syntax highlighting
- Solution: Configure editor to treat `.gs` as JavaScript
- VSCode: Add `"*.gs": "javascript"` to file associations settings
- Remember: Code executes in Apps Script, not locally

**Testing changes**
- Edit `.gs` file locally
- Copy entire contents to Apps Script editor
- Save in Apps Script
- Run function manually to test
- Check Apps Script logs (View → Logs or Ctrl+Enter)

## Troubleshooting Guide for LLMs

When helping users, follow this decision tree:

### User reports no data in sheets

1. **Ask**: "Can you click Fuel Bot → Update Fuel Status and tell me what happens?"
2. **If error about GESI**:
   - Guide through GESI library setup (Step 2 in README)
   - Verify identifier is `GESI`
3. **If error about authorization**:
   - Check character name in Settings A2
   - Guide through GESI plugin authorization
   - Verify character has required corp role
4. **If success but empty**:
   - Check if character is in corp with structures
   - Verify character role (Station Manager or Director)

### User reports no Discord messages

1. **Ask**: "Can you paste your webhook URL in a browser and tell me what you see?"
2. **If 404 or no response**:
   - Webhook is invalid
   - Guide through creating new webhook in Discord
3. **If JSON response**:
   - Webhook is valid
   - Check if trigger is set up
   - Check Apps Script → Executions for errors
4. **Check Settings sheet**:
   - Verify webhook in G2 (fuel) or G3 (moon)
   - Check for extra spaces or partial URL

### User reports function not found

1. **Verify**: Are both fuel-tracker.gs AND moon-tracker.gs in Apps Script?
2. **Check**: Function names are case-sensitive
   - Correct: `updateFuelStatus`
   - Wrong: `updateStationFuel` (old name)
3. **If moon functions missing**:
   - Confirm moon-tracker.gs is added to project
   - Save both files and refresh spreadsheet

### User gets authorization errors

1. **Check**: Character name in Settings A2 exactly matches in-game name
2. **Reauthorize**: Extensions → GESI → Authorize Character
3. **Verify**: Character has required corp roles
4. **Check**: All required scopes were granted during authorization

### User wants to customize

**Bot name**:
- Settings G5: Enter custom name
- Leave blank for default "[Corp Name] Fuel Bot"

**Bot avatar**:
- Settings G8: Enter image URL
- Leave blank for corp logo

**Different webhooks**:
- G2: Fuel reports
- G3: Moon reports
- Can use same URL for both

**Trigger timing**:
- User can adjust in Apps Script → Triggers
- Recommend 1-hour gap between update and report functions

## Data Flow Diagrams

### Fuel Bot Flow
```
User triggers updateFuelStatus (daily)
  → Clears FuelPull sheet
  → Reads character names from Settings A2:A
  → For each character:
      → GESI.corporations_corporation_structures()
      → Writes to FuelPull sheet
  → Updates timestamp in CleanData D1

CleanData sheet formulas (automatic)
  → Read from FuelPull
  → Calculate days/hours remaining
  → Format as "X days Y hours"

User triggers reportFuelStatusToDiscord (1 hour later)
  → Reads CleanData sheet
  → Categorizes: Critical/Warning/Healthy
  → Creates Discord embeds
  → Sends to webhook (Settings G2)
```

### Moon Bot Flow
```
User triggers updateMoonExtractions (daily)
  → Clears MoonPull sheet (keeps headers)
  → GESI.corporation_corporation_mining_extractions()
  → For each extraction:
      → Resolve structure ID → name
      → Resolve moon ID → name
      → Write to MoonPull sheet

Hourly trigger (reportHourlyMoonStatusToDiscord)
  → Reads MoonPull sheet
  → Calculates time until each chunk arrival
  → If within alert window (24h, 1h, or READY):
      → Creates alert embed
      → Sends to webhook (Settings G3)

Daily trigger (reportDailyMoonSummary)
  → Reads MoonPull sheet
  → Categorizes: Recent (past) / Upcoming (future)
  → Creates summary embed
  → Sends to webhook (Settings G3)
```

## Code Best Practices

### Making Changes

1. Edit `.gs` files locally for version control
2. Copy changes to Apps Script editor
3. Save in Apps Script
4. Test manually before setting triggers
5. Check Apps Script logs for errors

### Testing

**Manual Testing**:
- Use menu items to run functions
- Check Apps Script → Executions for results
- View → Logs in Apps Script for debug output

**Debug Logging**:
```javascript
Logger.log("Debug message: " + variable);
```
View logs: Apps Script editor → View → Logs (or Ctrl+Enter after running)

### Rate Limiting

**EVE ESI API**:
- 5-second delays between structure calls (fuel-tracker.gs:215)
- 100ms delays between name lookups (moon-tracker.gs:94)
- Respect these to avoid rate limiting

**Discord Webhooks**:
- No explicit rate limiting in code
- Discord allows ~30 messages per minute per webhook
- Current usage well below limit

## Advanced Topics

### Adding More Characters

Currently only Settings A2 is used. To track multiple characters:
- Add character names to A3, A4, etc.
- `updateFuelStatus()` already loops through A2:A
- Each character must be authorized via GESI
- All characters must have Station Manager or Director role

### Custom Alerts

To add custom fuel thresholds:
- Edit `reportFuelStatusToDiscord()` in fuel-tracker.gs
- Modify lines 306-312 (categorization logic)
- Adjust `daysremain` comparison values
- Update Discord colors and emoji accordingly

### Moon Alert Windows

Current windows (moon-tracker.gs:191-196):
- 24h: 24-25 hours before
- 1h: 0.5-1.5 hours before
- READY: -0.5 to +0.5 hours

To adjust:
- Modify `hoursDiff` comparison values
- Wider windows = less likely to miss alerts
- Narrower windows = fewer duplicate notifications

### Additional Sheet Formulas

CleanData formulas are created by `setupSheetsForNewUser()`:
- C1: Extracts timestamp from ISO 8601 format
- A2: Gets unique structure names from FuelPull
- B4:B104: Calculates days/hours remaining
- C4:C104: Extracts fuel expiration timestamp using XLOOKUP
- D4:D104: Extracts structure state using XLOOKUP

To modify:
- Edit formula strings in setupSheetsForNewUser() (lines 425-431)
- OR manually edit formulas in CleanData sheet
- Changes in code only apply to NEW setups

## Security Considerations

**Webhook URLs**:
- Treat as passwords - anyone with URL can post to channel
- Don't commit to public repos
- Store in Settings sheet only
- Users can regenerate in Discord if compromised

**EVE Authentication**:
- GESI manages auth tokens securely
- Tokens stored by Google, not in spreadsheet
- Limited scopes (read-only access)
- Users can revoke at https://developers.eveonline.com/

**Script Permissions**:
- Apps Script runs with user's Google account permissions
- Can access only this spreadsheet
- Can make external HTTP requests (to Discord and EVE API)
- Users must authorize on first run

**Character Roles**:
- Minimum required: Station Manager (can view structures)
- Director role also works (has Station Manager permissions)
- Script cannot modify structures, only read data

## Version History & Changes

**Recent Changes**:
- Added `reportFuelStatusToDiscordChunked()` for large structure lists (50+ structures)
- Added `reportDailyMoonSummaryChunked()` for large moon extraction lists (20+ moons)
- Added `reportHourlyMoonStatusToDiscordChunked()` for many simultaneous extractions
- Added chunked reporting menu items for both Fuel Bot and Moon Bot
- Refactored menu names: "Fuel Bot", "Moon Bot", "Setup" (from "Fuel stuff", "Moon Stuff")
- Renamed functions: `updateFuelStatus` (from `updateStationFuel`)
- Fixed GESI array parsing in moon-tracker.gs
- Widened moon alert time windows for reliability
- Consolidated setup into single function

**Known Issues**:
- None currently reported

**Future Enhancements**:
- Support for multiple corporations
- Customizable alert thresholds via Settings
- Structure type filtering
- Export to CSV functionality

## Quick Reference

**Key Files**:
- `fuel-tracker.gs`: Main script (fuel tracking + shared functions)
- `moon-tracker.gs`: Moon extraction monitoring

**Key Settings Cells**:
- `A2`: Character name
- `G2`: Fuel webhook
- `G3`: Moon webhook
- `G5`: Custom bot name (optional)
- `G8`: Custom logo URL (optional)

**Key Functions**:
- `updateFuelStatus()`: Pull fuel data
- `reportFuelStatusToDiscord()`: Send fuel report
- `reportFuelStatusToDiscordChunked()`: Send fuel report (chunked for 50+ structures)
- `updateMoonExtractions()`: Pull moon data
- `reportDailyMoonSummary()`: Send daily moon summary
- `reportDailyMoonSummaryChunked()`: Send daily moon summary (chunked for 20+ moons)
- `reportHourlyMoonStatusToDiscord()`: Send moon alerts
- `reportHourlyMoonStatusToDiscordChunked()`: Send moon alerts (chunked for many moons)
- `setupSheetsForNewUser()`: Initial setup

**GESI Library ID**:
- `1KjnRVVFr2KiHH55sqBfHcZ-yXweJ7iv89V99ubaLy4A7B_YH8rB5u0s3`

**Required Scopes**:
- `esi-corporations.read_structures.v1`
- `esi-industry.read_corporation_mining.v1`
- `esi-universe.read_structures.v1`

**Required Corp Roles**:
- Station Manager OR Director

This guide should provide everything an LLM needs to effectively assist users with setup, troubleshooting, and customization of the EVE Online Structure Manager.
