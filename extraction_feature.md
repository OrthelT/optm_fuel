# Extraction Monitor Instructions

## Project Goals
Create additional functionality in the OPTM_Fuel Project for a Discord bot to monitor moon extractions that functions that works similarly to the existing Discord bot for structure fuel. This is a local copy of the code that runs as a Google App Script in Google Sheets. This new functionality should:
- Be segregated from the existing functionality, operating independently with its own script within the same Google sheet. 
- Send a ping to Discord once daily, with additional pings one day and one hour before extraction times. It should send a final ping at extraction time. 
- The extraction monitor should use GESI for ESI access using the character configuration for the existing fuel bot functionality.

## RESOURCES
The existing Google Sheet is here:
https://docs.google.com/spreadsheets/d/18icwZ7In9UIn495vxVdQJcLrYmvyjGVDLCqvPGArT44/edit?usp=sharing

The Discord web hook should be easily configurable for alternate Discord servers. This is the current testing webhook for the moon extraction function. It can also be found in cell G3 of the ESI_list sheet. 
https://discord.com/api/webhooks/1443330282903306261/VOWsG9E7y-0qxjP7pKl8_63K6d78kKS8Jm7IRmuS-ttrjfkJtAYWReSVZfRy2AM-bWXt

If authenticated access to the Google sheet is required, a token is available for the configured Google Service account in the project root directory. This token is for your temporary use and will be disabled once development is complete and replaced with a new token, if one is needed, to ensure security.
wcupdates-fecbc9769ec7.json

