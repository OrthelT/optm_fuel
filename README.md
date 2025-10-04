# EVE Online Structure Fuel Tracker

Automatically track your structure fuel levels and get daily Discord notifications. No coding required!

## What You'll Get

- Daily Discord updates showing which structures need fuel
- Color-coded alerts (🔴 Critical, 🟠 Warning, 🟢 Healthy)
- Automatic updates - set it once and forget it
- Supports multiple characters and structures

## What You Need

1. A Google account
2. An EVE Online character with permission to view your structures
3. A Discord server where you can create a webhook

## Setup (15 minutes)

### Step 1: Create Your Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new blank spreadsheet
2. Name it something like "EVE Fuel Tracker"

### Step 2: Install GESI (EVE API Connection)

GESI is a library that connects Google Sheets to EVE Online's API. [Learn more about GESI](https://github.com/Blacksmoke16/GESI)

1. In your Google Sheet, click **Extensions** → **Apps Script**
2. In the Apps Script editor, click the **+** next to "Libraries" on the left
3. Paste this Script ID: `1T9dLrcriMPPYiFNiOSrAeGBj3M6Rf2RLvXaNPe_MNk5QjWF1kEPmN88M`
4. Click **Look up**, then click **Add**
5. Close the Apps Script tab and return to your Google Sheet

### Step 3: Add the Fuel Tracker Script

1. In your Google Sheet, click **Extensions** → **Apps Script** again
2. Delete any existing code in the editor
3. Copy all the code from [fuel-tracker.gs](fuel-tracker.gs) and paste it into the editor
4. Click the **Save** icon (💾)
5. Close the Apps Script tab and return to your Google Sheet

### Step 4: Run Initial Setup

1. Refresh your Google Sheet page (press F5)
2. You'll see a new menu called **Setup** at the top
3. Click **Setup** → **Setup**
4. Google will ask for permissions - click **Continue** → **Advanced** → **Go to [your project name]** → **Allow**
5. The script will create several sheets in your workbook

### Step 5: Configure Your Settings

1. Go to the **ESI_List** sheet
2. In the yellow cells, enter:
   - **Cell A2**: Your EVE character name (must be exact, case-sensitive)
   - **Cell G2**: Your Discord webhook URL (see below to create one)
3. Add more character names in A3, A4, etc. if you have multiple characters

**To create a Discord webhook:**
1. In Discord, go to Server Settings → Integrations → Webhooks
2. Click **New Webhook**
3. Choose the channel for notifications
4. Click **Copy Webhook URL**
5. Paste it into cell G2

### Step 6: Set Up Automation

1. Click **Extensions** → **Apps Script**
2. Click the clock icon ⏰ on the left (Triggers)
3. Click **+ Add Trigger** (bottom right) and configure:
   - Function: **updateStationFuel**
   - Event source: **Time-driven**
   - Type: **Day timer**
   - Time: Choose when you want updates (e.g., 8am-9am)
   - Click **Save**

4. Click **+ Add Trigger** again:
   - Function: **reportStatusToDiscord**
   - Event source: **Time-driven**
   - Type: **Day timer**
   - Time: Choose 1 hour after the previous trigger
   - Click **Save**

5. Click **+ Add Trigger** one more time:
   - Function: **getUtcTimestampToS2**
   - Event source: **Time-driven**
   - Type: **Hours timer**
   - Hours interval: **Every 6 hours**
   - Click **Save**

### Step 7: Test It

1. Return to your Google Sheet
2. Click **Fuel stuff** menu → **Update Station Fuel**
3. Wait 30 seconds, then click **Fuel stuff** → **Report Status to Discord**
4. Check your Discord channel for the fuel report!

## Troubleshooting

**"GESI is not defined" error**: Go back to Step 2 and make sure you added the GESI library correctly.

**No structures showing**: Verify your character name is spelled exactly right and that your character has permission to view structures.

**No Discord message**: Double-check your webhook URL in cell G2 of the ESI_List sheet.

## Optional Customization

In the **ESI_List** sheet, you can:
- **Cell G5**: Change the bot name (default: "[Your Corp] Fuel Bot")
- **Cell G8**: Use a custom logo URL (default: your corp logo)

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - See LICENSE file for details 