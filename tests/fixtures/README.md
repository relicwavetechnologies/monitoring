# Fixture vault

Real HTML responses captured from monitored sites, used as deterministic input for unit and integration tests so we never hit live sites in CI.

## Layout

```
tests/fixtures/sites/
  <host>/
    <YYYY-MM-DD>[-<label>].html
```

The seed sites for VisaWatch:

- `in.usembassy.gov`
- `visa.vfsglobal.com`
- `www.gov.uk`
- `www.vfsglobal.com`
- `www.ica.gov.sg`

## Capturing a fixture

```bash
pnpm tsx scripts/capture-fixture.ts https://in.usembassy.gov/mumbai/ --label baseline
```

Writes to `tests/fixtures/sites/in.usembassy.gov/<today>-baseline.html`.

The capture script uses the same `fetchSite()` codepath the runtime uses, so what gets stored matches what production sees.

## When to capture

- **Once per seed site at onboarding** (the `baseline` fixture).
- **After any change is detected** — capture the post-change page so we have a regression test for the diff.
- **Before tightening filters or thresholds** — capture a few "should-be-ignored" pages so the change can be validated against history.

## Conventions

- Synthetic hand-written fixtures are allowed during early development; once a real capture exists for a host, prefer real captures.
- Don't commit fixtures over 500KB — strip embedded base64 images first.
- Don't commit anything that contains user-session tokens or PII. Inspect captured HTML before committing.
