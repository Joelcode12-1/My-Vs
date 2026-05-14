(() => {
    "use strict";

    const MONACO_VERSION = "0.52.2";
    const MONACO_BASE = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/`;
    const STORAGE_KEY = "vscode-dev-replica-state-v5";

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    const dom = {
        root: document.documentElement,
        body: document.body,
        workbench: $(".workbench"),
        editorWorkbench: $(".editor-workbench"),
        sidebar: $("#sidebar"),
        sidebarTitle: $("#sidebar-title"),
        explorerActions: $("#explorer-actions"),
        tree: $("#file-tree"),
        tabs: $("#tabs-row"),
        breadcrumbs: $("#breadcrumbs"),
        editorContainer: $("#editor-container"),
        emptyEditor: $("#empty-editor"),
        searchInput: $("#search-input"),
        replaceInput: $("#replace-input"),
        replaceButton: $("#replace-button"),
        searchMeta: $("#search-meta"),
        searchResults: $("#search-results"),
        changesCount: $("#changes-count"),
        changesList: $("#changes-list"),
        commitMessage: $("#commit-message"),
        commitButton: $("#commit-button"),
        themeSelect: $("#theme-select"),
        fontSizeInput: $("#font-size-input"),
        wordWrapCheck: $("#word-wrap-check"),
        commandCenter: $("#command-center"),
        commandPalette: $("#command-palette"),
        commandInput: $("#command-input"),
        commandList: $("#command-list"),
        menuPopover: $("#menu-popover"),
        contextMenu: $("#context-menu"),
        dialogBackdrop: $("#dialog-backdrop"),
        dialogForm: $("#input-dialog"),
        dialogTitle: $("#dialog-title"),
        dialogLabel: $("#dialog-label"),
        dialogInput: $("#dialog-input"),
        dialogError: $("#dialog-error"),
        dialogCancel: $("#dialog-cancel"),
        statusFile: $("#status-file"),
        statusPosition: $("#status-position"),
        statusLanguage: $("#status-language"),
        statusSpaces: $("#status-spaces"),
        toast: $("#toast"),
        sidebarResizer: $("#sidebar-resizer"),
        panelResizer: $("#panel-resizer"),
        bottomPanel: $("#bottom-panel"),
        togglePanelButton: $("#toggle-panel-button"),
        splitEditorButton: $("#split-editor-button"),
        startDebugButton: $("#start-debug-button")
    };

    const initialFileSystem = [
        {
            type: "folder",
            name: "data",
            expanded: true,
            children: [
                {
                    type: "file",
                    name: "workspace.json",
                    content: [
                        "{",
                        "  \"name\": \"web-project\",",
                        "  \"theme\": \"dark-modern\",",
                        "  \"entry\": \"data/workspace.json\",",
                        "  \"features\": [\"explorer\", \"search\", \"tabs\", \"commandPalette\"]",
                        "}"
                    ].join("\n")
                },
                {
                    type: "file",
                    name: "index.html",
                    content: [
                        "<!doctype html>",
                        "<html lang=\"en\">",
                        "<head>",
                        "  <meta charset=\"UTF-8\">",
                        "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">",
                        "  <title>web-project</title>",
                        "</head>",
                        "<body>",
                        "  <h1>Hello from data/index.html</h1>",
                        "  <script src=\"script.js\"></script>",
                        "</body>",
                        "</html>"
                    ].join("\n")
                },
                {
                    type: "file",
                    name: "style.css",
                    content: [
                        "body {",
                        "  margin: 0;",
                        "  font-family: Segoe UI, sans-serif;",
                        "  background: #1f1f1f;",
                        "  color: #cccccc;",
                        "}"
                    ].join("\n")
                },
                {
                    type: "file",
                    name: "script.js",
                    content: [
                        "console.log(\"web-project loaded\");"
                    ].join("\n")
                }
            ]
        }
    ];

    const state = {
        fs: clone(initialFileSystem),
        openTabs: [],
        activePath: null,
        selectedPath: "data/workspace.json",
        activeView: "explorer",
        activePanel: "terminal",
        dirtyPaths: new Set(),
        models: new Map(),
        contextPath: null,
        theme: "dark",
        fontSize: 14,
        wordWrap: false,
        commandIndex: 0,
        dialog: null,
        sidebarWidth: 286,
        panelHeight: 190,
        panelHidden: false
    };

    let editor = null;
    let fallbackTextarea = null;
    let persistTimer = null;
    let toastTimer = null;

    const viewTitles = {
        explorer: "Explorer",
        search: "Search",
        scm: "Source Control",
        run: "Run and Debug",
        settings: "Settings"
    };

    const menuDefinitions = {
        file: [
            { label: "New File", shortcut: "Ctrl+N", command: "newFile" },
            { label: "New Folder", command: "newFolder" },
            { type: "separator" },
            { label: "Save", shortcut: "Ctrl+S", command: "saveFile" },
            { label: "Save All", command: "saveAll" },
            { type: "separator" },
            { label: "Close Editor", shortcut: "Ctrl+W", command: "closeEditor" }
        ],
        edit: [
            { label: "Undo", shortcut: "Ctrl+Z", command: "editorUndo" },
            { label: "Redo", shortcut: "Ctrl+Y", command: "editorRedo" },
            { type: "separator" },
            { label: "Find", shortcut: "Ctrl+F", command: "findInEditor" },
            { label: "Replace", shortcut: "Ctrl+H", command: "replaceInFiles" }
        ],
        selection: [
            { label: "Select All", shortcut: "Ctrl+A", command: "selectAll" },
            { label: "Expand Selection", shortcut: "Shift+Alt+Right", command: "dummyExpandSelection" },
            { label: "Copy Line Down", shortcut: "Shift+Alt+Down", command: "dummyCopyLineDown" }
        ],
        view: [
            { label: "Command Palette", shortcut: "Ctrl+Shift+P", command: "showCommands" },
            { type: "separator" },
            { label: "Explorer", shortcut: "Ctrl+Shift+E", command: "showExplorer" },
            { label: "Search", shortcut: "Ctrl+Shift+F", command: "showSearch" },
            { label: "Source Control", shortcut: "Ctrl+Shift+G", command: "showSCM" },
            { type: "separator" },
            { label: "Toggle Panel", command: "togglePanel" }
        ],
        go: [
            { label: "Go to File", shortcut: "Ctrl+P", command: "quickOpen" },
            { label: "Go to Line", shortcut: "Ctrl+G", command: "goToLine" },
            { label: "Back", shortcut: "Alt+Left", command: "dummyBack" },
            { label: "Forward", shortcut: "Alt+Right", command: "dummyForward" }
        ],
        run: [
            { label: "Start Debugging", shortcut: "F5", command: "startDebug" },
            { label: "Run Without Debugging", shortcut: "Ctrl+F5", command: "runWithoutDebugging" }
        ],
        terminal: [
            { label: "New Terminal", shortcut: "Ctrl+Shift+`", command: "newTerminal" },
            { label: "Clear", command: "clearTerminal" },
            { label: "Toggle Panel", shortcut: "Ctrl+`", command: "togglePanel" }
        ],
        help: [
            { label: "Welcome", command: "closeAllEditors" },
            { label: "Keyboard Shortcuts Reference", command: "dummyKeyboardShortcuts" },
            { label: "About", command: "about" }
        ]
    };

    const commands = [
        { id: "newFile", title: "File: New File", detail: "Create a file", run: () => promptCreate("file") },
        { id: "newFolder", title: "File: New Folder", detail: "Create a folder", run: () => promptCreate("folder") },
        { id: "rename", title: "File: Rename", detail: "Rename the selected item", run: () => promptRename(state.selectedPath || state.activePath) },
        { id: "delete", title: "File: Delete", detail: "Delete the selected item", run: () => deleteEntry(state.selectedPath || state.activePath) },
        { id: "saveFile", title: "File: Save", detail: "Mark active editor as saved", run: saveActiveFile },
        { id: "saveAll", title: "File: Save All", detail: "Mark every editor as saved", run: saveAllFiles },
        { id: "closeEditor", title: "View: Close Editor", detail: "Close the active editor", run: () => state.activePath && closeTab(state.activePath) },
        { id: "closeAllEditors", title: "View: Close All Editors", detail: "Return to the welcome editor", run: closeAllEditors },
        { id: "showExplorer", title: "View: Show Explorer", detail: "Focus the Explorer sidebar", run: () => switchView("explorer") },
        { id: "showSearch", title: "View: Show Search", detail: "Focus workspace search", run: () => switchView("search", true) },
        { id: "showSCM", title: "View: Show Source Control", detail: "Focus source control", run: () => switchView("scm") },
        { id: "showCommands", title: "View: Show All Commands", detail: "Open the command palette", run: () => openCommandPalette(">") },
        { id: "quickOpen", title: "Go to File...", detail: "Open a workspace file by name", run: () => openCommandPalette("") },
        { id: "togglePanel", title: "View: Toggle Panel", detail: "Show or hide the bottom panel", run: togglePanel },
        { id: "toggleWordWrap", title: "View: Toggle Word Wrap", detail: "Change editor word wrap", run: toggleWordWrap },
        { id: "formatDocument", title: "Format Document", detail: "Run Monaco format document", run: formatDocument },
        { id: "startDebug", title: "Debug: Start Debugging", detail: "Start a simulated debug session", run: () => showToast("Debug session started.") },
        { id: "runWithoutDebugging", title: "Run: Run Without Debugging", detail: "Run a simulated task", run: () => showToast("Running web-project.") },
        { id: "newTerminal", title: "Terminal: New Terminal", detail: "Create a simulated terminal", run: () => appendTerminal("New terminal started.") },
        { id: "clearTerminal", title: "Terminal: Clear", detail: "Clear terminal output", run: clearTerminal },
        { id: "replaceInFiles", title: "Search: Replace in Files", detail: "Use the Search sidebar replace box", run: () => switchView("search", true) },
        { id: "findInEditor", title: "Edit: Find", detail: "Open Monaco find widget", run: findInEditor },
        { id: "selectAll", title: "Edit: Select All", detail: "Select editor content", run: selectAllInEditor },
        { id: "goToLine", title: "Go to Line/Column...", detail: "Prompt for a line number", run: promptGoToLine },
        { id: "about", title: "Help: About", detail: "Show app details", run: () => showToast("VS Code web replica. Built with HTML, CSS, JavaScript, and Monaco.") },
        { id: "dummyExpandSelection", title: "Selection: Expand Selection", detail: "Dummy command", run: () => showToast("Expand Selection") },
        { id: "dummyCopyLineDown", title: "Selection: Copy Line Down", detail: "Dummy command", run: () => showToast("Copy Line Down") },
        { id: "dummyBack", title: "Go: Back", detail: "Dummy navigation", run: () => showToast("Back") },
        { id: "dummyForward", title: "Go: Forward", detail: "Dummy navigation", run: () => showToast("Forward") },
        { id: "dummyKeyboardShortcuts", title: "Help: Keyboard Shortcuts Reference", detail: "Dummy command", run: () => showToast("Keyboard Shortcuts Reference") },
        { id: "editorUndo", title: "Edit: Undo", detail: "Undo in editor", run: () => editor?.trigger("keyboard", "undo", null) },
        { id: "editorRedo", title: "Edit: Redo", detail: "Redo in editor", run: () => editor?.trigger("keyboard", "redo", null) }
    ];

    init();

    function init() {
        restoreState();
        applyTheme(state.theme);
        applyLayoutVariables();
        bindStaticEvents();
        renderTree();
        renderTabs();
        renderBreadcrumbs();
        renderSCM();
        switchView(state.activeView);
        switchPanel(state.activePanel);
        setPanelHidden(state.panelHidden);
        initMonaco();

        const preferredPath = fileExists(state.activePath) ? state.activePath : "data/workspace.json";
        if (preferredPath) {
            openFile(preferredPath, { preserveFocus: true });
        } else {
            updateEditorVisibility();
        }
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function restoreState() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
            if (!saved || !Array.isArray(saved.fs)) {
                return;
            }
            state.fs = saved.fs;
            state.openTabs = Array.isArray(saved.openTabs) ? saved.openTabs.filter(fileExistsIn(saved.fs)) : [];
            state.activePath = fileExistsIn(saved.fs)(saved.activePath) ? saved.activePath : state.openTabs[0] || null;
            state.selectedPath = saved.selectedPath || state.activePath || "data/workspace.json";
            state.activeView = Object.prototype.hasOwnProperty.call(viewTitles, saved.activeView) ? saved.activeView : "explorer";
            state.activePanel = saved.activePanel || "terminal";
            state.theme = saved.theme || "dark";
            state.fontSize = Number(saved.fontSize) || 14;
            state.wordWrap = Boolean(saved.wordWrap);
            state.sidebarWidth = clamp(Number(saved.sidebarWidth) || 286, 190, 430);
            state.panelHeight = clamp(Number(saved.panelHeight) || 190, 110, 420);
            state.panelHidden = Boolean(saved.panelHidden);
            state.dirtyPaths = new Set(Array.isArray(saved.dirtyPaths) ? saved.dirtyPaths.filter(fileExistsIn(saved.fs)) : []);
        } catch (error) {
            console.warn("Could not restore saved workspace.", error);
        }
    }

    function fileExistsIn(fs) {
        return (path) => Boolean(path && findEntry(path, fs)?.node?.type === "file");
    }

    function persistState() {
        clearTimeout(persistTimer);
        persistTimer = setTimeout(() => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    fs: state.fs,
                    openTabs: state.openTabs,
                    activePath: state.activePath,
                    selectedPath: state.selectedPath,
                    activeView: state.activeView,
                    activePanel: state.activePanel,
                    theme: state.theme,
                    fontSize: state.fontSize,
                    wordWrap: state.wordWrap,
                    sidebarWidth: state.sidebarWidth,
                    panelHeight: state.panelHeight,
                    panelHidden: state.panelHidden,
                    dirtyPaths: Array.from(state.dirtyPaths)
                }));
            } catch (error) {
                console.warn("Could not persist workspace.", error);
            }
        }, 160);
    }

    function bindStaticEvents() {
        $$(".activity-item[data-view]").forEach((button) => {
            button.addEventListener("click", () => switchView(button.dataset.view, true));
        });

        dom.commandCenter.addEventListener("click", () => openCommandPalette(">"));

        $("#new-file-button").addEventListener("click", () => promptCreate("file"));
        $("#new-folder-button").addEventListener("click", () => promptCreate("folder"));
        $("#refresh-button").addEventListener("click", () => {
            renderTree();
            showToast("Explorer refreshed.");
        });
        $("#collapse-button").addEventListener("click", collapseAllFolders);

        dom.searchInput.addEventListener("input", renderSearchResults);
        dom.replaceButton.addEventListener("click", replaceMatches);
        dom.commitButton.addEventListener("click", commitChanges);
        dom.commitMessage.addEventListener("keydown", (event) => {
            if (event.ctrlKey && event.key === "Enter") {
                commitChanges();
            }
        });

        dom.themeSelect.value = state.theme;
        dom.themeSelect.addEventListener("change", () => {
            applyTheme(dom.themeSelect.value);
            persistState();
        });

        dom.fontSizeInput.value = String(state.fontSize);
        dom.fontSizeInput.addEventListener("change", () => {
            state.fontSize = clamp(Number(dom.fontSizeInput.value) || 14, 11, 22);
            dom.fontSizeInput.value = String(state.fontSize);
            editor?.updateOptions({ fontSize: state.fontSize });
            persistState();
        });

        dom.wordWrapCheck.checked = state.wordWrap;
        dom.wordWrapCheck.addEventListener("change", () => {
            state.wordWrap = dom.wordWrapCheck.checked;
            editor?.updateOptions({ wordWrap: state.wordWrap ? "on" : "off" });
            persistState();
        });

        $$(".panel-tab").forEach((button) => {
            button.addEventListener("click", () => switchPanel(button.dataset.panel));
        });

        dom.togglePanelButton.addEventListener("click", togglePanel);
        dom.splitEditorButton.addEventListener("click", () => showToast("Editor split created."));
        dom.startDebugButton.addEventListener("click", () => runCommand("startDebug"));
        $("#notifications-button").addEventListener("click", () => showToast("No new notifications."));

        $$(".link-button[data-command]").forEach((button) => {
            button.addEventListener("click", () => runCommand(button.dataset.command));
        });

        $$(".recent-file").forEach((button) => {
            button.addEventListener("click", () => openFile(button.dataset.openPath));
        });

        $$(".menu-button").forEach((button) => {
            button.addEventListener("click", (event) => {
                event.stopPropagation();
                showMenu(button.dataset.menu, button);
            });
        });

        dom.commandInput.addEventListener("input", () => {
            state.commandIndex = 0;
            renderCommandList();
        });
        dom.commandInput.addEventListener("keydown", handleCommandKeydown);

        dom.dialogForm.addEventListener("submit", submitDialog);
        dom.dialogCancel.addEventListener("click", closeDialog);

        dom.contextMenu.addEventListener("click", (event) => {
            const button = event.target.closest("[data-context-action]");
            if (!button) {
                return;
            }
            const action = button.dataset.contextAction;
            hideContextMenu();
            runContextAction(action);
        });

        document.addEventListener("click", (event) => {
            if (!event.target.closest(".menu-popover") && !event.target.closest(".menu-button")) {
                hideMenu();
            }
            if (!event.target.closest(".context-menu")) {
                hideContextMenu();
            }
        });

        document.addEventListener("keydown", handleGlobalKeydown);
        initResizers();
    }

    function initMonaco() {
        const fallbackTimer = window.setTimeout(() => {
            if (!editor) {
                createFallbackEditor();
            }
        }, 7000);

        if (!window.require) {
            createFallbackEditor();
            return;
        }

        window.MonacoEnvironment = {
            getWorkerUrl() {
                const worker = [
                    `self.MonacoEnvironment = { baseUrl: "${MONACO_BASE}" };`,
                    `importScripts("${MONACO_BASE}vs/base/worker/workerMain.js");`
                ].join("");
                return `data:text/javascript;charset=utf-8,${encodeURIComponent(worker)}`;
            }
        };

        window.require.config({ paths: { vs: `${MONACO_BASE}vs` } });
        window.require(["vs/editor/editor.main"], () => {
            window.clearTimeout(fallbackTimer);
            editor = monaco.editor.create(dom.editorContainer, {
                automaticLayout: true,
                bracketPairColorization: { enabled: true },
                cursorBlinking: "smooth",
                fontFamily: "Consolas, 'Courier New', monospace",
                fontLigatures: false,
                fontSize: state.fontSize,
                lineHeight: 21,
                minimap: { enabled: true, renderCharacters: false, maxColumn: 80 },
                overviewRulerBorder: false,
                renderLineHighlight: "all",
                roundedSelection: false,
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                theme: monacoThemeName(),
                wordWrap: state.wordWrap ? "on" : "off"
            });

            editor.onDidChangeModelContent(() => {
                syncActiveContentFromEditor();
                markDirty(state.activePath);
            });

            editor.onDidChangeCursorPosition((event) => {
                updateCursorStatus(event.position);
            });

            if (state.activePath) {
                setModelForPath(state.activePath);
            }
        }, () => {
            window.clearTimeout(fallbackTimer);
            createFallbackEditor();
        });
    }

    function createFallbackEditor() {
        if (fallbackTextarea) {
            return;
        }
        fallbackTextarea = document.createElement("textarea");
        fallbackTextarea.className = "fallback-editor";
        fallbackTextarea.spellcheck = false;
        fallbackTextarea.addEventListener("input", () => {
            const entry = findEntry(state.activePath);
            if (entry?.node?.type === "file") {
                entry.node.content = fallbackTextarea.value;
                markDirty(state.activePath);
            }
        });
        fallbackTextarea.addEventListener("keyup", updateFallbackCursorStatus);
        fallbackTextarea.addEventListener("click", updateFallbackCursorStatus);
        dom.editorContainer.replaceChildren(fallbackTextarea);
        if (state.activePath) {
            setFallbackContent(state.activePath);
        }
        showToast("Monaco could not load, so a plain editor is active.");
    }

    function openFile(path, options = {}) {
        const entry = findEntry(path);
        if (!entry || entry.node.type !== "file") {
            showToast("File not found.");
            return;
        }

        if (!state.openTabs.includes(path)) {
            state.openTabs.push(path);
        }
        state.activePath = path;
        state.selectedPath = path;

        updateEditorVisibility();
        renderTabs();
        renderBreadcrumbs();
        renderTree();
        updateStatus();

        if (editor && window.monaco) {
            setModelForPath(path);
            if (options.line) {
                revealLine(options.line, options.column || 1, options.matchLength || 1);
            }
            if (!options.preserveFocus) {
                editor.focus();
            }
        } else if (fallbackTextarea) {
            setFallbackContent(path);
        }

        persistState();
    }

    function setModelForPath(path) {
        const entry = findEntry(path);
        if (!entry?.node || !window.monaco || !editor) {
            return;
        }
        let model = state.models.get(path);
        if (!model) {
            model = monaco.editor.createModel(
                entry.node.content,
                getLanguage(path),
                monaco.Uri.parse(`inmemory://web-project/${encodePath(path)}`)
            );
            state.models.set(path, model);
        } else {
            monaco.editor.setModelLanguage(model, getLanguage(path));
        }
        editor.setModel(model);
        updateCursorStatus(editor.getPosition() || { lineNumber: 1, column: 1 });
        updateStatus();
    }

    function setFallbackContent(path) {
        const entry = findEntry(path);
        if (entry?.node?.type === "file") {
            fallbackTextarea.value = entry.node.content;
            updateFallbackCursorStatus();
        }
    }

    function syncActiveContentFromEditor() {
        if (!state.activePath || !editor) {
            return;
        }
        const entry = findEntry(state.activePath);
        if (entry?.node?.type === "file") {
            entry.node.content = editor.getValue();
        }
    }

    function markDirty(path) {
        if (!path) {
            return;
        }
        state.dirtyPaths.add(path);
        renderTabs();
        renderSCM();
        if (state.activeView === "search" && dom.searchInput.value.trim()) {
            renderSearchResults();
        }
        persistState();
    }

    function saveActiveFile() {
        if (!state.activePath) {
            showToast("No active editor.");
            return;
        }
        state.dirtyPaths.delete(state.activePath);
        renderTabs();
        renderSCM();
        showToast(`${basename(state.activePath)} saved.`);
        persistState();
    }

    function saveAllFiles() {
        if (!state.dirtyPaths.size) {
            showToast("All files are already saved.");
            return;
        }
        state.dirtyPaths.clear();
        renderTabs();
        renderSCM();
        showToast("All files saved.");
        persistState();
    }

    function closeTab(path) {
        const index = state.openTabs.indexOf(path);
        if (index === -1) {
            return;
        }
        state.openTabs.splice(index, 1);
        if (state.activePath === path) {
            const next = state.openTabs[index] || state.openTabs[index - 1] || null;
            state.activePath = next;
            if (next) {
                openFile(next, { preserveFocus: true });
                return;
            }
            if (editor) {
                editor.setModel(null);
            }
        }
        renderTabs();
        renderBreadcrumbs();
        updateEditorVisibility();
        updateStatus();
        persistState();
    }

    function closeAllEditors() {
        state.openTabs = [];
        state.activePath = null;
        if (editor) {
            editor.setModel(null);
        }
        renderTabs();
        renderBreadcrumbs();
        updateEditorVisibility();
        updateStatus();
        persistState();
    }

    function renderTree() {
        dom.tree.replaceChildren();
        state.fs.forEach((node) => renderTreeNode(node, "", 0));
    }

    function renderTreeNode(node, parentPath, level) {
        const path = joinPath(parentPath, node.name);
        const row = document.createElement("div");
        row.className = `tree-row ${node.type}`;
        row.dataset.path = path;
        row.dataset.type = node.type;
        row.style.setProperty("--level", String(level));
        row.draggable = true;

        if (path === state.selectedPath || path === state.activePath) {
            row.classList.add("selected");
        }

        const twisty = document.createElement("span");
        twisty.className = "twisty";
        if (node.type === "folder") {
            const twistyIcon = document.createElement("span");
            twistyIcon.className = `codicon ${node.expanded ? "codicon-chevron-down" : "codicon-chevron-right"}`;
            twisty.appendChild(twistyIcon);
        } else {
            twisty.classList.add("empty");
        }

        const kind = document.createElement("span");
        kind.className = `tree-kind ${node.type === "folder" ? "folder-kind" : "file-kind"}`;
        if (node.type === "folder") {
            const folderIcon = document.createElement("span");
            folderIcon.className = `codicon ${node.expanded ? "codicon-folder-opened" : "codicon-folder"}`;
            kind.appendChild(folderIcon);
        } else {
            kind.dataset.ext = getExt(node.name);
            kind.dataset.badge = fileBadge(node.name);
        }

        const name = document.createElement("span");
        name.className = "tree-name";
        name.textContent = node.name;

        const extra = document.createElement("span");
        if (node.type === "file" && state.dirtyPaths.has(path)) {
            extra.className = "dirty-dot";
        }

        row.append(twisty, kind, name, extra);
        dom.tree.appendChild(row);

        row.addEventListener("click", (event) => {
            event.stopPropagation();
            state.selectedPath = path;
            if (node.type === "folder") {
                node.expanded = !node.expanded;
                renderTree();
                persistState();
            } else {
                openFile(path);
            }
        });

        row.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            event.stopPropagation();
            state.selectedPath = path;
            renderTree();
            showContextMenu(event.clientX, event.clientY, path);
        });

        row.addEventListener("dragstart", (event) => {
            event.dataTransfer.setData("text/plain", path);
            event.dataTransfer.effectAllowed = "move";
        });

        row.addEventListener("dragover", (event) => {
            if (node.type !== "folder") {
                return;
            }
            event.preventDefault();
            row.classList.add("drop-target");
        });

        row.addEventListener("dragleave", () => row.classList.remove("drop-target"));
        row.addEventListener("drop", (event) => {
            row.classList.remove("drop-target");
            const sourcePath = event.dataTransfer.getData("text/plain");
            if (node.type === "folder" && sourcePath && sourcePath !== path) {
                moveEntry(sourcePath, path);
            }
        });

        if (node.type === "folder" && node.expanded) {
            node.children.forEach((child) => renderTreeNode(child, path, level + 1));
        }
    }

    function renderTabs() {
        dom.tabs.replaceChildren();
        state.openTabs = state.openTabs.filter(fileExists);

        state.openTabs.forEach((path) => {
            const tab = document.createElement("div");
            tab.className = "tab";
            tab.dataset.path = path;
            if (path === state.activePath) {
                tab.classList.add("active");
            }

            const kind = document.createElement("span");
            kind.className = "file-kind";
            kind.dataset.ext = getExt(path);
            kind.dataset.badge = fileBadge(path);

            const title = document.createElement("span");
            title.className = "tab-title";
            title.textContent = basename(path);

            const close = document.createElement("button");
            close.className = "tab-close";
            close.type = "button";
            close.title = "Close";
            close.textContent = "x";

            if (state.dirtyPaths.has(path)) {
                const dot = document.createElement("span");
                dot.className = "dirty-dot";
                close.replaceChildren(dot);
            }

            tab.append(kind, title, close);
            dom.tabs.appendChild(tab);

            tab.addEventListener("click", () => openFile(path));
            close.addEventListener("click", (event) => {
                event.stopPropagation();
                closeTab(path);
            });
        });
    }

    function renderBreadcrumbs() {
        dom.breadcrumbs.replaceChildren();
        const parts = state.activePath ? ["web-project", ...state.activePath.split("/")] : ["web-project"];
        parts.forEach((part, index) => {
            if (index > 0) {
                const separator = document.createElement("span");
                separator.className = "breadcrumb-separator";
                separator.textContent = ">";
                dom.breadcrumbs.appendChild(separator);
            }
            const span = document.createElement("span");
            span.className = "breadcrumb-part";
            span.textContent = part;
            dom.breadcrumbs.appendChild(span);
        });
    }

    function renderSCM() {
        const dirty = Array.from(state.dirtyPaths).filter(fileExists);
        state.dirtyPaths = new Set(dirty);
        dom.changesCount.textContent = String(dirty.length);
        $("#explorer-badge").textContent = String(Math.max(dirty.length, 0));
        $("#explorer-badge").hidden = dirty.length === 0;
        dom.changesList.replaceChildren();

        if (!dirty.length) {
            const empty = document.createElement("div");
            empty.className = "debug-empty";
            empty.textContent = "No changes.";
            dom.changesList.appendChild(empty);
            return;
        }

        dirty.forEach((path) => {
            const row = document.createElement("div");
            row.className = "change-row";
            const stateBadge = document.createElement("span");
            stateBadge.className = "change-state";
            stateBadge.textContent = "M";
            const name = document.createElement("span");
            name.className = "change-path";
            name.textContent = basename(path);
            const folder = document.createElement("span");
            folder.className = "extension-meta";
            folder.textContent = dirname(path) || ".";
            row.append(stateBadge, name, folder);
            row.addEventListener("click", () => openFile(path));
            dom.changesList.appendChild(row);
        });
    }

    function renderSearchResults() {
        const query = dom.searchInput.value;
        const normalized = query.trim().toLowerCase();
        const files = flattenFiles();
        let hitCount = 0;
        let fileCount = 0;

        dom.searchResults.replaceChildren();

        if (!normalized) {
            dom.searchMeta.textContent = "No results.";
            return;
        }

        files.forEach(({ path, node }) => {
            const lines = node.content.split(/\r?\n/);
            const hits = [];
            lines.forEach((line, index) => {
                const column = line.toLowerCase().indexOf(normalized);
                if (column !== -1) {
                    hits.push({ line, lineNumber: index + 1, column: column + 1 });
                }
            });

            if (!hits.length) {
                return;
            }

            fileCount += 1;
            hitCount += hits.length;
            const group = document.createElement("div");
            group.className = "search-file";
            const title = document.createElement("div");
            title.className = "search-file-title";
            title.textContent = `${basename(path)}  ${dirname(path) || "."}`;
            group.appendChild(title);

            hits.forEach((hit) => {
                const button = document.createElement("button");
                button.className = "search-hit";
                button.type = "button";
                button.innerHTML = searchHitHTML(hit.line, normalized, hit.lineNumber);
                button.addEventListener("click", () => {
                    openFile(path, { line: hit.lineNumber, column: hit.column, matchLength: query.length });
                });
                group.appendChild(button);
            });
            dom.searchResults.appendChild(group);
        });

        dom.searchMeta.textContent = hitCount
            ? `${hitCount} result${hitCount === 1 ? "" : "s"} in ${fileCount} file${fileCount === 1 ? "" : "s"}`
            : "No results.";
    }

    function searchHitHTML(line, query, lineNumber) {
        const escapedLine = escapeHTML(line);
        const lower = line.toLowerCase();
        const index = lower.indexOf(query);
        if (index === -1) {
            return `${lineNumber}: ${escapedLine}`;
        }
        const before = escapeHTML(line.slice(0, index));
        const match = escapeHTML(line.slice(index, index + query.length));
        const after = escapeHTML(line.slice(index + query.length));
        return `${lineNumber}: ${before}<mark>${match}</mark>${after}`;
    }

    function replaceMatches() {
        const query = dom.searchInput.value;
        const replacement = dom.replaceInput.value;
        if (!query) {
            showToast("Enter search text first.");
            return;
        }
        let replacements = 0;
        flattenFiles().forEach(({ path, node }) => {
            const before = node.content;
            const pattern = new RegExp(escapeRegExp(query), "gi");
            node.content = node.content.replace(pattern, () => {
                replacements += 1;
                return replacement;
            });
            if (before !== node.content) {
                state.dirtyPaths.add(path);
                const model = state.models.get(path);
                if (model && model.getValue() !== node.content) {
                    model.setValue(node.content);
                }
            }
        });
        renderSearchResults();
        renderTabs();
        renderSCM();
        showToast(`${replacements} replacement${replacements === 1 ? "" : "s"} made.`);
        persistState();
    }

    function promptCreate(type, parentPath = selectedFolderPath()) {
        showInputDialog({
            title: type === "file" ? "New File" : "New Folder",
            label: type === "file" ? "File name" : "Folder name",
            value: type === "file" ? "untitled.js" : "New Folder",
            validate: (value) => validateNewName(parentPath, value),
            onSubmit: (value) => createEntry(type, parentPath, value.trim())
        });
    }

    function createEntry(type, parentPath, name) {
        const parent = parentPath ? findEntry(parentPath)?.node : { type: "folder", children: state.fs, expanded: true };
        if (!parent || parent.type !== "folder") {
            showToast("Choose a folder first.");
            return;
        }

        const node = type === "folder"
            ? { type: "folder", name, expanded: true, children: [] }
            : { type: "file", name, content: defaultContentFor(name) };

        parent.children.push(node);
        parent.children.sort(sortNodes);
        if ("expanded" in parent) {
            parent.expanded = true;
        }

        const path = joinPath(parentPath, name);
        state.selectedPath = path;
        renderTree();
        if (type === "file") {
            openFile(path);
        } else {
            persistState();
        }
    }

    function promptRename(path) {
        const entry = findEntry(path);
        if (!entry || !path) {
            showToast("Select an item to rename.");
            return;
        }
        const parentPath = dirname(path);
        showInputDialog({
            title: "Rename",
            label: "New name",
            value: entry.node.name,
            validate: (value) => validateNewName(parentPath, value, entry.node.name),
            onSubmit: (value) => renameEntry(path, value.trim())
        });
    }

    function renameEntry(path, newName) {
        const entry = findEntry(path);
        if (!entry || entry.node.name === newName) {
            return;
        }

        const oldPaths = collectEntryPaths(entry.node, path);
        entry.node.name = newName;
        const newPath = joinPath(dirname(path), newName);
        const newPaths = collectEntryPaths(entry.node, newPath);

        oldPaths.forEach((oldPath, index) => updatePathReference(oldPath, newPaths[index]));
        entry.parent?.children.sort(sortNodes);

        renderTree();
        renderTabs();
        renderBreadcrumbs();
        renderSearchResults();
        renderSCM();
        updateStatus();
        if (state.activePath) {
            if (editor) {
                setModelForPath(state.activePath);
            } else if (fallbackTextarea) {
                setFallbackContent(state.activePath);
            }
        }
        persistState();
    }

    function deleteEntry(path) {
        const entry = findEntry(path);
        if (!entry || !entry.parent) {
            showToast("Select an item to delete.");
            return;
        }
        const label = entry.node.type === "folder" ? "folder" : "file";
        if (!window.confirm(`Delete ${label} "${entry.node.name}"?`)) {
            return;
        }

        const paths = collectEntryPaths(entry.node, path);
        entry.parent.children.splice(entry.index, 1);

        paths.forEach((deletedPath) => {
            state.dirtyPaths.delete(deletedPath);
            const model = state.models.get(deletedPath);
            if (model) {
                model.dispose();
                state.models.delete(deletedPath);
            }
        });

        state.openTabs = state.openTabs.filter((tabPath) => !paths.includes(tabPath));
        if (paths.includes(state.activePath)) {
            state.activePath = state.openTabs[0] || null;
            if (state.activePath) {
                openFile(state.activePath, { preserveFocus: true });
                return;
            }
            editor?.setModel(null);
        }

        state.selectedPath = dirname(path);
        renderTree();
        renderTabs();
        renderBreadcrumbs();
        updateEditorVisibility();
        renderSCM();
        updateStatus();
        persistState();
    }

    function moveEntry(sourcePath, targetFolderPath) {
        const source = findEntry(sourcePath);
        const target = findEntry(targetFolderPath);
        if (!source || !source.parent || !target || target.node.type !== "folder") {
            return;
        }
        if (sourcePath === targetFolderPath || targetFolderPath.startsWith(`${sourcePath}/`)) {
            showToast("Cannot move a folder into itself.");
            return;
        }
        if (target.node.children.some((child) => child.name === source.node.name)) {
            showToast("A file or folder with that name already exists.");
            return;
        }

        const oldPaths = collectEntryPaths(source.node, sourcePath);
        const [node] = source.parent.children.splice(source.index, 1);
        target.node.children.push(node);
        target.node.children.sort(sortNodes);
        target.node.expanded = true;

        const newPath = joinPath(targetFolderPath, node.name);
        const newPaths = collectEntryPaths(node, newPath);
        oldPaths.forEach((oldPath, index) => updatePathReference(oldPath, newPaths[index]));

        renderTree();
        renderTabs();
        renderBreadcrumbs();
        renderSCM();
        updateStatus();
        persistState();
    }

    function updatePathReference(oldPath, newPath) {
        state.openTabs = state.openTabs.map((path) => path === oldPath ? newPath : path);
        if (state.activePath === oldPath) {
            state.activePath = newPath;
        }
        if (state.selectedPath === oldPath) {
            state.selectedPath = newPath;
        }
        if (state.dirtyPaths.has(oldPath)) {
            state.dirtyPaths.delete(oldPath);
            state.dirtyPaths.add(newPath);
        }
        if (state.models.has(oldPath)) {
            const model = state.models.get(oldPath);
            state.models.delete(oldPath);
            state.models.set(newPath, model);
            if (window.monaco) {
                monaco.editor.setModelLanguage(model, getLanguage(newPath));
            }
        }
    }

    function collapseAllFolders() {
        walkFolders(state.fs, (folder) => {
            folder.expanded = false;
        });
        renderTree();
        persistState();
    }

    function commitChanges() {
        if (!state.dirtyPaths.size) {
            showToast("There are no changes to commit.");
            return;
        }
        const message = dom.commitMessage.value.trim() || "Update workspace";
        state.dirtyPaths.clear();
        dom.commitMessage.value = "";
        renderTabs();
        renderSCM();
        showToast(`Committed: ${message}`);
        persistState();
    }

    function switchView(view, focus = false) {
        state.activeView = view;
        $$(".activity-item[data-view]").forEach((button) => {
            button.classList.toggle("active", button.dataset.view === view);
        });
        $$(".sidebar-view").forEach((panel) => {
            panel.hidden = panel.dataset.viewPanel !== view;
            panel.classList.toggle("active", panel.dataset.viewPanel === view);
        });
        dom.sidebarTitle.textContent = viewTitles[view] || view;
        dom.explorerActions.hidden = view !== "explorer";
        if (focus) {
            if (view === "search") {
                dom.searchInput.focus();
            }
        }
        persistState();
    }

    function switchPanel(panel) {
        state.activePanel = panel;
        $$(".panel-tab").forEach((button) => {
            button.classList.toggle("active", button.dataset.panel === panel);
        });
        ["problems", "output", "debug", "terminal"].forEach((name) => {
            $(`#panel-${name}`).hidden = name !== panel;
        });
        persistState();
    }

    function togglePanel() {
        setPanelHidden(!state.panelHidden);
        persistState();
    }

    function setPanelHidden(hidden) {
        state.panelHidden = hidden;
        dom.editorWorkbench.classList.toggle("panel-hidden", hidden);
    }

    function openCommandPalette(prefix = ">") {
        hideMenu();
        hideContextMenu();
        dom.commandPalette.hidden = false;
        dom.commandInput.value = prefix;
        state.commandIndex = 0;
        renderCommandList();
        window.setTimeout(() => {
            dom.commandInput.focus();
            dom.commandInput.setSelectionRange(dom.commandInput.value.length, dom.commandInput.value.length);
        }, 0);
    }

    function closeCommandPalette() {
        dom.commandPalette.hidden = true;
    }

    function renderCommandList() {
        const raw = dom.commandInput.value;
        const commandMode = raw.trim().startsWith(">");
        const query = raw.replace(/^>/, "").trim().toLowerCase();
        const list = commandMode ? commands : fileCommands();
        const filtered = list.filter((item) => {
            const text = `${item.title} ${item.detail || ""}`.toLowerCase();
            return !query || text.includes(query);
        }).slice(0, 12);

        if (state.commandIndex >= filtered.length) {
            state.commandIndex = Math.max(0, filtered.length - 1);
        }

        dom.commandList.replaceChildren();
        filtered.forEach((item, index) => {
            const button = document.createElement("button");
            button.className = "command-item";
            button.type = "button";
            button.classList.toggle("active", index === state.commandIndex);
            const label = document.createElement("span");
            label.textContent = item.title;
            const detail = document.createElement("span");
            detail.className = "command-detail";
            detail.textContent = item.detail || "";
            button.append(label, detail);
            button.addEventListener("mouseenter", () => {
                state.commandIndex = index;
                renderCommandList();
            });
            button.addEventListener("click", () => {
                closeCommandPalette();
                item.run();
            });
            dom.commandList.appendChild(button);
        });

        if (!filtered.length) {
            const empty = document.createElement("div");
            empty.className = "command-item";
            empty.textContent = "No matching commands";
            dom.commandList.appendChild(empty);
        }
    }

    function fileCommands() {
        return flattenFiles().map(({ path }) => ({
            id: `open:${path}`,
            title: path,
            detail: "Open file",
            run: () => openFile(path)
        }));
    }

    function handleCommandKeydown(event) {
        const items = $$(".command-item", dom.commandList).filter((item) => !item.textContent.includes("No matching"));
        if (event.key === "Escape") {
            closeCommandPalette();
            event.preventDefault();
        } else if (event.key === "ArrowDown") {
            state.commandIndex = Math.min(items.length - 1, state.commandIndex + 1);
            renderCommandList();
            event.preventDefault();
        } else if (event.key === "ArrowUp") {
            state.commandIndex = Math.max(0, state.commandIndex - 1);
            renderCommandList();
            event.preventDefault();
        } else if (event.key === "Enter") {
            const active = $$(".command-item", dom.commandList)[state.commandIndex];
            active?.click();
            event.preventDefault();
        }
    }

    function showMenu(name, anchor) {
        const entries = menuDefinitions[name] || [];
        hideContextMenu();
        $$(".menu-button").forEach((button) => {
            button.classList.toggle("active", button === anchor);
        });
        dom.menuPopover.replaceChildren();
        entries.forEach((entry) => {
            if (entry.type === "separator") {
                const separator = document.createElement("div");
                separator.className = "menu-separator";
                dom.menuPopover.appendChild(separator);
                return;
            }
            const button = document.createElement("button");
            button.type = "button";
            const label = document.createElement("span");
            label.textContent = entry.label;
            const shortcut = document.createElement("span");
            shortcut.className = "menu-shortcut";
            shortcut.textContent = entry.shortcut || "";
            button.append(label, shortcut);
            button.addEventListener("click", () => {
                hideMenu();
                runCommand(entry.command);
            });
            dom.menuPopover.appendChild(button);
        });

        const rect = anchor.getBoundingClientRect();
        dom.menuPopover.style.left = `${rect.left}px`;
        dom.menuPopover.style.top = `${rect.bottom}px`;
        dom.menuPopover.hidden = false;
    }

    function hideMenu() {
        dom.menuPopover.hidden = true;
        $$(".menu-button").forEach((button) => button.classList.remove("active"));
    }

    function showContextMenu(x, y, path) {
        hideMenu();
        state.contextPath = path;
        dom.contextMenu.style.left = `${Math.min(x, window.innerWidth - 210)}px`;
        dom.contextMenu.style.top = `${Math.min(y, window.innerHeight - 128)}px`;
        dom.contextMenu.hidden = false;
    }

    function hideContextMenu() {
        dom.contextMenu.hidden = true;
    }

    function runContextAction(action) {
        const path = state.contextPath || state.selectedPath || state.activePath;
        if (action === "newFile") {
            promptCreate("file", contextFolderPath(path));
        } else if (action === "newFolder") {
            promptCreate("folder", contextFolderPath(path));
        } else if (action === "rename") {
            promptRename(path);
        } else if (action === "delete") {
            deleteEntry(path);
        }
    }

    function runCommand(commandId) {
        const command = commands.find((item) => item.id === commandId);
        if (command) {
            command.run();
        }
    }

    function showInputDialog({ title, label, value, validate, onSubmit }) {
        state.dialog = { validate, onSubmit };
        dom.dialogTitle.textContent = title;
        dom.dialogLabel.textContent = label;
        dom.dialogInput.value = value || "";
        dom.dialogError.textContent = "";
        dom.dialogBackdrop.hidden = false;
        window.setTimeout(() => {
            dom.dialogInput.focus();
            dom.dialogInput.select();
        }, 0);
    }

    function submitDialog(event) {
        event.preventDefault();
        if (!state.dialog) {
            return;
        }
        const value = dom.dialogInput.value.trim();
        const error = state.dialog.validate?.(value);
        if (error) {
            dom.dialogError.textContent = error;
            dom.dialogInput.focus();
            return;
        }
        const submit = state.dialog.onSubmit;
        closeDialog();
        submit(value);
    }

    function closeDialog() {
        dom.dialogBackdrop.hidden = true;
        state.dialog = null;
    }

    function handleGlobalKeydown(event) {
        if (event.key === "Escape") {
            hideMenu();
            hideContextMenu();
            closeCommandPalette();
            if (!dom.dialogBackdrop.hidden) {
                closeDialog();
            }
        }

        if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "p") {
            openCommandPalette(">");
            event.preventDefault();
            return;
        }

        if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "p") {
            openCommandPalette("");
            event.preventDefault();
            return;
        }

        if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "f") {
            switchView("search", true);
            event.preventDefault();
            return;
        }

        if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "e") {
            switchView("explorer", true);
            event.preventDefault();
            return;
        }

        if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "g") {
            switchView("scm", true);
            event.preventDefault();
            return;
        }

        if (event.ctrlKey && event.key.toLowerCase() === "n") {
            promptCreate("file");
            event.preventDefault();
            return;
        }

        if (event.ctrlKey && event.key.toLowerCase() === "s") {
            event.shiftKey ? saveAllFiles() : saveActiveFile();
            event.preventDefault();
            return;
        }

        if (event.ctrlKey && event.key.toLowerCase() === "w") {
            if (state.activePath) {
                closeTab(state.activePath);
            }
            event.preventDefault();
            return;
        }

        if (event.ctrlKey && event.key === "`") {
            togglePanel();
            event.preventDefault();
            return;
        }

        if (event.key === "F2") {
            promptRename(state.selectedPath || state.activePath);
            event.preventDefault();
            return;
        }

        if (event.key === "F5") {
            runCommand("startDebug");
            event.preventDefault();
        }
    }

    function initResizers() {
        dom.sidebarResizer.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            dom.sidebarResizer.classList.add("dragging");
            const onMove = (moveEvent) => {
                state.sidebarWidth = clamp(moveEvent.clientX - Number(getComputedStyle(dom.root).getPropertyValue("--activity-width").replace("px", "")), 190, 430);
                applyLayoutVariables();
            };
            const onUp = () => {
                dom.sidebarResizer.classList.remove("dragging");
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
                persistState();
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
        });

        dom.panelResizer.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            dom.panelResizer.classList.add("dragging");
            const onMove = (moveEvent) => {
                const statusHeight = Number(getComputedStyle(dom.root).getPropertyValue("--status-height").replace("px", "")) || 22;
                state.panelHeight = clamp(window.innerHeight - moveEvent.clientY - statusHeight, 110, 420);
                applyLayoutVariables();
            };
            const onUp = () => {
                dom.panelResizer.classList.remove("dragging");
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
                persistState();
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
        });
    }

    function applyLayoutVariables() {
        dom.root.style.setProperty("--sidebar-width", `${state.sidebarWidth}px`);
        dom.root.style.setProperty("--panel-height", `${state.panelHeight}px`);
    }

    function applyTheme(theme) {
        state.theme = theme || "dark";
        dom.body.dataset.theme = state.theme;
        dom.themeSelect.value = state.theme;
        if (window.monaco?.editor) {
            monaco.editor.setTheme(monacoThemeName());
        }
    }

    function monacoThemeName() {
        return state.theme === "hc" ? "hc-black" : "vs-dark";
    }

    function updateEditorVisibility() {
        dom.emptyEditor.classList.toggle("hidden", Boolean(state.activePath));
        dom.editorContainer.hidden = !state.activePath;
    }

    function updateStatus() {
        const path = state.activePath;
        dom.statusFile.textContent = path || "No file";
        dom.statusLanguage.textContent = path ? languageLabel(path) : "Plain Text";
        dom.statusSpaces.textContent = "Spaces: 2";
        if (!path) {
            dom.statusPosition.textContent = "Ln 1, Col 1";
        }
    }

    function updateCursorStatus(position) {
        const line = position?.lineNumber || 1;
        const column = position?.column || 1;
        dom.statusPosition.textContent = `Ln ${line}, Col ${column}`;
    }

    function updateFallbackCursorStatus() {
        if (!fallbackTextarea) {
            return;
        }
        const value = fallbackTextarea.value.slice(0, fallbackTextarea.selectionStart);
        const lines = value.split(/\r?\n/);
        updateCursorStatus({ lineNumber: lines.length, column: lines[lines.length - 1].length + 1 });
    }

    function revealLine(lineNumber, column, matchLength) {
        if (!editor) {
            return;
        }
        editor.setPosition({ lineNumber, column });
        editor.revealLineInCenter(lineNumber);
        editor.setSelection({
            startLineNumber: lineNumber,
            startColumn: column,
            endLineNumber: lineNumber,
            endColumn: column + matchLength
        });
        editor.focus();
    }

    function findInEditor() {
        if (editor) {
            editor.getAction("actions.find")?.run();
        } else {
            fallbackTextarea?.focus();
        }
    }

    function selectAllInEditor() {
        if (editor) {
            editor.trigger("keyboard", "editor.action.selectAll", null);
        } else {
            fallbackTextarea?.select();
        }
    }

    function promptGoToLine() {
        if (!state.activePath) {
            showToast("Open a file first.");
            return;
        }
        showInputDialog({
            title: "Go to Line/Column",
            label: "Line number",
            value: "1",
            validate: (value) => Number.isInteger(Number(value)) && Number(value) > 0 ? "" : "Enter a positive line number.",
            onSubmit: (value) => revealLine(Number(value), 1, 1)
        });
    }

    function formatDocument() {
        if (!editor) {
            showToast("Format Document is available when Monaco is loaded.");
            return;
        }
        const action = editor.getAction("editor.action.formatDocument");
        action?.run();
        showToast("Format Document");
    }

    function toggleWordWrap() {
        state.wordWrap = !state.wordWrap;
        dom.wordWrapCheck.checked = state.wordWrap;
        editor?.updateOptions({ wordWrap: state.wordWrap ? "on" : "off" });
        persistState();
        showToast(`Word Wrap ${state.wordWrap ? "on" : "off"}.`);
    }

    function appendTerminal(message) {
        switchPanel("terminal");
        setPanelHidden(false);
        const line = document.createElement("div");
        line.className = "terminal-line muted";
        line.textContent = message;
        $("#panel-terminal").appendChild(line);
    }

    function clearTerminal() {
        switchPanel("terminal");
        $("#panel-terminal").replaceChildren();
        appendTerminal("Terminal cleared.");
    }

    function showToast(message) {
        window.clearTimeout(toastTimer);
        dom.toast.textContent = message;
        dom.toast.hidden = false;
        toastTimer = window.setTimeout(() => {
            dom.toast.hidden = true;
        }, 2300);
    }

    function flattenFiles(nodes = state.fs, prefix = "") {
        const files = [];
        nodes.forEach((node) => {
            const path = joinPath(prefix, node.name);
            if (node.type === "file") {
                files.push({ path, node });
            } else {
                files.push(...flattenFiles(node.children, path));
            }
        });
        return files;
    }

    function findEntry(path, nodes = state.fs, prefix = "", parent = null) {
        if (!path) {
            return null;
        }
        for (let index = 0; index < nodes.length; index += 1) {
            const node = nodes[index];
            const currentPath = joinPath(prefix, node.name);
            if (currentPath === path) {
                return { node, parent, index, path: currentPath };
            }
            if (node.type === "folder") {
                const found = findEntry(path, node.children, currentPath, node);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }

    function fileExists(path) {
        return Boolean(path && findEntry(path)?.node?.type === "file");
    }

    function selectedFolderPath() {
        const selected = findEntry(state.selectedPath);
        if (selected?.node?.type === "folder") {
            return state.selectedPath;
        }
        if (selected?.node?.type === "file") {
            return dirname(state.selectedPath);
        }
        return state.activePath ? dirname(state.activePath) : "";
    }

    function contextFolderPath(path) {
        const entry = findEntry(path);
        if (entry?.node?.type === "folder") {
            return path;
        }
        if (entry?.node?.type === "file") {
            return dirname(path);
        }
        return "";
    }

    function collectEntryPaths(node, path) {
        const paths = [path];
        if (node.type === "folder") {
            node.children.forEach((child) => {
                paths.push(...collectEntryPaths(child, joinPath(path, child.name)));
            });
        }
        return paths;
    }

    function walkFolders(nodes, visitor) {
        nodes.forEach((node) => {
            if (node.type === "folder") {
                visitor(node);
                walkFolders(node.children, visitor);
            }
        });
    }

    function joinPath(parent, name) {
        return parent ? `${parent}/${name}` : name;
    }

    function basename(path) {
        return path ? path.split("/").pop() : "";
    }

    function dirname(path) {
        if (!path || !path.includes("/")) {
            return "";
        }
        return path.split("/").slice(0, -1).join("/");
    }

    function getExt(path) {
        const name = basename(path);
        const index = name.lastIndexOf(".");
        return index === -1 ? "" : name.slice(index + 1).toLowerCase();
    }

    function getLanguage(path) {
        const map = {
            js: "javascript",
            jsx: "javascript",
            ts: "typescript",
            tsx: "typescript",
            css: "css",
            html: "html",
            json: "json",
            md: "markdown"
        };
        return map[getExt(path)] || "plaintext";
    }

    function languageLabel(path) {
        const map = {
            javascript: "JavaScript",
            typescript: "TypeScript",
            css: "CSS",
            html: "HTML",
            json: "JSON",
            markdown: "Markdown",
            plaintext: "Plain Text"
        };
        return map[getLanguage(path)] || "Plain Text";
    }

    function fileBadge(path) {
        const ext = getExt(path);
        if (["js", "jsx", "ts", "tsx"].includes(ext)) {
            return ext.toUpperCase().slice(0, 2);
        }
        if (ext === "css") {
            return "#";
        }
        if (ext === "html") {
            return "<>";
        }
        if (ext === "json") {
            return "{}";
        }
        if (ext === "md") {
            return "M";
        }
        return "";
    }

    function defaultContentFor(name) {
        const language = getLanguage(name);
        if (language === "javascript") {
            return [
                `// ${name}`,
                "",
                "export function main() {",
                "  console.log(\"Hello from the web workspace\");",
                "}",
                ""
            ].join("\n");
        }
        if (language === "css") {
            return [
                `/* ${name} */`,
                "",
                ".selector {",
                "  color: #cccccc;",
                "}",
                ""
            ].join("\n");
        }
        if (language === "html") {
            return [
                "<!doctype html>",
                "<html>",
                "<body>",
                `  <h1>${escapeHTML(name)}</h1>`,
                "</body>",
                "</html>",
                ""
            ].join("\n");
        }
        if (language === "json") {
            return "{\n  \"name\": \"new-file\"\n}\n";
        }
        if (language === "markdown") {
            return `# ${name}\n\n`;
        }
        return "";
    }

    function validateNewName(parentPath, value, currentName = "") {
        const name = value.trim();
        if (!name) {
            return "A name is required.";
        }
        if (/[\\/:*?"<>|]/.test(name)) {
            return "Use a name without path separators or reserved characters.";
        }
        if (name === currentName) {
            return "";
        }
        const parent = parentPath ? findEntry(parentPath)?.node : { type: "folder", children: state.fs };
        if (!parent || parent.type !== "folder") {
            return "The parent folder does not exist.";
        }
        if (parent.children.some((child) => child.name.toLowerCase() === name.toLowerCase())) {
            return "A file or folder with that name already exists.";
        }
        return "";
    }

    function sortNodes(a, b) {
        if (a.type !== b.type) {
            return a.type === "folder" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    }

    function encodePath(path) {
        return path.split("/").map(encodeURIComponent).join("/");
    }

    function escapeHTML(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll("\"", "&quot;")
            .replaceAll("'", "&#039;");
    }

    function escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
})();
