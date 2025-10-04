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

### Step 2: Install GESI Library (Required)

GESI is a library that connects Google Sheets to EVE Online's API. [GESI Documentation](https://github.com/Blacksmoke16/GESI)

1. In your Google Sheet, click **Extensions** → **Apps Script**
2. In the Apps Script editor, click the **+** next to "Libraries" on the left
3. Paste this Script ID: `1KjnRVVFr2KiHH55sqBfHcZ-yXweJ7iv89V99ubaLy4A7B_YH8rB5u0s3`
4. Click **Look up**, select the latest version, then click **Add**
5. Ensure the identifier is set to `GESI`
6. Close the Apps Script tab and return to your Google Sheet

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

### Step 5: Authenticate Your EVE Character

**If you don't have the GESI plugin installed**, see "Installing GESI Plugin" at the end of this guide.

1. Go to the **ESI_List** sheet
2. In **Cell A2**, enter your EVE character name (must be exact, case-sensitive)
3. Click **Fuel stuff** → **Update Station Fuel**
4. A GESI authorization dialog will appear - click **Authorize**
5. Sign in with your Google account and grant permissions
6. A new tab will open for EVE SSO login
7. Log in with the EVE Online account for the character you entered
8. Review the requested scopes and click **Authorize**
9. Close the EVE SSO tab and return to Google Sheets

**Required Character Roles:** Your character must have the **Station Manager** or **Director** corporation role.

### Step 6: Configure Discord Webhook

1. In the **ESI_List** sheet, enter your Discord webhook URL in **Cell G2**

**To create a Discord webhook:**
1. In Discord, go to Server Settings → Integrations → Webhooks
2. Click **New Webhook**
3. Choose the channel for notifications
4. Click **Copy Webhook URL**
5. Paste it into cell G2 of **ESI_List**

### Step 7: Set Up Automation

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

### Step 8: Test It

1. Return to your Google Sheet
2. Click **Fuel stuff** menu → **Report Status to Discord**
3. Check your Discord channel for the fuel report!

## Troubleshooting

**"GESI is not defined" error**: Go back to Step 2 and make sure you added the GESI library correctly.

**No structures showing**: Verify you have authenticated your character (step 5), your character name is spelled exactly right and that your character has the **Station Manager** or **Director** role.

**No Discord message**: Double-check your webhook URL in cell G2 of the ESI_List sheet.

**Authorization errors**: Make sure you've completed Step 5 to authenticate your EVE character.

## Optional Customization

In the **ESI_List** sheet, you can:
- **Cell G5**: Change the bot name (default: "[Your Corp] Fuel Bot")
- **Cell G8**: Use a custom logo URL (default: your corp logo)
- **Multiple Characters**: Add additional character names in cells A3, A4, etc. (each will require separate authentication)

## Installing GESI Plugin

If you don't already have the GESI plugin installed in Google Sheets:

1. In your Google Sheet, click **Extensions** → **Add-ons** → **Get add-ons**
2. Search for **GESI** in the Google Workspace Marketplace
3. Click on GESI and then click **Install**
4. Select your Google account and grant permissions
5. After installation, click **Extensions** → **GESI** → **Authorize Character**
6. Follow the authorization prompts to link your EVE Online account

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - See LICENSE file for details