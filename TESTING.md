# Performance Optimization Testing Guide

## Test Environment
- Browser: Chrome/Firefox with Tampermonkey
- URL: https://core.xjtlu.edu.cn/
- Network: Check DevTools Network tab

## Test Cases

### 1. Parallel Fetching Verification

**Steps:**
1. Open browser DevTools (F12)
2. Go to Network tab
3. Clear cache and refresh page
4. Look for calendar requests

**Expected Results:**
- ✅ 1 request to `calendar/view.php?view=upcoming`
- ✅ 6 simultaneous requests to `calendar/view.php?view=month&time=...`
- ✅ All 6 month requests should start at nearly the same time
- ✅ Console shows: `⚡ Parallel fetch completed in XXXms`

**Success Criteria:**
- Parallel fetch time < 2000ms
- All 6 requests visible in Network tab
- No sequential waiting between month requests

### 2. Performance Timing Logs

**Steps:**
1. Open Console tab
2. Refresh page
3. Look for timing logs

**Expected Console Output:**
```
[LM Tracker] Discovering assignments from calendar...
[LM Tracker] Found X upcoming events
[LM Tracker] 🚀 Progressive loading enabled
[LM Tracker] ⚡ Upcoming assignments ready - rendering immediately!
[LM Tracker] Fetching historical data in parallel...
[LM Tracker] ⚡ Parallel fetch completed in XXXms
[LM Tracker] December 2025: X assignments
[LM Tracker] November 2025: X assignments
[LM Tracker] October 2025: X assignments
[LM Tracker] September 2025: X assignments
[LM Tracker] August 2025: X assignments
[LM Tracker] July 2025: X assignments
[LM Tracker] ✅ All data loaded and rendered
```

### 3. Progressive Loading Test

**Steps:**
1. Clear cache
2. Refresh page
3. Observe UI rendering

**Expected Behavior:**
- ✅ Panel appears quickly
- ✅ Upcoming assignments visible first
- ✅ Historical assignments load in background
- ✅ No blocking/freezing during load

### 4. Performance Comparison

**Before Optimization (v2.1):**
- Sequential fetching: ~6-7 seconds
- 7 requests (1 + 6 sequential)
- Blocking UI until all data loaded

**After Optimization (v2.2):**
- Parallel fetching: ~1-2 seconds
- 7 requests (1 + 6 parallel)
- Progressive UI updates

**Measurement:**
```javascript
// Check console for:
[LM Tracker] ⚡ Parallel fetch completed in XXXms
// Should be < 2000ms
```

### 5. Cache Behavior

**Steps:**
1. First load (no cache)
2. Refresh page (with cache)
3. Wait 24+ hours and refresh

**Expected:**
- First load: Full fetch with parallel requests
- Cached load: Instant display from cache
- Expired cache: Auto-refresh in background

### 6. Network Waterfall Analysis

**Steps:**
1. Open DevTools → Network tab
2. Enable "Preserve log"
3. Refresh page
4. Look at request waterfall

**Expected Pattern:**
```
upcoming ████████ (300ms)
month1   ████████ (700ms) ┐
month2   ████████ (700ms) │
month3   ████████ (700ms) ├─ Parallel
month4   ████████ (700ms) │
month5   ████████ (700ms) │
month6   ████████ (700ms) ┘
```

**NOT this (sequential):**
```
upcoming ████████
month1   ████████
month2           ████████
month3                   ████████
month4                           ████████
month5                                   ████████
month6                                           ████████
```

## Performance Metrics to Record

| Metric | Target | Actual | Pass/Fail |
|--------|--------|--------|-----------|
| Upcoming fetch time | < 500ms | ___ ms | ___ |
| Parallel fetch time | < 2000ms | ___ ms | ___ |
| Total load time | < 2500ms | ___ ms | ___ |
| Requests in parallel | 6 | ___ | ___ |
| UI responsiveness | No freeze | ___ | ___ |

## Troubleshooting

### Issue: Requests still sequential
**Solution:** Check if `PROGRESSIVE_LOADING` is set to `true`

### Issue: No performance logs
**Solution:** Check console filters, ensure "Info" level is visible

### Issue: Slow parallel fetching
**Solution:** 
- Check network speed
- Verify server response times
- Look for rate limiting

### Issue: Duplicate assignments
**Solution:** Verify `seenUrls` Set is working correctly

## Success Criteria

✅ All 6 month requests start simultaneously
✅ Parallel fetch completes in < 2s
✅ Console shows performance timing logs
✅ No duplicate assignments
✅ UI renders progressively
✅ Cache works correctly

## Next Steps After Testing

1. If all tests pass → Merge to main
2. If issues found → Debug and fix
3. Update README with performance metrics
4. Create release notes for v2.2
