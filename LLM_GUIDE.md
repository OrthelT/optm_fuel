# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This file documents the original version of this project and has since been updated with new features for moon extraction notifications. See extraction_feature.md for details.  

## Project Overview

EVE Online Structure Fuel Tracker - A Google Apps Script project that automates fuel status tracking for EVE Online structures. Integrates with Google Sheets, EVE Online's ESI API (via GESI), and Discord webhooks to provide automated fuel level updates.

## Technology Stack

- **Runtime**: Google Apps Script (JavaScript environment)
- **Data Storage**: Google Sheets
- **External Dependencies**:
  - GESI (Google ESI library) - Required for EVE Online API access
  - Discord webhooks for notifications

## Architecture

### Core Script: fuel-tracker.gs

The single-file application follows a functional architecture with time-triggered automation:

**Main Entry Points:**
- `onOpen()`: Creates custom menu UI in Google Sheets
- `setupSheetsForNewUser()`: Initial setup that creates required sheets and formulas
- `updateStationFuel()`: Data collection function (triggered daily)
- `reportStatusToDiscord()`: Discord notification function (triggered daily, 1 hour after data update)
- `getUtcTimestampToS2()`: Timestamp tracking (triggered every 6 hours)

**Data Flow:**
1. `updateStationFuel()` pulls structure data via GESI → writes to "Pull" sheet
2. "CleanData" sheet processes raw data using formulas (XLOOKUP, text parsing)
3. `reportStatusToDiscord()` reads "CleanData" → categorizes structures → sends formatted Discord embeds

**Sheet Structure:**
- **Pull**: Raw API data from EVE Online (cleared and refreshed on each update)
- **Settings**: Configuration (character name in A2, Discord webhook in G2, optional bot customization in G5/G8)
- **CleanData**: Computed fuel status with formulas (rows 4-104 for up to 100 structures)
- **Instructions**: Setup guidance for end users

### Key Functions

- `updateStationFuel()`: Fetches structure data for the character in Settings A2, calls GESI API, populates Pull sheet
- `reportStatusToDiscord()`: Categorizes structures into critical (<3 days), warning (3-7 days), healthy (>7 days), creates color-coded Discord embeds
- `GetCharInfo()`: Retrieves character data for the main character (Settings A2)
- `getCorpName()` / `getCorpLogoUrl()`: Fetches corporation info for Discord bot identity
- `sortFunction()`: Custom comparator for alphabetically sorting structure arrays

### Time-Based Triggers

Three scheduled functions maintain automation:
1. `getUtcTimestampToS2` - Every 6 hours (updates timestamp in CleanData D1)
2. `updateStationFuel` - Daily at configured time
3. `reportStatusToDiscord` - Daily, 1 hour after updateStationFuel

## Setup Instructions

### Installing GESI Library (Required)

1. Open your Google Sheet and go to **Extensions → Apps Script**
2. In the Apps Script editor, click the **+** next to "Libraries" in the left sidebar
3. Enter Script ID: `1KjnRVVFr2KiHH55sqBfHcZ-yXweJ7iv89V99ubaLy4A7B_YH8rB5u0s3`
4. Click **Look up** → Select the latest version → Click **Add**
5. Set the identifier to `GESI` (if not already set)

### Installing GESI Plugin

If you don't already have the GESI plugin installed in Google Sheets:

1. In your Google Sheet, click **Extensions** → **Add-ons** → **Get add-ons**
2. Search for **GESI** in the Google Workspace Marketplace
3. Click on GESI and then click **Install**
4. Select your Google account and grant permissions

### Authenticating Characters

1. In your Google Sheet, enter a character name in the **Settings** sheet (cell A2)
2. Click **Extensions** → **GESI** → **Authorize Character**
3. A new tab will open for EVE SSO login
4. Log in with the EVE Online account for the character you entered
5. Review the requested scopes and click **Authorize**
6. Close the EVE SSO tab and return to Google Sheets
7. Run **Fuel stuff → Update Structure Fuel** to verify authentication worked

**Required Character Roles:**
- The character must have the **Station Manager** or **Director** corporation role to access structure data

## Development Notes

**Editing the Script:**
- The script is deployed in Google Apps Script (Extensions → Apps Script from Google Sheets)
- Local `.gs` file is for version control; actual execution happens in Google Apps Script environment
- Test functions using the custom "Fuel stuff" menu in Google Sheets or the Apps Script editor

**GESI Integration:**
- GESI must be added as a library in Apps Script (Script ID: 1KjnRVVFr2KiHH55sqBfHcZ-yXweJ7iv89V99ubaLy4A7B_YH8rB5u0s3)
- Primary GESI calls:
  - `GESI.corporations_corporation_structures()` - Fetch structure data
  - `GESI.getCharacterData()` - Fetch character info
  - `GESI.corporations_corporation()` - Fetch corporation name

**Discord Integration:**
- Uses rich embeds with color coding (red/orange/green)
- Supports custom bot name and avatar URL (configured in Settings G5/G8)
- Webhook URL stored in Settings G2

**Formula Dependencies:**
- CleanData sheet relies heavily on XLOOKUP and date/time calculations
- Column C in CleanData shows fuel expiration timestamps
- Column B computes "X days Y hours" format from timestamps

## Important Constraints

**Cannot be run locally:** This is a Google Apps Script project that MUST run within Google's infrastructure. The `.gs` file is for version control only. All testing and execution happens in the Google Apps Script editor accessed via Extensions → Apps Script in Google Sheets.

**No package.json or dependencies:** Google Apps Script uses libraries added through the Apps Script editor interface, not npm or package managers. GESI is added via Script ID, not installed as a traditional dependency.

**Sheet formulas are critical:** The CleanData sheet contains Excel-like formulas that process the raw data. These formulas are created programmatically by `setupSheetsForNewUser()` and should not be manually modified unless you understand the data flow.

## Common Issues

- "GESI undefined" errors indicate GESI library is not enabled in Apps Script Libraries
- Character names must exactly match EVE Online character names (case-sensitive)
- Characters must have appropriate corporation roles to view structure data
- Rate limiting: 5-second delays between API calls to avoid ESI rate limits

## Making Changes

**To modify the script:**
1. Edit fuel-tracker.gs locally for version control
2. Copy the entire contents into the Google Apps Script editor
3. Save and test using the "Fuel stuff" menu or run functions directly in the editor

**To add new features:**
- New GESI API calls: Refer to [GESI documentation](https://github.com/Blacksmoke16/GESI)
- Discord formatting: Uses Discord embed format (not standard markdown)
- Sheet manipulation: Use SpreadsheetApp API (Google Apps Script specific)

**Testing without triggers:**
- Run `updateStationFuel()` manually from Fuel stuff menu
- Run `reportStatusToDiscord()` manually to test Discord output
- Check Apps Script logs: View → Logs in the Apps Script editor

