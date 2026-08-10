# Make the scan confirmation template configurable

Right now the Follow Me opt-in always sends `tag_scan_v5`. If that template has an approval or parameter problem, there is no way to switch it without a code change. This makes the confirmation template a setting you control, and lets you test any template before committing to it.

## What changes

1. **A "Scan confirmation template" setting** in Settings > Automations, next to the existing live delivery test. It lists the approved TAG templates (`tag_scan_v5`, `tag_interest`, `tag_lastunit`, `tag_valuechange`) plus a free-text field so you can type a newly approved template name.

2. **Both Follow Me paths use the setting.** The barcode-reader route and the scan passport page read the configured template instead of the hard-coded `tag_scan_v5`. If nothing is configured, `tag_scan_v5` stays the default, so behaviour is unchanged until you switch it.

3. **Template contracts stay enforced.** Each template still declares its language, header type and body placeholders, so a switch cannot silently send the wrong shape. Choosing a template with body variables (like `tag_valuechange`) fills them from the product's price data; a template we have no contract for is treated as image-header with no body variables, and if the send is rejected the exact provider reason is surfaced.

4. **Test before going live.** The existing "Live Infobip delivery test" gains a template picker and a recipient field, so you can fire any template at your own number and read back the real delivery status and any provider error code.

## Verification

- Send each candidate template to +27 82 801 4801 from the test panel and record which reach DELIVERED.
- Set the winning one as the scan confirmation template.
- Do a real Follow Me on a scanned product and confirm the message arrives.

## Technical notes

- New setting key `scan_confirmation_template`, read server-side by `src/routes/api/public/scan.barcode-interest.ts` and `src/routes/api/public/scan.interest.ts`.
- `src/lib/whatsapp-templates.server.ts`: expose the contract list to the settings UI and add a permissive fallback contract for unknown names.
- `src/components/settings/automation-settings.tsx`: template select + test-recipient input; the test reuses the existing runtime adapter (direct fetch with database relay fallback), so it exercises the same credential binding as production.
- No schema change beyond the settings row; no changes to notification rules or AI features.
