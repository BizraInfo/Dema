# Deploy Checklist

1. Tag the release.
2. Build depot bundle.
3. Push to the three depot controllers.
4. Verify `/health` on each.
5. Watch error rate for 30 minutes.

Rollback: _to be written_.

Note: step 5 assumes someone is watching. On the last two deploys nobody was.
