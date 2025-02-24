# EVE Online Structure Fuel Tracker

A Google Apps Script project that automates fuel status tracking for EVE Online structures. This script integrates with Google Sheets, EVE Online's ESI API (via GESI), and Discord to provide timely updates about structure fuel levels.

## Features

- Automatically pulls structure fuel data from EVE Online using GESI
- Processes and cleans the data in Google Sheets
- Sends formatted fuel status updates to Discord
- Supports multiple structures and corporations
- Provides time-based automated updates
- Custom Google Sheets menu for manual operations

## Prerequisites

1. Google Sheets account
2. [GESI](https://blacksmoke16.github.io/GESI/) setup for EVE Online API access
3. Discord webhook URL for notifications
4. EVE Online character(s) with appropriate structure viewing permissions

## Setup Instructions

1. Create a new Google Sheet
2. Set up GESI following instructions at https://blacksmoke16.github.io/GESI/
3. Copy the script code to Google Apps Script editor
4. Run the setup function from the "Setup" menu
5. Follow the instructions provided in the "Instructions" sheet:
   - Enter EVE character names in the ESI_List sheet
   - Configure Discord webhook URL
   - Set up time-based triggers for automated updates

## Sheets Structure

The script creates and manages several sheets:
- **Pull**: Raw data from EVE Online API
- **ESI_List**: Configuration for character names and Discord webhook
- **CleanData**: Processed fuel status data
- **Instructions**: Setup and configuration instructions

## Time-Based Triggers

The script uses three main time-based triggers:
1. `getUtcTimestampToS2`: Runs every 6 hours
2. `updateStationFuel`: Runs daily at a specified time
3. `reportStatusToDiscord`: Runs daily, one hour after updateStationFuel

## Discord Notifications

The script sends formatted messages to Discord including:
- Structure names
- Time remaining until fuel expiration
- Relative and absolute timestamps
- Visual emphasis for structures with less than 7 days of fuel

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - See LICENSE file for details 