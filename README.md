# TrackMyCourse – YouTube Playlist Progress Tracker

Turn YouTube playlists into courses. Track your playlist with checkmarks, progress bar, total and watched duration, and completion percentage.

![TrackMyCourse Banner](https://github.com/user-attachments/assets/df794c84-7b5d-4db0-bba1-fad103dc5752)  
[![Get it on Chrome Web Store](https://img.shields.io/chrome-web-store/v/eojbembojnleniamokihimgjikmpahin?label=Chrome%20Web%20Store&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/trackmycourse-track-youtu/eojbembojnleniamokihimgjikmpahin)
[![Star on GitHub](https://img.shields.io/github/stars/AlokYadavCodes/track-my-course?style=social)](https://github.com/AlokYadavCodes/track-my-course/stargazers)

**TrackMyCourse** helps you stay organized while learning from YouTube playlists.

Instead of passively watching videos and forgetting your progress, you can turn any playlist into a structured online course. The extension integrates directly into YouTube, showing a progress bar, completion percentage, watched and total duration, and checkmarks for finished videos — giving you a clear view of your learning journey.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0) [![Open Issues](https://img.shields.io/github/issues/AlokYadavCodes/track-my-course)](https://github.com/AlokYadavCodes/track-my-course/issues) [![Pull Requests](https://img.shields.io/github/issues-pr/AlokYadavCodes/track-my-course)](https://github.com/AlokYadavCodes/track-my-course/pulls)

---

## 📚 Table of Contents

- [Why TrackMyCourse?](#why-trackmycourse)
- [✨ Features](#-features)
- [🚀 Installation & Usage](#-installation--usage)
- [🛠️ For Developers](#️-for-developers)
    - [Contributing](#contributing)
    - [Running Locally](#running-locally)
    - [Project Structure](#project-structure)
- [🔐 Permissions Explained](#-permissions-explained)
- [📜 License](#-license)

---

## Why TrackMyCourse?

YouTube is a powerful place for self-learning — from coding tutorials to full university lectures.  
But since YouTube is designed for entertainment, not structured courses, it’s easy to lose progress, skip videos, or lose consistency.

**TrackMyCourse** solves this by adding a clean progress-tracking layer to YouTube playlists, showing completion percentage, durations, and checkmarks to keep your learning organized, consistent, and motivating.

_Ready to use TrackMyCourse?_ [Install now](https://chromewebstore.google.com/detail/trackmycourse-track-youtu/eojbembojnleniamokihimgjikmpahin) and start tracking your playlists.

---

## ✨ Features

- 📊 **Visual Progress Bar** – Instantly see how much of a playlist you’ve completed.
- ✅ **Video Checkmarks** – Mark videos as finished to keep your learning on track.
- ⏱️ **Duration Tracking** – Know your watched and total time to plan your study sessions better.
- 🔄 **Dynamic Playlist Scanning** – Automatically detects videos in the playlist.
- 💾 **Saved Locally** – Your progress stays saved in your browser, no sign-up needed.
- 📦 **Import / Export** – Back up your data as a JSON file and restore it anytime, even across browsers.

_All features appear seamlessly inside YouTube’s interface._

**Preview of Features:**

![TrackMyCourse Features](https://github.com/user-attachments/assets/8c127ea8-cd61-4033-bd51-6ad586f467b0)

---

## 🚀 Installation & Usage

1. [Install TrackMyCourse](https://chromewebstore.google.com/detail/trackmycourse-track-youtu/eojbembojnleniamokihimgjikmpahin)
2. Go to any YouTube playlist page.
3. Click the **"Start Course"** button near the playlist title.

Once started, the progress bar and checkboxes will automatically appear for that playlist.

### Backup & Restore (Import / Export)

You can back up all your tracked courses and restore them later — useful when switching browsers, devices, or reinstalling the extension.

1. Open the extension popup and click the **⋮** (menu) button in the top-right corner.
2. **Export Data** — Downloads a `.json` backup file containing all your courses and progress.
3. **Import Data** — Opens a dedicated import page where you can drag-and-drop (or browse for) a previously exported `.json` file.

During import, the extension shows a preview of the courses in the backup. Only **new** courses are added — your existing courses and progress are never modified or deleted.

---

## 🛠️ For Developers

This section provides information for anyone who wants to contribute to the project or run it locally.

### Contributing

Contributions are welcome! Bug fixes, feature suggestions, and pull requests are appreciated. For major changes, please open an issue first to discuss your ideas.

### Running Locally

Follow these steps to set up the project on your local machine.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/AlokYadavCodes/track-my-course.git
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Open Chrome Extensions:** Navigate to `chrome://extensions/` in your browser.
4.  **Enable Developer Mode:** Ensure the **Developer mode** toggle is switched on.
5.  **Load the extension:** Click **"Load unpacked"** and select the `track-my-course` folder you cloned.

> **Note:** Changes to the source code will only reflect after you reload the extension on the `chrome://extensions/` page.

### Building browser bundles

There is a script `(scripts/build.js)` that generates the Chrome and Firefox bundles into the `dist/` folder.

Run the build commands:

```bash
# build Chrome bundle
npm run build:chrome

# build Firefox bundle
npm run build:firefox

# build both Chrome and Firefox
npm run build
```

The script will copy `icons/` and `src/` into `dist/<browser>/` and include the appropriate manifest (`manifest.chrome.json` or `manifest.firefox.json`) for each browser.

### Project Structure

```
track-my-course/
├── icons/             # Contains all extension icons.
├── src/               # Contains the main source code.
│   ├── background/    # Handles background tasks.
│   ├── content/       # Injects scripts directly into web pages.
│   ├── pages/         # Standalone extension pages (e.g. import).
│   │   └── import/    # Import / restore data page.
│   ├── popup/         # Code for the extension's popup window.
│   └── styles/        # Contains CSS files for UI elements injected onto pages.
├── manifests/         # Browser-specific manifests
│   ├── manifest.chrome.json
│   └── manifest.firefox.json
├── .prettierrc        # Prettier configuration for consistent formatting
├── package.json       # Project dependencies and scripts
└── package-lock.json  # Locked dependency versions
```

---

## 🔐 Permissions Explained

TrackMyCourse requests only the permissions it needs to function, nothing more.

| Permission         | Why It's Needed                                                        |
| :----------------- | :--------------------------------------------------------------------- |
| `storage`          | To save your playlist progress locally in the browser.                 |
| `webNavigation`    | To detect playlist pages so the extension can apply the correct logic. |
| `host_permissions` | To display the progress UI only on YouTube pages.                      |

**Privacy first:** No personal data is collected, stored, or transmitted.

## 📜 License

This project is licensed under the [GNU GPLv3 License](https://www.gnu.org/licenses/gpl-3.0.html).

See the [LICENSE](LICENSE) file for full details.
