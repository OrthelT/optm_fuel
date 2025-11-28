# Extraction Monitor Instructions

## Project Status
✅ **COMPLETED** - Moon extraction monitoring functionality has been implemented and refactored.

## Implementation Details
The moon extraction monitor has been implemented in `moon-extraction.gs` with the following features:
- **Segregated functionality**: Operates independently with its own script within the same Google sheet
- **Discord notifications**: Sends daily summary plus alerts at 24h, 1h, and when extraction is ready
- **GESI integration**: Uses the same character authentication as the fuel bot (Settings A2)
- **Shared resources**: Reuses functions from fuel-tracker.gs (GetCharInfo, getCorpName, getCorpLogoUrl, sendToDiscord)

## Project Goals (Original Requirements)
Create additional functionality in the OPTM_Fuel Project for a Discord bot to monitor moon extractions that functions that works similarly to the existing Discord bot for structure fuel. This is a local copy of the code that runs as a Google App Script in Google Sheets. This new functionality should:
- ✅ Be segregated from the existing functionality, operating independently with its own script within the same Google sheet
- ✅ Send a ping to Discord once daily, with additional pings one day and one hour before extraction times. It should send a final ping at extraction time
- ✅ The extraction monitor should use GESI for ESI access using the character configuration for the existing fuel bot functionality

## RESOURCES
The existing Google Sheet is here:
https://docs.google.com/spreadsheets/d/18icwZ7In9UIn495vxVdQJcLrYmvyjGVDLCqvPGArT44/edit?usp=sharing

The Discord web hook should be easily configurable for alternate Discord servers. This is the current testing webhook for the moon extraction function. It can also be found in cell G3 of the ESI_list sheet. 
https://discord.com/api/webhooks/1443330282903306261/VOWsG9E7y-0qxjP7pKl8_63K6d78kKS8Jm7IRmuS-ttrjfkJtAYWReSVZfRy2AM-bWXt

If authenticated access to the Google sheet is required, a token is available for the configured Google Service account in the project root directory. This token is for your temporary use and will be disabled once development is complete and replaced with a new token, if one is needed, to ensure security.
wcupdates-fecbc9769ec7.json


[GESI documentation](https://github.com/Blacksmoke16/GESI/blob/master/src/script/src/functions.ts) - Google Sheets client for Eve ESI.

[ESI documentation](https://developers.eveonline.com/api-explorer) - Documentation for the Eve online ESI.

## Refactoring Changes

The following critical issues were identified and fixed:

### 1. Incorrect GESI Function Arguments
**Issue**: `corporations_corporation_mining_extractions` was being called with `corpId` (a number) instead of character name.
- **Before**: `GESI.corporations_corporation_mining_extractions("en", corpId)`
- **After**: `GESI.corporations_corporation_mining_extractions("en", characterName)`
- **Fix**: Now retrieves character name from Settings A2 for authentication

### 2. GESI Array Response Handling
**Issue**: Code attempted to access GESI responses as objects (e.g., `ex.structure_id`) when GESI returns 2D arrays.
- **Fix**: Implemented proper array indexing by:
  - Reading column headers from row 0
  - Using `indexOf()` to find column positions
  - Accessing data by array indices instead of property names
  - Skipping header row when iterating (start from index 1)

### 3. Structure and Moon Name Lookups
**Issue**: `getStructureName()` and `getMoonName()` functions also had incorrect response handling.
- **Fix**: Updated both functions to:
  - Accept and pass character name for authentication (structures only)
  - Parse GESI's 2D array responses correctly
  - Extract 'name' field using header-based indexing

### 4. Notification Time Windows
**Issue**: Original time windows (23-24h, 0-1h) were too narrow and could miss notifications if hourly trigger didn't align perfectly.
- **Fix**: Widened windows to:
  - 24h warning: 23-25 hours (2-hour window)
  - 1h warning: 0.5-1.5 hours (1-hour window)
  - Ready: -0.5 to 0.5 hours (1-hour window)

### 5. Code Cleanup
- Removed unused variables (`hasUpdates`, `activeExtractions`, `embeds`)
- Added comprehensive comments explaining GESI response format
- Improved error handling and logging

## Testing Recommendations

1. **Setup**: Run "Moon Stuff → Setup Moon Sheets" to create required sheets
2. **Data Pull**: Run "Moon Stuff → Update Moon Extractions" to test GESI integration
3. **Verify**: Check MoonPull sheet for populated extraction data
4. **Hourly Test**: Run "Moon Stuff → Report Moon Status (Hourly)" to test Discord alerts
5. **Daily Test**: Run "Moon Stuff → Report Daily Summary" to test daily notifications

## Trigger Setup

For automated operation, configure these Google Apps Script triggers:
1. **updateMoonExtractions**: Daily at a configured time (e.g., 06:00)
2. **reportMoonStatusToDiscord**: Hourly
3. **reportDailyMoonSummary**: Daily at a configured time (e.g., 08:00)
