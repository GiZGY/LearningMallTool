# LearningMall Assignment Tracker

A powerful Tampermonkey userscript for XJTLU students to track and manage course assignments on the LearningMall platform.

## Features

✨ **Comprehensive Assignment Tracking**
- 📅 Displays all assignments from current and past 6 months
- 🔔 Shows assignment deadlines, submission status, and grading information
- 📊 Groups assignments by course for easy organization

🎨 **Beautiful UI**
- 💜 Modern gradient purple theme with smooth animations
- 📱 Floating panel with minimize/expand functionality
- 🎯 Color-coded assignment cards:
  - 🟢 Green: Submitted assignments
  - 🟡 Yellow: Upcoming assignments (not submitted)
  - 🔴 Red: Overdue assignments (not submitted)

⚡ **Smart Features**
- 🔄 Auto-refresh when cache expires (24 hours)
- ⏱️ Shows last update time
- 📎 Clickable file attachments for submitted work
- 🔍 Supports multiple assignment types (due dates, submissions, portals, coursework)
- 📏 Visual separator between current and overdue assignments

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Click [here](https://github.com/GiZGY/LearningMallTool/raw/main/learningmall_tracker.user.js) to install the script
3. Navigate to [XJTLU LearningMall](https://core.xjtlu.edu.cn/)
4. The assignment tracker will appear automatically!

## Usage

### Main Panel
- **📚 Assignment Tracker**: Main title showing the tracker is active
- **Updated X ago**: Shows when data was last fetched
- **🔄 Refresh**: Manually refresh assignment data
- **−**: Minimize panel to floating button
- **✕**: Close the tracker

### Assignment Information
For each assignment, you'll see:
- Assignment name (clickable link)
- 📅 Opened date
- ⏰ Due date
- Status badge (Not submitted / Submitted for grading / Done)
- 📝 Grading status (for submitted assignments)
- 📎 Submitted files (clickable links)

## How It Works

1. **Data Collection**: Fetches assignments from:
   - Calendar upcoming view (future assignments)
   - Calendar month view (past 6 months of historical assignments)

2. **Status Retrieval**: For each assignment, fetches:
   - Submission status
   - Grading status
   - Feedback (if available)
   - Submitted files

3. **Smart Caching**: 
   - Caches data for 24 hours
   - Auto-refreshes when cache expires
   - Manual refresh available anytime

## Supported Assignment Types

The script recognizes assignments with these keywords:
- "due" (e.g., "Assignment 1 is due")
- "submission" (e.g., "CW1 Submission Portal")
- "portal"
- "coursework"
- "assignment"

## Technical Details

- **Platform**: XJTLU LearningMall (Moodle-based)
- **Script Type**: Tampermonkey userscript
- **Cache Duration**: 24 hours
- **Historical Range**: Current month + past 5 months (6 months total)
- **UI Framework**: Vanilla JavaScript with CSS animations

## Development

### Local Setup
```bash
git clone https://github.com/GiZGY/LearningMallTool.git
cd LearningMallTool
```

### Creating a Branch
```bash
git checkout -b feature/your-feature-name
```

### Project Structure
```
LearningMallTool/
├── learningmall_tracker.user.js  # Main userscript
├── note.md                        # Development notes
└── README.md                      # This file
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use and modify as needed.

## Author

Created for XJTLU students to simplify assignment management.

## Changelog

### Version 2.2 (Current) - Performance Optimization
- ⚡ **2x faster loading**: Optimized from ~26s to ~12s
- 🔄 **Batch processing**: Smart request batching (5 concurrent) to avoid server rate limiting
- 📊 **Parallel calendar fetching**: 6 months of historical data fetched simultaneously
- ⏱️ **Loading time indicator**: Shows "Estimated time: 15-30s" during refresh
- 📈 **Performance monitoring**: Detailed timing logs in console
- 🚀 **Progressive loading foundation**: Infrastructure for future UX improvements

### Version 2.1
- ✅ Multi-month historical assignment fetching (6 months)
- ✅ Enhanced assignment type recognition (submission, portal, etc.)
- ✅ Visual separator for overdue assignments
- ✅ Last update timestamp display
- ✅ Improved breadcrumb course name extraction
- ✅ Compact header design
- ✅ Auto-refresh on cache expiration

### Version 2.0
- ✅ Multi-month historical assignment fetching (6 months)
- ✅ Enhanced assignment type recognition (submission, portal, etc.)
- ✅ Visual separator for overdue assignments
- ✅ Last update timestamp display
- ✅ Improved breadcrumb course name extraction
- ✅ Compact header design
- ✅ Auto-refresh on cache expiration

### Version 2.0
- ✅ Calendar-based assignment discovery
- ✅ Minimize/expand functionality
- ✅ Color-coded assignment cards
- ✅ Clickable file attachments
- ✅ 24-hour caching

### Version 1.0
- ✅ Basic assignment tracking
- ✅ Floating panel UI
- ✅ Course grouping

---

**Note**: This is an unofficial tool created by students for students. It is not affiliated with or endorsed by XJTLU.
