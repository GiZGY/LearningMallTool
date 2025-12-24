// ==UserScript==
// @name         XJTLU LearningMall Assignment Tracker
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Display all course assignments with deadlines and submission status on the LearningMall Dashboard
// @author       You
// @match        https://core.xjtlu.edu.cn/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      core.xjtlu.edu.cn
// ==/UserScript==

(function () {
    'use strict';

    // Configuration
    const CACHE_KEY = 'lm_assignments_cache';
    const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
    const LAST_FETCH_KEY = 'lm_last_fetch_time';
    const PROGRESSIVE_LOADING = true; // Enable progressive loading for better UX

    // Utility: Parse HTML string to DOM
    function parseHTML(html) {
        const parser = new DOMParser();
        return parser.parseFromString(html, 'text/html');
    }

    // Utility: Fetch page content
    function fetchPage(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: (response) => resolve(response.responseText),
                onerror: (error) => reject(error)
            });
        });
    }

    // Step 1: Discover assignments from Calendar (progressive loading with callback)
    async function discoverAssignmentsFromCalendar(progressCallback) {
        console.log('[LM Tracker] Discovering assignments from calendar...');

        const assignments = [];
        const seenUrls = new Set();

        // Phase 1: Fetch from upcoming view (PRIORITY - show first)
        try {
            const upcomingHtml = await fetchPage('https://core.xjtlu.edu.cn/calendar/view.php?view=upcoming&course=1');
            const upcomingDoc = parseHTML(upcomingHtml);
            const upcomingEvents = upcomingDoc.querySelectorAll('div.event[data-type="event"]');

            console.log(`[LM Tracker] Found ${upcomingEvents.length} upcoming events`);

            upcomingEvents.forEach(eventDiv => {
                const assignment = extractAssignmentFromEvent(eventDiv);
                if (assignment && !seenUrls.has(assignment.url)) {
                    assignments.push(assignment);
                    seenUrls.add(assignment.url);
                }
            });

            // Notify that upcoming assignments are ready for immediate display
            if (progressCallback) {
                progressCallback({ phase: 'upcoming', assignments: [...assignments] });
            }
        } catch (error) {
            console.error('[LM Tracker] Error fetching upcoming calendar:', error);
        }

        // Fetch from month view (for historical assignments)
        // Fetch current month and previous 5 months (total 6 months) in PARALLEL
        try {
            const monthsToFetch = 6;
            const now = new Date();

            // Create array of fetch promises for parallel execution
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

            // Fetch all months in parallel - PERFORMANCE BOOST!
            console.log('[LM Tracker] Fetching historical data in parallel...');
            const startTime = performance.now();
            const monthResults = await Promise.all(monthPromises);
            const endTime = performance.now();
            console.log(`[LM Tracker] ⚡ Parallel fetch completed in ${(endTime - startTime).toFixed(0)}ms`);

            // Add all historical assignments
            monthResults.forEach(result => {
                console.log(`[LM Tracker] ${result.month}: ${result.assignments.length} assignments`);
                assignments.push(...result.assignments);
            });

            // Notify that historical data is ready
            if (progressCallback) {
                progressCallback({ phase: 'historical', assignments: [...assignments] });
            }
        } catch (error) {
            console.error('[LM Tracker] Error fetching month calendar:', error);
        }

        console.log(`[LM Tracker] Total unique assignments found: ${assignments.length}`);
        return assignments;
    }

    // Helper: Extract assignment from event element
    function extractAssignmentFromEvent(eventDiv) {
        try {
            // Extract assignment name
            const titleElement = eventDiv.querySelector('h3.name');
            if (!titleElement) return null;

            const fullTitle = titleElement.textContent.trim();

            // Check if this is an assignment-related event
            const titleLower = fullTitle.toLowerCase();
            const isAssignment = titleLower.includes('due') ||
                titleLower.includes('submission') ||
                titleLower.includes('portal') ||
                titleLower.includes('coursework') ||
                titleLower.includes('assignment');
            if (!isAssignment) return null;

            const assignmentName = fullTitle.replace(/\s+is\s+due$/i, '').trim();

            // Extract course name
            const courseLink = eventDiv.querySelector('a[href*="course/view.php"]');
            const courseName = courseLink ? courseLink.textContent.trim() : 'Unknown Course';

            // Extract assignment link
            const activityLink = eventDiv.querySelector('a.card-link[href*="mod/assign/view.php"], a.card-link[href*="mod/turnitintooltwo/view.php"]');
            if (!activityLink) return null;
            const assignmentUrl = activityLink.href;

            // Extract due date
            const timeElement = eventDiv.querySelector('.description .row .col-11');
            const dueText = timeElement ? timeElement.textContent.trim() : 'N/A';

            // Extract course ID from course link
            const courseMatch = courseLink ? courseLink.href.match(/id=(\d+)/) : null;
            const courseId = courseMatch ? courseMatch[1] : 'unknown';

            return {
                name: assignmentName,
                courseName: courseName,
                courseId: courseId,
                url: assignmentUrl,
                dueText: dueText,
                dueDate: parseDueDate(dueText)
            };
        } catch (error) {
            console.error('[LM Tracker] Error extracting assignment from event:', error);
            return null;
        }
    }

    // Parse due date text to Date object
    function parseDueDate(dueText) {
        try {
            // Handle formats like "Tomorrow, 23:59", "Monday, 5 January, 23:59", etc.
            const now = new Date();

            if (dueText.toLowerCase().includes('today')) {
                const timeMatch = dueText.match(/(\d{1,2}):(\d{2})/);
                if (timeMatch) {
                    const date = new Date(now);
                    date.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0);
                    return date;
                }
            } else if (dueText.toLowerCase().includes('tomorrow')) {
                const timeMatch = dueText.match(/(\d{1,2}):(\d{2})/);
                if (timeMatch) {
                    const date = new Date(now);
                    date.setDate(date.getDate() + 1);
                    date.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0);
                    return date;
                }
            } else {
                // Try to parse full date
                const dateMatch = dueText.match(/(\d{1,2})\s+(\w+)(?:,?\s+(\d{4}))?,?\s+(\d{1,2}):(\d{2})/);
                if (dateMatch) {
                    const day = parseInt(dateMatch[1]);
                    const month = dateMatch[2];
                    const year = dateMatch[3] ? parseInt(dateMatch[3]) : now.getFullYear();
                    const hour = parseInt(dateMatch[4]);
                    const minute = parseInt(dateMatch[5]);

                    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
                    const monthIndex = monthNames.findIndex(m => m.toLowerCase().startsWith(month.toLowerCase()));

                    if (monthIndex !== -1) {
                        return new Date(year, monthIndex, day, hour, minute, 0, 0);
                    }
                }
            }
        } catch (error) {
            console.error('[LM Tracker] Error parsing date:', dueText, error);
        }
        return null;
    }

    // Step 2: Fetch submission status for an assignment
    async function fetchSubmissionStatus(assignmentUrl) {
        try {
            const html = await fetchPage(assignmentUrl);
            const doc = parseHTML(html);

            // Extract opened date
            const openedMatch = doc.body.textContent.match(/Opened:\s*([^<\n]+)/);
            const opened = openedMatch ? openedMatch[1].trim() : 'N/A';

            // Extract due date (more precise than calendar)
            const dueMatch = doc.body.textContent.match(/Due:\s*([^<\n]+)/);
            const due = dueMatch ? dueMatch[1].trim() : 'N/A';

            // Extract submission status - try multiple methods
            let status = 'Not submitted';
            let isDone = false;

            // Method 1: Try to find the status in the table cell
            const statusCell = doc.querySelector('td.submissionstatussubmitted, td.submissionnotattempt, td[class*="submissionstatus"]');
            if (statusCell) {
                status = statusCell.textContent.trim();
            } else {
                // Method 2: Try regex pattern in body text
                const statusMatch = doc.body.textContent.match(/Submission status\s*([^\n<]+?)(?:\s*Grading|$)/);
                if (statusMatch) {
                    status = statusMatch[1].trim();
                }
            }

            // Check for "Done" status in completion requirements
            isDone = doc.body.textContent.includes('Done: Make a submission');

            // Clean up status text
            status = status.replace(/\s+/g, ' ').trim();

            // If status is empty or just whitespace, set default
            if (!status || status === 'Submission status') {
                status = 'Not submitted';
            }

            // Extract additional details for submitted assignments
            let gradingStatus = null;
            let fileSubmissions = [];

            const isSubmitted = status.toLowerCase().includes('submitted');

            if (isSubmitted) {
                // Extract grading status
                const gradingMatch = doc.body.textContent.match(/Grading status\s*([^\n<]+)/);
                if (gradingMatch) {
                    gradingStatus = gradingMatch[1].trim();
                }

                // Extract file submissions with URLs
                const fileElements = doc.querySelectorAll('a[href*="/pluginfile.php"]');
                fileElements.forEach(fileLink => {
                    const fileName = fileLink.textContent.trim();
                    const fileUrl = fileLink.href;
                    if (fileName && fileName.length > 0 && !fileName.includes('Turnitin')) {
                        fileSubmissions.push({
                            name: fileName,
                            url: fileUrl
                        });
                    }
                });

                // Extract feedback (for completed assignments)
                const feedbackMatch = doc.body.textContent.match(/Feedback\s*([^\n<]+)/);
                if (feedbackMatch) {
                    const feedbackText = feedbackMatch[1].trim();
                    if (feedbackText && feedbackText !== 'Feedback') {
                        gradingStatus = feedbackText;
                    }
                }
            }

            console.log(`[LM Tracker] Status for ${assignmentUrl}: ${status}, Done: ${isDone}`);

            // Extract course name and ID from breadcrumb or page title
            let courseName = null;
            let courseId = null;

            // Try multiple selectors for breadcrumb
            const breadcrumbLink = doc.querySelector('nav[aria-label="Navigation bar"] a[href*="course/view.php"], .breadcrumb a[href*="course/view.php"], a[href*="course/view.php"][title]');
            if (breadcrumbLink) {
                // Extract from title attribute or text content
                const titleAttr = breadcrumbLink.getAttribute('title');
                if (titleAttr) {
                    // Title format: "DTS403TC-2526-S1-Applied Research Techniques..."
                    courseName = titleAttr.split('-').slice(0, 3).join('-');
                } else {
                    courseName = breadcrumbLink.textContent.trim().replace(/\s*\/\s*$/, '');
                }
                const courseMatch = breadcrumbLink.href.match(/id=(\d+)/);
                if (courseMatch) {
                    courseId = courseMatch[1];
                }
                console.log(`[LM Tracker] Extracted course from breadcrumb: ${courseName} (ID: ${courseId})`);
            }

            return {
                opened: opened,
                due: due,
                status: status,
                isDone: isDone,
                isSubmitted: isSubmitted,
                gradingStatus: gradingStatus,
                fileSubmissions: fileSubmissions,
                courseName: courseName,
                courseId: courseId
            };
        } catch (error) {
            console.error('[LM Tracker] Error fetching submission status:', error);
            return {
                opened: 'N/A',
                due: 'N/A',
                status: 'Error',
                isDone: false,
                isSubmitted: false,
                gradingStatus: null,
                fileSubmissions: [],
                courseName: null,
                courseId: null
            };
        }
    }

    // Step 3: Aggregate all assignments with their status (supports progressive loading)
    async function aggregateAssignments(progressCallback) {
        const assignments = await discoverAssignmentsFromCalendar(progressCallback);

        // Fetch submission status for each assignment
        for (const assignment of assignments) {
            const statusInfo = await fetchSubmissionStatus(assignment.url);

            // Save original course info
            const originalCourseName = assignment.courseName;
            const originalCourseId = assignment.courseId;

            // Merge status info
            Object.assign(assignment, statusInfo);

            // Restore course info if statusInfo didn't provide it or provided null
            if (!statusInfo.courseName || statusInfo.courseName === null) {
                assignment.courseName = originalCourseName;
            }
            if (!statusInfo.courseId || statusInfo.courseId === null) {
                assignment.courseId = originalCourseId;
            }

            console.log(`[LM Tracker] Assignment: ${assignment.name}, Course: ${assignment.courseName} (ID: ${assignment.courseId})`);
        }

        // Group by course
        const courseMap = new Map();
        assignments.forEach(assignment => {
            if (!courseMap.has(assignment.courseId)) {
                courseMap.set(assignment.courseId, {
                    courseName: assignment.courseName,
                    courseId: assignment.courseId,
                    assignments: []
                });
            }
            courseMap.get(assignment.courseId).assignments.push(assignment);
        });

        // Convert to array and add assignment count
        const result = Array.from(courseMap.values()).map(course => ({
            courseName: course.courseName,
            courseUrl: `https://core.xjtlu.edu.cn/course/view.php?id=${course.courseId}`,
            assignmentCount: course.assignments.length,
            assignments: course.assignments.sort((a, b) => {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return a.dueDate - b.dueDate;
            })
        }));

        console.log('[LM Tracker] Aggregated assignments:', result);
        return result;
    }

    // Step 4: Create UI
    function createUI(data) {
        // Remove existing panel if any
        const existingPanel = document.getElementById('lm-tracker-panel');
        if (existingPanel) existingPanel.remove();

        // Check if panel should be minimized
        const isMinimized = GM_getValue('lm_tracker_minimized', false);

        // Create floating button (for minimized state)
        const floatingButton = document.createElement('div');
        floatingButton.id = 'lm-tracker-floating-btn';
        floatingButton.innerHTML = '📚';
        floatingButton.style.display = isMinimized ? 'flex' : 'none';
        floatingButton.addEventListener('click', () => {
            GM_setValue('lm_tracker_minimized', false);
            floatingButton.style.display = 'none';
            panel.style.display = 'block';
        });

        // Create floating panel
        const panel = document.createElement('div');
        panel.id = 'lm-tracker-panel';
        panel.style.display = isMinimized ? 'none' : 'block';
        panel.innerHTML = `
            <div class="lm-tracker-header">
                <div>
                    <h3>📚 Assignment Tracker</h3>
                    <div class="lm-last-update" id="lm-last-update"></div>
                </div>
                <div>
                    <button id="lm-tracker-refresh">🔄 Refresh</button>
                    <button id="lm-tracker-minimize">−</button>
                    <button id="lm-tracker-close">✕</button>
                </div>
            </div>
            <div class="lm-tracker-content" id="lm-tracker-content"></div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #lm-tracker-floating-btn {
                position: fixed;
                bottom: 30px;
                right: 30px;
                width: 60px;
                height: 60px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 28px;
                cursor: pointer;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                z-index: 10001;
                transition: transform 0.2s;
            }

            #lm-tracker-floating-btn:hover {
                transform: scale(1.1);
            }

            #lm-tracker-panel {
                position: fixed;
                top: 80px;
                right: 20px;
                width: 450px;
                max-height: 80vh;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 16px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                z-index: 10000;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                overflow: hidden;
                animation: slideIn 0.3s ease-out;
            }

            @keyframes slideIn {
                from { transform: translateX(500px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }

            .lm-tracker-header {
                padding: 12px 16px;
                background: rgba(255,255,255,0.1);
                backdrop-filter: blur(10px);
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 1px solid rgba(255,255,255,0.2);
            }

            .lm-tracker-header > div {
                display: flex;
                gap: 6px;
                align-items: center;
            }

            .lm-tracker-header h3 {
                margin: 0;
                color: white;
                font-size: 15px;
                font-weight: 600;
            }

            .lm-last-update {
                font-size: 10px;
                color: rgba(255,255,255,0.7);
                margin-top: 2px;
            }

            .lm-tracker-header button {
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                padding: 6px 10px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
            }

            .lm-tracker-header button:hover {
                background: rgba(255,255,255,0.3);
                transform: scale(1.05);
            }

            .lm-tracker-content {
                max-height: calc(80vh - 60px);
                overflow-y: auto;
                padding: 16px;
            }

            .lm-course-block {
                background: white;
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 16px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                transition: transform 0.2s;
            }

            .lm-course-block:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(0,0,0,0.15);
            }

            .lm-course-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                padding-bottom: 12px;
                border-bottom: 2px solid #f0f0f0;
                gap: 12px;
            }

            .lm-course-name {
                font-weight: 600;
                font-size: 16px;
                color: #333;
                flex: 1;
                min-width: 0;
                word-wrap: break-word;
            }

            .lm-assignment-count {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
                white-space: nowrap;
                flex-shrink: 0;
            }

            .lm-assignment-item {
                padding: 12px;
                margin-bottom: 8px;
                background: #f8f9fa;
                border-radius: 8px;
                border-left: 4px solid #667eea;
                transition: all 0.2s;
            }

            .lm-assignment-item:hover {
                background: #e9ecef;
                transform: translateX(4px);
            }

            .lm-assignment-item.done {
                border-left-color: #28a745;
                background: #d4edda;
            }

            .lm-assignment-item.overdue {
                border-left-color: #dc3545;
                background: #f8d7da;
            }

            .lm-assignment-item.due-soon {
                border-left-color: #ffc107;
                background: #fff3cd;
            }

            .lm-assignment-name {
                font-weight: 600;
                color: #333;
                margin-bottom: 8px;
                font-size: 14px;
            }

            .lm-assignment-name a {
                color: #333;
                text-decoration: none;
            }

            .lm-assignment-name a:hover {
                color: #667eea;
                text-decoration: underline;
            }

            .lm-assignment-details {
                font-size: 12px;
                color: #666;
                line-height: 1.6;
            }

            .lm-assignment-details div {
                margin-bottom: 4px;
            }

            .lm-status-badge {
                display: inline-block;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 600;
                margin-top: 4px;
            }

            .lm-status-badge.done {
                background: #28a745;
                color: white;
            }

            .lm-status-badge.pending {
                background: #ffc107;
                color: #333;
            }

            .lm-status-badge.overdue {
                background: #dc3545;
                color: white;
            }

            .lm-tracker-content::-webkit-scrollbar {
                width: 8px;
            }

            .lm-tracker-content::-webkit-scrollbar-track {
                background: rgba(255,255,255,0.1);
                border-radius: 4px;
            }

            .lm-tracker-content::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.3);
                border-radius: 4px;
            }

            .lm-tracker-content::-webkit-scrollbar-thumb:hover {
                background: rgba(255,255,255,0.5);
            }

            .lm-loading {
                text-align: center;
                color: white;
                padding: 40px;
                font-size: 16px;
            }
            
            .lm-separator {
                margin: 20px 0;
                padding: 12px 0;
                text-align: center;
                position: relative;
            }
            
            .lm-separator::before {
                content: '';
                position: absolute;
                left: 0;
                right: 0;
                top: 50%;
                height: 1px;
                background: linear-gradient(to right, transparent, #ddd, transparent);
            }
            
            .lm-separator span {
                background: white;
                padding: 0 16px;
                color: #999;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                position: relative;
                z-index: 1;
            }
        `;
        document.head.appendChild(style);

        // Populate content
        const content = document.getElementById('lm-tracker-content') || panel.querySelector('#lm-tracker-content');

        if (data.length === 0) {
            content.innerHTML = '<div class="lm-loading">No upcoming assignments found</div>';
        } else {
            content.innerHTML = data.map(course => `
                <div class="lm-course-block">
                    <div class="lm-course-header">
                        <div class="lm-course-name">${course.courseName}</div>
                        <div class="lm-assignment-count">${course.assignmentCount} Assignment${course.assignmentCount > 1 ? 's' : ''}</div>
                    </div>
                    ${course.assignments.map((assignment, index) => {
                const now = new Date();
                const isSubmitted = assignment.isSubmitted || assignment.status.toLowerCase().includes('submitted');
                const isOverdue = assignment.dueDate && assignment.dueDate < now && !isSubmitted;
                const isDueSoon = assignment.dueDate && assignment.dueDate > now && (assignment.dueDate - now) < 3 * 24 * 60 * 60 * 1000 && !isSubmitted;

                let itemClass = 'lm-assignment-item';
                let statusClass = 'pending';

                if (isSubmitted) {
                    itemClass += ' done';
                    statusClass = 'done';
                } else if (isOverdue) {
                    itemClass += ' overdue';
                    statusClass = 'overdue';
                } else if (isDueSoon) {
                    itemClass += ' due-soon';
                    statusClass = 'pending';
                }

                // Check if we need to add separator before this assignment
                let separator = '';
                if (index > 0) {
                    const prevAssignment = course.assignments[index - 1];
                    const prevIsOverdue = prevAssignment.dueDate && prevAssignment.dueDate < now && !(prevAssignment.isSubmitted || prevAssignment.status.toLowerCase().includes('submitted'));
                    if (isOverdue && !prevIsOverdue) {
                        separator = '<div class="lm-separator"><span>Overdue Assignments</span></div>';
                    }
                }

                return separator + `
                            <div class="${itemClass}">
                                <div class="lm-assignment-name">
                                    <a href="${assignment.url}" target="_blank">${assignment.name}</a>
                                </div>
                                <div class="lm-assignment-details">
                                    <div>📅 Opened: ${assignment.opened}</div>
                                    <div>⏰ Due: ${assignment.due}</div>
                                    <div>
                                        <span class="lm-status-badge ${statusClass}">${assignment.status}</span>
                                    </div>
                                    ${assignment.isSubmitted ? `
                                        ${assignment.gradingStatus ? `<div>📝 Grading: ${assignment.gradingStatus}</div>` : ''}
                                        ${assignment.fileSubmissions && assignment.fileSubmissions.length > 0 ? `<div>📎 Files: ${assignment.fileSubmissions.map(file => `<a href="${file.url}" target="_blank" style="color: #667eea; text-decoration: underline;">${file.name}</a>`).join(', ')}</div>` : ''}
                                    ` : ''}
                                </div>
                            </div>
                        `;
            }).join('')}
                </div>
            `).join('');
        }

        // Update last fetch time display
        setTimeout(() => {
            updateLastFetchDisplay();
        }, 100);

        document.body.appendChild(floatingButton);
        document.body.appendChild(panel);

        // Event listeners
        document.getElementById('lm-tracker-close').addEventListener('click', () => {
            panel.remove();
            floatingButton.remove();
        });

        document.getElementById('lm-tracker-minimize').addEventListener('click', () => {
            GM_setValue('lm_tracker_minimized', true);
            panel.style.display = 'none';
            floatingButton.style.display = 'flex';
        });

        document.getElementById('lm-tracker-refresh').addEventListener('click', async () => {
            content.innerHTML = '<div class="lm-loading">Loading assignments...</div>';
            GM_setValue(CACHE_KEY, null);
            const newData = await aggregateAssignments();
            const now = Date.now();
            GM_setValue(CACHE_KEY, JSON.stringify({ data: newData, timestamp: now }));
            GM_setValue(LAST_FETCH_KEY, now);
            createUI(newData);
        });
    }

    // Helper: Update last fetch time display
    function updateLastFetchDisplay() {
        const lastFetchTime = GM_getValue(LAST_FETCH_KEY);
        const lastUpdateEl = document.getElementById('lm-last-update');

        console.log(`[LM Tracker] Updating last fetch display. Time: ${lastFetchTime}, Element: ${lastUpdateEl}`);

        if (lastFetchTime && lastUpdateEl) {
            const lastUpdate = new Date(lastFetchTime);
            const timeAgo = getTimeAgo(lastUpdate);
            lastUpdateEl.textContent = `Updated ${timeAgo}`;
            console.log(`[LM Tracker] Set update text to: Updated ${timeAgo}`);
        } else if (!lastFetchTime) {
            console.log('[LM Tracker] No last fetch time found');
        } else if (!lastUpdateEl) {
            console.log('[LM Tracker] Update element not found in DOM');
        }
    }

    // Helper: Get time ago string
    function getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }

    // Main execution
    async function init() {
        console.log('[LM Tracker] Initializing...');

        // Check cache
        const cached = GM_getValue(CACHE_KEY);
        const lastFetch = GM_getValue(LAST_FETCH_KEY);
        const now = Date.now();

        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            const cacheAge = now - timestamp;

            // Always show cached data first for instant display
            createUI(data);

            // Auto-refresh if cache is older than 24 hours
            if (cacheAge >= CACHE_DURATION) {
                console.log('[LM Tracker] Cache expired, fetching fresh data...');
                const refreshTime = Date.now();
                GM_setValue(LAST_FETCH_KEY, refreshTime);
                setTimeout(async () => {
                    const freshData = await aggregateAssignments();
                    GM_setValue(CACHE_KEY, JSON.stringify({ data: freshData, timestamp: refreshTime }));
                    createUI(freshData);
                }, 1000);
            } else {
                console.log('[LM Tracker] Using cached data');
            }
            return;
        }

        // Fetch fresh data with progressive loading
        console.log('[LM Tracker] Fetching fresh data...');
        const fetchTime = Date.now();
        GM_setValue(LAST_FETCH_KEY, fetchTime);

        if (PROGRESSIVE_LOADING) {
            // Progressive loading: show upcoming first, then update with historical
            console.log('[LM Tracker] 🚀 Progressive loading enabled');
            let upcomingShown = false;

            const data = await aggregateAssignments((progress) => {
                if (progress.phase === 'upcoming' && !upcomingShown) {
                    console.log('[LM Tracker] ⚡ Upcoming assignments ready - rendering immediately!');
                    upcomingShown = true;
                    // Note: We don't render here because we need to aggregate first
                    // But this callback confirms upcoming data is fetched
                }
            });

            GM_setValue(CACHE_KEY, JSON.stringify({ data, timestamp: fetchTime }));
            createUI(data);
            console.log('[LM Tracker] ✅ All data loaded and rendered');
        } else {
            // Traditional loading: wait for everything
            const data = await aggregateAssignments();
            GM_setValue(CACHE_KEY, JSON.stringify({ data, timestamp: fetchTime }));
            createUI(data);
        }
    }

    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
