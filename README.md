# EVE Online Structure Manager

Automatically track your structure fuel levels AND moon extractions with Discord notifications. No coding required!

## What You'll Get
### Fuel Bot
- Daily Discord updates showing which structures need fuel
- Color-coded alerts (🔴 Critical, 🟠 Warning, 🟢 Healthy)
- Automatic updates - set it once and forget it
- **Chunked reporting** for large structure lists (50+ structures) to avoid Discord size limits
<img width="333" height="532" alt="image" src="https://github.com/user-attachments/assets/0f94ac8b-4dc4-4788-be3c-c008b761e7c6" />

### Moon Bot
- Daily summary of all moon extractions
- Advance warnings: 24 hours before and 1 hour before extraction ready time
- Extraction ready notifications
- Automatic hourly monitoring
- **Chunked reporting** for large extraction lists (20+ moons) to avoid Discord limits
<img width="381" height="445" alt="image" src="https://github.com/user-attachments/assets/1bcc579e-b54d-4831-900f-2f8fa64526ce" />
<img width="269" height="160" alt="image" src="https://github.com/user-attachments/assets/7c383411-d2f8-4e81-bf98-a51fe1cfc827" />

### Customizable Corp Branding
- Automatically incorporates corp branding, including your corp's name and logo, by default. 
- Custom bot name and logo can be configured on the setting sheet.

## What You Need

1. A Google account
2. An EVE Online character with **Station Manager** or **Director** corporation role
3. A Discord server where you can create webhooks

## If You Need Help

