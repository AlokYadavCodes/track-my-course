# TrackMyCourse – Track YouTube Playlists Like a Course
Turn YouTube playlists into structured learning courses with progress tracking, right inside YouTube.

![TrackMyCourse Banner](https://github.com/user-attachments/assets/642a93bb-9c8d-4e76-b452-537426eb9428)  
[![Get it on Chrome Web Store](https://img.shields.io/chrome-web-store/v/eojbembojnleniamokihimgjikmpahin?label=Chrome%20Web%20Store&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/trackmycourse-track-youtu/eojbembojnleniamokihimgjikmpahin)
[![Star on GitHub](https://img.shields.io/github/stars/AlokYadavCodes/track-my-course?style=social)](https://github.com/AlokYadavCodes/track-my-course/stargazers)

**TrackMyCourse** helps you stay organized while learning from YouTube playlists.  

Instead of passively watching videos and losing track of where you left off, you can now treat any playlist like a proper online course. The extension adds a simple, clean interface directly inside YouTube — showing your overall progress and marking completed videos to keep your learning path consistent.

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

YouTube is an amazing resource for self-education — from coding tutorials to university lectures.  
But YouTube is built for entertainment, not structured learning, which makes it easy to lose track of videos, skip lessons accidentally, or lose motivation.

**TrackMyCourse** fixes this by adding a simple and clean course-tracking layer on top of YouTube playlists, helping you stay organized, consistent, and focused on your goals.

*Ready to use TrackMyCourse?* [Install now](https://chromewebstore.google.com/detail/trackmycourse-track-youtu/eojbembojnleniamokihimgjikmpahin) and start tracking your playlists.


---

## ✨ Features

- 📊 **Visual Progress Bar** – Quickly see how much of a playlist you've completed.  
- ✅ **Video Checkboxes** – Mark individual videos as “done” to track your learning path.  
- 🔄 **Dynamic Playlist Scanning** – Automatically detects videos in the playlist.  
- 💾 **Saved Locally** – Your progress is stored locally in your browser.  

**Preview of Features:**  

![TrackMyCourse Features](https://github.com/user-attachments/assets/8c127ea8-cd61-4033-bd51-6ad586f467b0)

---

## 🚀 Installation & Usage

1. [Install TrackMyCourse](https://chromewebstore.google.com/detail/trackmycourse-track-youtu/eojbembojnleniamokihimgjikmpahin)
2. Go to any YouTube playlist page.  
3. Click the **"Start Course"** button near the playlist title.  

Once enabled, the progress bar and checkboxes will automatically appear for that playlist.

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
2.  **Open Chrome Extensions:** Navigate to `chrome://extensions/` in your browser.
3.  **Enable Developer Mode:** Ensure the **Developer mode** toggle is switched on.
4.  **Load the extension:** Click **"Load unpacked"** and select the `track-my-course` folder you cloned.

> **Note:** Changes to the source code will only reflect after you reload the extension on the `chrome://extensions/` page.


### Project Structure
```
track-my-course/
├── icons/          # Contains all extension icons.
├── src/            # Contains the main source code.
│   ├── background/ # Handles background tasks.
│   ├── content/    # Injects scripts directly into web pages.
│   └── popup/      # Code for the extension's popup window.
├── styles/         # Contains CSS files for UI elements injected onto pages.
└── manifest.json   # Chrome extension configuration file.
```
---

## 🔐 Permissions Explained

TrackMyCourse requests only the permissions it needs to function, nothing more.

| Permission | Why It's Needed |
| :--- | :--- |
| `storage` | To save your playlist progress locally in the browser. |
| `webNavigation` | To detect playlist pages so the extension can apply the correct logic. |
| `host_permissions` | To display the progress UI only on YouTube pages. |

**Privacy first:** No personal data is collected, stored, or transmitted.

## 📜 License

This project is licensed under the [GNU GPLv3 License](https://www.gnu.org/licenses/gpl-3.0.html).

See the [LICENSE](LICENSE) file for full details.
