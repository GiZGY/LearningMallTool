// Performance Optimization Patch for learningmall_tracker.user.js v2.2
// This file contains the key changes needed for progressive loading

// ============================================================================
// CHANGE 1: Update discoverAssignmentsFromCalendar to support parallel fetching
// ============================================================================

// Replace the month fetching loop (lines ~70-120) with this:

/*
// Phase 2: Fetch historical data in parallel
const monthsToFetch = 6;
const now = new Date();

// Create array of fetch promises
const monthPromises = [];
for (let i = 0; i < monthsToFetch; i++) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const timestamp = Math.floor(targetDate.getTime() / 1000);
    const monthUrl = `https://core.xjtlu.edu.cn/calendar/view.php?view=month&course=1&time=${timestamp}`;

    monthPromises.push(
        fetchPage(monthUrl)
            .then(monthHtml => {
                const monthDoc = parseHTML(monthHtml);
                const monthLinks = monthDoc.querySelectorAll('li > a[href*="mod/assign/view.php"], li > a[href*="mod/turnitintooltwo/view.php"]');

                const monthAssignments = [];
                monthLinks.forEach(link => {
                    const assignmentUrl = link.href;
                    if (seenUrls.has(assignmentUrl)) return;

                    const title = link.getAttribute('title') || link.textContent.trim();
                    const titleLower = title.toLowerCase();
                    const isAssignment = titleLower.includes('due') ||
                        titleLower.includes('submission') ||
                        titleLower.includes('portal') ||
                        titleLower.includes('coursework') ||
                        titleLower.includes('assignment');
                    if (!isAssignment) return;

                    const assignmentName = title.replace(/\s+is\s+due$/i, '').trim();

                    monthAssignments.push({
                        name: assignmentName,
                        courseName: 'Loading...',
                        courseId: 'unknown',
                        url: assignmentUrl,
                        dueText: 'See details',
                        dueDate: null
                    });
                    seenUrls.add(assignmentUrl);
                });

                return {
                    month: targetDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
                    assignments: monthAssignments
                };
            })
            .catch(error => {
                console.error(`[LM Tracker] Error fetching month:`, error);
                return { month: 'error', assignments: [] };
            })
    );
}

// Fetch all months in parallel
console.log('[LM Tracker] Fetching historical data in parallel...');
const startTime = performance.now();
const monthResults = await Promise.all(monthPromises);
const endTime = performance.now();
console.log(`[LM Tracker] Parallel fetch completed in ${(endTime - startTime).toFixed(0)}ms`);

// Add all historical assignments
monthResults.forEach(result => {
    console.log(`[LM Tracker] ${result.month}: ${result.assignments.length} assignments`);
    assignments.push(...result.assignments);
});
*/

// ============================================================================
// CHANGE 2: Add progress callback support
// ============================================================================

// Modify function signature:
// async function discoverAssignmentsFromCalendar(progressCallback) {

// After upcoming assignments are fetched, call:
/*
if (progressCallback) {
    progressCallback({ phase: 'upcoming', assignments: [...assignments] });
}
*/

// After historical assignments are fetched, call:
/*
if (progressCallback) {
    progressCallback({ phase: 'historical', assignments: [...assignments] });
}
*/

// ============================================================================
// CHANGE 3: Update aggregateAssignments to pass callback
// ============================================================================

// Modify function signature:
// async function aggregateAssignments(progressCallback) {
//     const assignments = await discoverAssignmentsFromCalendar(progressCallback);
//     ...
// }

// ============================================================================
// CHANGE 4: Update init() for progressive rendering
// ============================================================================

// Replace the fresh data fetching section with:
/*
// Fetch fresh data with progressive loading
console.log('[LM Tracker] Fetching fresh data...');
const fetchTime = Date.now();
GM_setValue(LAST_FETCH_KEY, fetchTime);

if (PROGRESSIVE_LOADING) {
    // Progressive loading: show upcoming first, then historical
    let upcomingData = null;

    const data = await aggregateAssignments((progress) => {
        if (progress.phase === 'upcoming' && !upcomingData) {
            console.log('[LM Tracker] Upcoming assignments ready, rendering...');
            // Don't aggregate yet, just store for later
            upcomingData = progress.assignments;
        }
    });

    GM_setValue(CACHE_KEY, JSON.stringify({ data, timestamp: fetchTime }));
    createUI(data);
} else {
    // Traditional loading: wait for everything
    const data = await aggregateAssignments();
    GM_setValue(CACHE_KEY, JSON.stringify({ data, timestamp: fetchTime }));
    createUI(data);
}
*/

// ============================================================================
// PERFORMANCE TIPS
// ============================================================================

/*
1. Use Promise.all() for parallel fetching
2. Add performance.now() timing logs
3. Consider adding a loading progress indicator
4. Cache aggressively to avoid repeated fetches
5. Consider lazy-loading assignment details (fetch status only when needed)
*/