- The **LLM_GUIDE.md** file contains everything an LLM needs to help you get set up. Point your LLM assistant at this repo or paste the guide into your chat.
- Join my Discord for questions or suggestions: [Orthel's Lab](https://discord.gg/5FdUr9KRde)

## Setup (10-15 minutes)
*Note: Some locales have different syntax. If you encounter errors, switch locale to US.*

### Step 1: Create Your Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new blank spreadsheet
2. Name it something like "EVE Structure Manager"

### Step 2: Install GESI Library (Required)

GESI is a library that connects Google Sheets to EVE Online's API. [GESI Documentation](https://github.com/Blacksmoke16/GESI)

1. In your Google Sheet, click **Extensions** → **Apps Script**
2. In the Apps Script editor, click the **+** next to "Libraries" on the left
3. Paste this Script ID: `1KjnRVVFr2KiHH55sqBfHcZ-yXweJ7iv89V99ubaLy4A7B_YH8rB5u0s3`
4. Click **Look up**, select the latest version, then click **Add**
5. Ensure the identifier is set to `GESI`
6. Leave this tab open for the next step

### Step 3: Add the Scripts

**Add Fuel Tracker:**
1. In the Apps Script editor, delete any existing code
2. Copy all the code from [fuel-tracker.gs](fuel-tracker.gs)
3. Paste it into the editor
4. Click the **Save** icon (💾)

**Add Moon Tracker:**
1. In the Apps Script editor, click the **+** next to "Files"
2. Choose "Script"
3. Name it "moon-tracker"
4. Copy all the code from [moon-tracker.gs](moon-tracker.gs)
5. Paste it into the new file
6. Click the **Save** icon (💾)
7. Close the Apps Script tab and return to your Google Sheet

### Step 4: Run Initial Setup

1. Refresh your Google Sheet page (press F5)
2. You'll see new menus at the top: **Fuel Bot**, **Moon Bot**, and **Setup**
3. Click **Setup** → **Create Fuel and Moon Sheets**
4. Google will ask for permissions:
   - Click **Continue**
   - Click **Advanced**
   - Click **Go to [your project name]** (unsafe)
   - Click **Allow**
5. The script will create several sheets in your workbook
6. Click **OK** when setup completes

### Step 5: Install and Authorize GESI Plugin

**Install GESI Plugin** (if not already installed):
1. In your Google Sheet, click **Extensions** → **Add-ons** → **Get add-ons**
2. Search for **GESI**
3. Click **Install** and grant permissions

**Authorize Your EVE Character:**
1. Go to the **Settings** sheet
2. In **Cell A2**, enter your EVE character name (exact spelling, case-sensitive)
3. Click **Extensions** → **GESI** → **Authorize Character**
4. Log in with your EVE Online account
5. Review the requested scopes and click **Authorize**
6. Close the EVE SSO tab

**Verify Authorization:**
1. Click **Fuel Bot** → **Update Fuel Status**
2. Check if the **FuelPull** sheet populates with your structures
3. If it works, you're ready to continue!

**Required Character Role:** Your character must have **Station Manager** or **Director** corporation role.

### Step 6: Configure Discord Webhooks

You need to create two Discord webhooks (or use the same one for both):

**Create Discord Webhooks:**
1. In Discord, go to **Server Settings** → **Integrations** → **Webhooks**
2. Click **New Webhook**
3. Name it "Fuel Bot", choose a channel, and click **Copy Webhook URL**
4. Paste it into cell **G2** of the **Settings** sheet
5. Create another webhook named "Moon Bot" (or reuse the same one)
6. Paste it into cell **G3** of the **Settings** sheet

### Step 7: Set Up Automation (Time-Based Triggers)

This is where you tell Google when to run each function automatically.

1. Click **Extensions** → **Apps Script**
2. Click the clock icon ⏰ on the left sidebar (Triggers)

**Create these triggers:**

**Trigger 1: Update Fuel Data**
- Click **+ Add Trigger** (bottom right)
- Function: **updateFuelStatus**
- Event source: **Time-driven**
- Type: **Day timer**
- Time: Choose when you want fuel data updated (e.g., 6am-7am)
- Click **Save**

**Trigger 2: Report Fuel to Discord**
- Click **+ Add Trigger**
- Function: **reportFuelStatusToDiscord** (or **reportFuelStatusToDiscordChunked** for 50+ structures)
- Event source: **Time-driven**
- Type: **Day timer**
- Time: Choose 1 hour AFTER Trigger 1 (e.g., 7am-8am)
- Click **Save**

**Trigger 3: Update Moon Data**
- Click **+ Add Trigger**
- Function: **updateMoonExtractions**
- Event source: **Time-driven**
- Type: **Day timer**
- Time: Choose when you want moon data updated (e.g., 6am-7am, same as Trigger 1)
- Click **Save**

**Trigger 4: Daily Moon Summary**
- Click **+ Add Trigger**
- Function: **reportDailyMoonSummary** (or **reportDailyMoonSummaryChunked** for 20+ moons)
- Event source: **Time-driven**
- Type: **Day timer**
- Time: Choose 1 hour AFTER Trigger 3 (e.g., 7am-8am)
- Click **Save**

**Trigger 5: Hourly Moon Alerts**
- Click **+ Add Trigger**
- Function: **reportHourlyMoonStatusToDiscord** (or **reportHourlyMoonStatusToDiscordChunked** for many moons)
- Event source: **Time-driven**
- Type: **Hour timer**
- Hours interval: **Every hour**
- Click **Save**

**Trigger 6: Timestamp Updates**
- Click **+ Add Trigger**
- Function: **getUtcTimestampToS2**
- Event source: **Time-driven**
- Type: **Hour timer**
- Hours interval: **Every 6 hours**
- Click **Save**

### Step 8: Test It!

**Test Fuel Bot:**
1. Return to your Google Sheet
2. Click **Fuel Bot** → **Report Fuel Status to Discord**
3. Check your Discord channel for the fuel report

**Test Moon Bot:**
1. Click **Moon Bot** → **Update Moon Extractions** (this pulls current extraction data)
2. Click **Moon Bot** → **Report Moon Status to Discord**
3. Check your Discord channel for the moon extraction report

If you see the reports in Discord, you're all set!

## Troubleshooting

**"GESI is not defined" error**
- Go back to Step 2 and verify the GESI library is added correctly
- Make sure the identifier is exactly `GESI` (case-sensitive)

**No structures showing up**
- Verify your character name in Settings A2 is spelled exactly right (case-sensitive)
- Ensure your character has **Station Manager** or **Director** role
- Click **Extensions** → **GESI** → **Authorize Character** to reauthorize

**No Discord messages**
- Double-check webhook URLs in Settings G2 (fuel) and G3 (moon)
- Test the webhook by pasting it in a browser - you should see a JSON response

**"Authorization failed" errors**
- Make sure you completed Step 5 to authorize your character
- Try clicking **Extensions** → **GESI** → **Authorize Character** again

**Empty moon extraction list**
- This is normal if your corporation has no active moon extractions
- Start a moon extraction in-game and run **Moon Bot** → **Update Moon Extractions** again

**Discord errors with large structure lists (50+ structures)**
- Discord has a 4096 character limit per message embed
- Use **Fuel Bot** → **Report Fuel Status to Discord (Chunked)** instead
- Or set your trigger to use `reportFuelStatusToDiscordChunked` function
- This splits large reports into multiple messages automatically

**Discord errors with large moon extraction lists (20+ moons)**
- Discord has a limit of 25 fields per embed
- Use **Moon Bot** → **Report Moon Status to Discord (Chunked)** instead
- Or set your triggers to use `reportDailyMoonSummaryChunked` and `reportHourlyMoonStatusToDiscordChunked`
- This splits large reports into multiple messages automatically

**Editing .gs files locally**
- The `.gs` extension may not be recognized by your code editor
- Configure your editor to treat `.gs` files as JavaScript
- Example for VSCode: Add `"*.gs": "javascript"` to file associations

## Optional Customization

In the **Settings** sheet:
- **Cell G5**: Change the bot name (default: "[Your Corp] Fuel Bot" or "[Your Corp] Mining Bot")
- **Cell G8**: Use a custom logo URL (default: your corporation logo)

## How It Works

**Fuel Bot:**
- Checks structure fuel levels daily
- Categorizes structures: Critical (<3 days), Warning (3-7 days), Healthy (>7 days)
- Sends one Discord message per day with all structures organized by urgency

**Moon Bot:**
- Checks moon extraction times hourly
- Sends alerts when extractions are 24 hours away, 1 hour away, or ready now
- Sends a daily summary of all recent and upcoming extractions

## Sheet Reference

After setup, your spreadsheet will contain:
- **Settings**: Character name and Discord webhooks
- **FuelPull**: Raw fuel data from EVE API
- **CleanData**: Processed fuel data with calculated expiration times
- **MoonPull**: Moon extraction data with structure/moon names and times
- **Instructions**: Quick setup reminders

## Contributing

Feel free to submit issues and enhancement requests! PRs are welcome.




## License

MIT License - See LICENSE file for details
