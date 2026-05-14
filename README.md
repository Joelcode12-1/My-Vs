# Photorealistic VS Code UI Replica

This project is a meticulously crafted, static HTML/CSS/JS frontend replica of Visual Studio Code running the popular "Tokyo Night" theme. It realistically simulates the VS Code desktop environment directly in the browser.

## Features

- **Fullscreen Windows Native Layout**: Replicates the 100vw/100vh layout of a Windows application, including the native OS menu (File, Edit, etc.) and window controls (Minimize, Maximize, Close).
- **Interactive Activity Bar**: Authentic SVG icons for Explorer, Search, Source Control, Run and Debug, and Extensions. Clicking these icons instantly swaps the visible sidebar panel.
- **Dynamic File Explorer**: Features a togglable file tree (folders can be expanded/collapsed) mimicking a React project structure. Clicking files opens them in mock editor tabs.
- **Mock Editor Tabs**: Dynamic tab interface. Clicking tabs swaps the active code content below. Tabs can be closed dynamically.
- **Syntax Highlighting**: Pure CSS-based vibrant syntax coloring mimicking the Tokyo Night schema for JavaScript and React components.
- **Integrated Terminal**: A mock bottom panel featuring a terminal with simulated successful build output, problem/output/debug console tabs.
- **Functional Sidebars**: Unique mock views for Search (with search/replace inputs), Source Control (with staging areas and commit inputs), and Extensions (with a mock marketplace).

## How It Works

The magic of this replica comes from purely client-side code—no servers, node modules, or frameworks are required. It operates using standard web technologies:

### 1. HTML5 (`NEW2.html`)
The structural backbone. It organizes the page into exact standard VS Code flexbox panes: the outer window shell, the left activity bar, the collapsible sidebar, the main editor area, the tabs container, and the terminal panel. The UI leverages inline SVGs to match Microsoft's official VS Code icons exactly.

### 2. Cascading Style Sheets (`style.css`)
Responsible for the photorealistic Tokyo Night aesthetic. 
- Custom variables and specific hex codes (`#1a1b26`, `#a9b1d6`, `#f7768e`, etc.) emulate the theme perfectly. 
- Elements rely heavily on `display: flex` to create the rigid, non-scrolling app layout.
- Specific classes simulate interactive states like hovering over files, active tabs glowing blue, and custom scrollbar styling to hide native browser scrollbars.

### 3. Vanilla JavaScript (`script.js`)
Breathes life into the static HTML layout through DOM manipulation.
- **Event Listeners**: Attached to sidebar folders to toggle their chevron directions and display states.
- **View Switching**: When clicking Activity Bar icons (`data-view="explorer"`, etc.), JS iterates through all panels, applying `display: none` to the inactive ones and `display: block` to the target view.
- **Tab Management**: JS handles creating new tab elements dynamically, managing the 'active' CSS classes across tabs, swapping the visible code blocks in the main editor pane, and gracefully handling the logic when a user clicks the `✕` close button on a tab.

## Project Structure
The folder is extremely lightweight, containing only the 4 essential build files:
- `NEW2.html`
- `style.css`
- `script.js`
- `README.md`

## Running the Project

Because it requires no build steps or bundlers, simply open `NEW2.html` in any modern web browser to view the replica. For the best experience, use a local development server like VS Code's "Live Server" extension to serve the files.
