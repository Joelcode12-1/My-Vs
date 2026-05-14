import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";
import { 
  Files, 
  Search, 
  GitBranch, 
  Blocks, 
  Settings, 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  FileCode, 
  FileJson, 
  FileText, 
  Sun, 
  Moon, 
  X,
  User,
  Terminal as TerminalIcon,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg: "#1e1e1e",
    sidebar: "#252526",
    activityBar: "#333333",
    panel: "#1e1e1e",
    tabBar: "#2d2d2d",
    tab: "#2d2d2d",
    tabActive: "#1e1e1e",
    tabBorder: "#252526",
    text: "#cccccc",
    textMuted: "#858585",
    textActive: "#ffffff",
    accent: "#007acc",
    accentHover: "#1a8fe8",
    border: "#3c3c3c",
    selection: "#264f78",
    lineNum: "#858585",
    terminal: "#1e1e1e",
    terminalText: "#cccccc",
    hover: "#2a2d2e",
    inputBg: "#3c3c3c",
    badge: "#007acc",
    scrollbar: "#424242",
    minimap: "#252526",
    statusBar: "#007acc",
    statusText: "#ffffff",
  },
  light: {
    bg: "#ffffff",
    sidebar: "#f3f3f3",
    activityBar: "#2c2c2c",
    panel: "#ffffff",
    tabBar: "#ececec",
    tab: "#ececec",
    tabActive: "#ffffff",
    tabBorder: "#d4d4d4",
    text: "#333333",
    textMuted: "#717171",
    textActive: "#000000",
    accent: "#005fb8",
    accentHover: "#0070cc",
    border: "#e4e4e4",
    selection: "#add6ff",
    lineNum: "#999999",
    terminal: "#ffffff",
    terminalText: "#333333",
    hover: "#e8e8e8",
    inputBg: "#ffffff",
    badge: "#005fb8",
    scrollbar: "#c1c1c1",
    minimap: "#f3f3f3",
    statusBar: "#005fb8",
    statusText: "#ffffff",
  },
};

// ─── Syntax Highlighting ──────────────────────────────────────────────────────
function tokenize(code, lang) {
  const JS_KEYWORDS = /\b(const|let|var|function|return|if|else|for|while|class|import|export|default|new|this|typeof|instanceof|async|await|try|catch|throw|switch|case|break|continue|null|undefined|true|false)\b/g;
  const PY_KEYWORDS = /\b(def|class|import|from|return|if|elif|else|for|while|in|not|and|or|True|False|None|pass|break|continue|try|except|finally|with|as|lambda|yield|global|nonlocal|raise|del|print|len|range)\b/g;
  const CSS_KEYWORDS = /\b(body|html|div|span|p|h[1-6]|a|ul|li|input|button|color|background|margin|padding|display|flex|grid|font|border|width|height|position|top|left|right|bottom)\b/g;
  
  const lines = code.split("\n");
  return lines.map((line) => {
    if (!line.trim()) return [{ type: "plain", val: "" }];
    let rest = line;
    if (lang === "javascript" || lang === "css") {
      if (rest.trimStart().startsWith("//")) return [{ type: "comment", val: rest }];
    }
    if (lang === "python" && rest.trimStart().startsWith("#")) return [{ type: "comment", val: rest }];
    if (lang === "html" && rest.trimStart().startsWith("<!--")) return [{ type: "comment", val: rest }];

    let result = [];
    let buf = "";
    let j = 0;
    const flushBuf = () => { if (buf) { result.push({ type: "plain", val: buf }); buf = ""; } };

    while (j < rest.length) {
      if ((rest[j] === '"' || rest[j] === "'" || rest[j] === "`") && lang !== "html") {
        const q = rest[j];
        let str = q; j++;
        while (j < rest.length && rest[j] !== q) { str += rest[j]; j++; }
        str += q; j++;
        flushBuf();
        result.push({ type: "string", val: str });
        continue;
      }
      if (/[0-9]/.test(rest[j]) && (j === 0 || /[\s,;:(]/.test(rest[j - 1]))) {
        let num = "";
        while (j < rest.length && /[0-9.]/.test(rest[j])) { num += rest[j]; j++; }
        flushBuf();
        result.push({ type: "number", val: num });
        continue;
      }
      buf += rest[j]; j++;
    }
    flushBuf();

    result = result.flatMap(tok => {
      if (tok.type !== "plain") return [tok];
      const text = tok.val;
      let kw;
      if (lang === "javascript") kw = JS_KEYWORDS;
      else if (lang === "python") kw = PY_KEYWORDS;
      else if (lang === "css") kw = CSS_KEYWORDS;
      else return [tok];
      kw.lastIndex = 0;
      const parts2 = [];
      let last = 0, m;
      while ((m = kw.exec(text)) !== null) {
        if (m.index > last) parts2.push({ type: "plain", val: text.slice(last, m.index) });
        parts2.push({ type: "keyword", val: m[0] });
        last = m.index + m[0].length;
      }
      if (last < text.length) parts2.push({ type: "plain", val: text.slice(last) });
      return parts2.length ? parts2 : [tok];
    });

    if (lang === "html") {
      result = result.flatMap(tok => {
        if (tok.type !== "plain") return [tok];
        const text = tok.val;
        const tagRe = /(<\/?)([a-zA-Z][a-zA-Z0-9]*)/g;
        const parts3 = [];
        let last = 0, m2;
        tagRe.lastIndex = 0;
        while ((m2 = tagRe.exec(text)) !== null) {
          if (m2.index > last) parts3.push({ type: "plain", val: text.slice(last, m2.index) });
          parts3.push({ type: "plain", val: m2[1] });
          parts3.push({ type: "keyword", val: m2[2] });
          last = m2.index + m2[0].length;
        }
        if (last < text.length) parts3.push({ type: "plain", val: text.slice(last) });
        return parts3.length ? parts3 : [tok];
      });
    }
    return result;
  });
}

function TokenColor({ token, theme }) {
  const t = THEMES[theme];
  const colors = { keyword: "#569cd6", string: "#ce9178", number: "#b5cea8", comment: "#6a9955", plain: t.text };
  return <span style={{ color: colors[token.type] || t.text }}>{token.val}</span>;
}

// ─── Default Files ─────────────────────────────────────────────────────────────
const DEFAULT_FILES = {
  "src": {
    type: "folder", expanded: true,
    children: {
      "App.jsx": { type: "file", lang: "javascript", content: "import React from 'react';\nexport default function App() {\n  return <div>Hello</div>;\n}" },
      "App.css": { type: "file", lang: "css", content: ".App { color: red; }" },
    }
  },
  "README.md": { type: "file", lang: "javascript", content: "# VS Code Clone\nBuilt with React." }
};

const TERMINAL_HISTORY = [
  { type: "prompt", text: "~/project main" },
  { type: "cmd", text: "npm install" },
  { type: "output", text: "added 347 packages, and audited 348 packages in 4s" },
];

function getFileIcon(filename, type, theme) {
  if (type === "folder") return <Folder size={16} />;
  const ext = filename.split(".").pop();
  const props = { size: 16 };
  if (ext === "js" || ext === "jsx" || ext === "ts" || ext === "tsx") return <FileCode {...props} color="#f1e05a" />;
  if (ext === "css") return <FileCode {...props} color="#563d7c" />;
  if (ext === "html") return <FileCode {...props} color="#e34c26" />;
  if (ext === "json") return <FileJson {...props} color="#cbcb41" />;
  return <FileText {...props} />;
}

// ─── Components ───────────────────────────────────────────────────────────────
function ActivityBar({ active, setActive, theme, onThemeToggle }) {
  const t = THEMES[theme];
  const items = [
    { id: "explorer", icon: <Files size={24} />, title: "Explorer" },
    { id: "search", icon: <Search size={24} />, title: "Search" },
    { id: "git", icon: <GitBranch size={24} />, title: "Source Control", badge: 3 },
    { id: "extensions", icon: <Blocks size={24} />, title: "Extensions" },
  ];
  return (
    <div style={{ width: 48, background: t.activityBar, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 8, borderRight: "1px solid #111", flexShrink: 0, zIndex: 10 }}>
      {items.map(item => (
        <div key={item.id} title={item.title} onClick={() => setActive(active === item.id ? null : item.id)}
             style={{ width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative", background: active === item.id ? "rgba(255,255,255,0.1)" : "transparent", borderLeft: active === item.id ? `2px solid ${t.accent}` : "2px solid transparent", transition: "all 0.15s", color: active === item.id ? "#fff" : "#858585" }}
             onMouseEnter={e => { if (active !== item.id) e.currentTarget.style.color = "#ccc"; }}
             onMouseLeave={e => { if (active !== item.id) e.currentTarget.style.color = "#858585"; }}
        >
          {item.icon}
          {item.badge && <span style={{ position: "absolute", top: 8, right: 8, background: t.badge, color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 10, minWidth: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{item.badge}</span>}
        </div>
      ))}
      <div style={{ flexGrow: 1 }} />
      <div title="Toggle Theme" onClick={onThemeToggle} style={{ width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#858585" }}
           onMouseEnter={e => e.currentTarget.style.color = "#ccc"}
           onMouseLeave={e => e.currentTarget.style.color = "#858585"}
      >
        {theme === "dark" ? <Sun size={24} /> : <Moon size={24} />}
      </div>
      <div title="Settings" style={{ width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#858585", marginBottom: 8 }}
           onMouseEnter={e => e.currentTarget.style.color = "#ccc"}
           onMouseLeave={e => e.currentTarget.style.color = "#858585"}
      >
        <Settings size={24} />
      </div>
    </div>
  );
}

function FileNode({ name, node, depth, path, onOpen, onToggle, activeFile, theme }) {
  const t = THEMES[theme];
  const isActive = activeFile === path;
  const isFolder = node.type === "folder";
  const icon = isFolder ? (node.expanded ? <FolderOpen size={16} color={t.accent} /> : <Folder size={16} color={t.accent} />) : getFileIcon(name, "file", theme);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", padding: "2px 8px", cursor: "pointer", background: isActive ? t.selection : "transparent", color: isActive ? "#fff" : t.text, fontSize: 13, paddingLeft: depth * 12 + 8 }}
           onClick={() => isFolder ? onToggle(path) : onOpen(path, node)}
           onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = t.hover; }}
           onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
      >
        <span style={{ marginRight: 4, display: "flex", alignItems: "center" }}>
          {isFolder ? (node.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <div style={{ width: 14 }} />}
        </span>
        <span style={{ marginRight: 6, display: "flex", alignItems: "center" }}>{icon}</span>
        <span style={{ flexGrow: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      </div>
      {isFolder && node.expanded && node.children && Object.entries(node.children).map(([n, child]) => (
        <FileNode key={n} name={n} node={child} depth={depth + 1} path={`${path}/${n}`} onOpen={onOpen} onToggle={onToggle} activeFile={activeFile} theme={theme} />
      ))}
    </div>
  );
}

function Explorer({ files, onOpenFile, onToggleFolder, activeFile, theme }) {
  const t = THEMES[theme];
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Explorer</div>
      <div style={{ overflowY: "auto", flexGrow: 1 }}>
        <div style={{ padding: "4px 12px", fontSize: 11, fontWeight: 600, color: t.textMuted }}>VSCODE-REPLICA</div>
        {Object.entries(files).map(([name, node]) => (
          <FileNode key={name} name={name} node={node} depth={0} path={name} onOpen={onOpenFile} onToggle={onToggleFolder} activeFile={activeFile} theme={theme} />
        ))}
      </div>
    </div>
  );
}

function EditorTabs({ tabs, activeTab, setActiveTab, onClose, theme }) {
  const t = THEMES[theme];
  return (
    <div style={{ display: "flex", background: t.tabBar, borderBottom: `1px solid ${t.border}`, height: 35, overflowX: "auto", overflowY: "hidden" }}>
      {tabs.map(tab => {
        const isActive = tab.path === activeTab;
        return (
          <div key={tab.path} onClick={() => setActiveTab(tab.path)}
               style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 12px", minWidth: 120, cursor: "pointer", background: isActive ? t.tabActive : t.tab, color: isActive ? t.textActive : t.textMuted, borderRight: `1px solid ${t.border}`, borderTop: isActive ? `1px solid ${t.accent}` : "1px solid transparent", fontSize: 13, position: "relative" }}>
            <span style={{ display: "flex", alignItems: "center" }}>{getFileIcon(tab.name, "file", theme)}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexGrow: 1 }}>{tab.name}</span>
            <span onClick={e => { e.stopPropagation(); onClose(tab.path); }} style={{ display: "flex", alignItems: "center", borderRadius: 4, padding: 2 }} onMouseEnter={e => e.currentTarget.style.background = t.hover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><X size={14} /></span>
          </div>
        );
      })}
    </div>
  );
}

function CodeEditor({ file, theme }) {
  const t = THEMES[theme];
  const [content, setContent] = useState(file.content);
  const [cursorLine, setCursorLine] = useState(1);
  useEffect(() => { setContent(file.content); }, [file.path]);
  const tokenized = tokenize(content, file.lang);
  const lines = content.split("\n");
  return (
    <div style={{ display: "flex", flexGrow: 1, overflow: "hidden", position: "relative", background: t.bg }}>
      <div style={{ width: 50, background: t.bg, borderRight: `1px solid ${t.border}`, paddingTop: 12, userSelect: "none" }}>
        {lines.map((_, i) => (<div key={i} style={{ height: 20, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 10, fontSize: 12, fontFamily: "monospace", color: cursorLine === i + 1 ? t.text : t.lineNum }}>{i + 1}</div>))}
      </div>
      <div style={{ flexGrow: 1, position: "relative", overflow: "auto", padding: "12px 0" }}>
        <div style={{ pointerEvents: "none", position: "absolute", top: 12, left: 12, whiteSpace: "pre", fontFamily: "monospace", fontSize: 13, lineHeight: "20px" }}>
          {tokenized.map((line, i) => (
            <div key={i} style={{ height: 20, background: cursorLine === i + 1 ? "rgba(255,255,255,0.05)" : "transparent" }}>{line.map((tok, j) => <TokenColor key={j} token={tok} theme={theme} />)}</div>
          ))}
        </div>
        <textarea value={content} onChange={e => setContent(e.target.value)} onSelect={e => { const pos = e.target.selectionStart; setCursorLine(content.slice(0, pos).split("\n").length); }} style={{ width: "100%", height: "100%", background: "transparent", color: "transparent", caretColor: t.text, border: "none", outline: "none", resize: "none", fontFamily: "monospace", fontSize: 13, lineHeight: "20px", whiteSpace: "pre", paddingLeft: 12 }} spellCheck={false} />
      </div>
    </div>
  );
}

function Terminal({ theme, visible, onToggle }) {
  const t = THEMES[theme];
  const [input, setInput] = useState("");
  if (!visible) return null;
  return (
    <div style={{ height: 200, background: t.terminal, borderTop: `1px solid ${t.border}`, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "4px 12px", background: t.tabBar, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: "flex", gap: 16 }}>
          <span style={{ fontSize: 11, color: t.textActive, borderBottom: `1px solid ${t.accent}`, padding: "4px 0", cursor: "pointer" }}>TERMINAL</span>
          <span style={{ fontSize: 11, color: t.textMuted, padding: "4px 0", cursor: "pointer" }}>OUTPUT</span>
          <span style={{ fontSize: 11, color: t.textMuted, padding: "4px 0", cursor: "pointer" }}>DEBUG CONSOLE</span>
        </div>
        <span onClick={onToggle} style={{ cursor: "pointer", color: t.textMuted }}><X size={16} /></span>
      </div>
      <div style={{ padding: 12, color: t.terminalText, fontFamily: "monospace", fontSize: 12, overflowY: "auto" }}>
        <div style={{ color: "#98c379", marginBottom: 8 }}>Welcome to the VS Code Replica Terminal!</div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ color: "#98c379" }}>~/project</span>
          <span style={{ color: t.accent }}>$</span>
          <input value={input} onChange={e => setInput(e.target.value)} style={{ flexGrow: 1, background: "transparent", border: "none", outline: "none", color: t.terminalText, fontFamily: "monospace", fontSize: 12 }} autoFocus />
        </div>
      </div>
    </div>
  );
}

function WelcomeTab({ theme }) {
  const t = THEMES[theme];
  return (
    <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: t.bg, color: t.text, textAlign: "center" }}>
      <div style={{ marginBottom: 30, filter: theme === "dark" ? "drop-shadow(0 0 20px rgba(0,122,204,0.3))" : "none" }}>
        <svg width="120" height="120" viewBox="0 0 100 100">
          <path d="M75,20 L25,45 L15,40 L10,42 L25,50 L10,58 L15,60 L25,55 L75,80 L85,75 L85,25 L75,20 Z" fill="#007acc" />
          <path d="M75,20 L25,45 L25,55 L75,80 L75,20 Z" fill="#1f9cf0" />
          <path d="M25,45 L15,40 L10,42 L25,50 L25,45 Z" fill="#005a9e" />
          <path d="M25,55 L15,60 L10,58 L25,50 L25,55 Z" fill="#005a9e" />
        </svg>
      </div>
      <h1 style={{ fontSize: 42, fontWeight: 200, marginBottom: 10, letterSpacing: "-0.5px" }}>Visual Studio Code</h1>
      <p style={{ fontSize: 18, color: t.textMuted, marginBottom: 48, fontWeight: 300 }}>Editing evolved</p>
      
      <div style={{ display: "flex", gap: 60, textAlign: "left" }}>
        <div style={{ width: 160 }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 20, color: t.text }}>Start</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
            <div style={{ color: t.accent, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: t.accent }}></span>
              New File...
            </div>
            <div style={{ color: t.accent, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: t.accent }}></span>
              Open File...
            </div>
            <div style={{ color: t.accent, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: t.accent }}></span>
              Open Folder...
            </div>
            <div style={{ color: t.accent, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: t.accent }}></span>
              Clone Git Repository...
            </div>
          </div>
        </div>
        
        <div style={{ width: 200 }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 20, color: t.text }}>Recent</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13, color: t.textMuted }}>
            <p style={{ margin: 0 }}>You have no recent folders.</p>
            <p style={{ margin: 0, fontSize: 12 }}>Open a folder to start working.</p>
          </div>
        </div>
      </div>
      
      <div style={{ marginTop: 60, fontSize: 12, color: t.textMuted }}>
        <div style={{ display: "flex", gap: 20, justifyContent: "center" }}>
          <span>Show welcome page on startup</span>
        </div>
      </div>
    </div>
  );
}

function MenuBar({ theme, title, onAction }) {
  const t = THEMES[theme];
  const [openMenu, setOpenMenu] = useState(null);
  const menuRef = useRef(null);

  const menus = [
    { name: "File", items: [{ label: "New File", action: "new-file" }, { label: "Close Active Tab", action: "close-active-tab" }] },
    { name: "Edit", items: [{ label: "Toggle Theme", action: "toggle-theme" }] },
    { name: "Selection", items: [{ label: "Select All", action: "noop" }] },
    { name: "View", items: [{ label: "Toggle Explorer", action: "toggle-explorer" }, { label: "Toggle Terminal", action: "toggle-terminal" }] },
    { name: "Go", items: [{ label: "Go to Welcome", action: "go-welcome" }] },
    { name: "Run", items: [{ label: "Run Task", action: "noop" }] },
    { name: "Terminal", items: [{ label: "Toggle Terminal", action: "toggle-terminal" }] },
    { name: "Help", items: [{ label: "About", action: "noop" }] },
  ];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={menuRef} style={{ height: 30, background: theme === "dark" ? "#323233" : "#ddd", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", borderBottom: `1px solid ${t.border}`, fontSize: 12, position: "relative", zIndex: 20 }}>
      <div style={{ display: "flex", gap: 2, height: "100%", alignItems: "center" }}>
        {menus.map((menu) => (
          <div key={menu.name} style={{ position: "relative", height: "100%", display: "flex", alignItems: "center" }}>
            <span
              onClick={() => setOpenMenu(openMenu === menu.name ? null : menu.name)}
              style={{ cursor: "pointer", padding: "0 8px", height: "100%", display: "flex", alignItems: "center", background: openMenu === menu.name ? t.hover : "transparent" }}
            >
              {menu.name}
            </span>
            {openMenu === menu.name && (
              <div style={{ position: "absolute", top: 30, left: 0, minWidth: 180, background: t.tabBar, border: `1px solid ${t.border}`, boxShadow: "0 6px 18px rgba(0,0,0,0.3)", padding: "6px 0" }}>
                {menu.items.map((item) => (
                  <div
                    key={item.label}
                    onClick={() => {
                      onAction(item.action);
                      setOpenMenu(null);
                    }}
                    style={{ padding: "6px 12px", cursor: "pointer", whiteSpace: "nowrap" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = t.hover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ color: t.textMuted }}>{title}</div>
    </div>
  );
}

export default function VSCodeClone() {
  const [theme, setTheme] = useState("dark");
  const t = THEMES[theme];
  const [files, setFiles] = useState(DEFAULT_FILES);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [activePanel, setActivePanel] = useState("explorer");
  const [terminalVisible, setTerminalVisible] = useState(true);

  const handleOpenFile = (path, node) => {
    if (!openFiles.find(f => f.path === path)) {
      setOpenFiles([...openFiles, { name: path.split("/").pop(), path, content: node.content || "", lang: getLang(path.split("/").pop()) }]);
    }
    setActiveTab(path);
  };

  const handleCloseTab = (path) => {
    const newTabs = openFiles.filter(f => f.path !== path);
    setOpenFiles(newTabs);
    if (activeTab === path) setActiveTab(newTabs[newTabs.length - 1]?.path || null);
  };

  const handleToggleFolder = (path) => {
    const newFiles = { ...files };
    const parts = path.split("/");
    let node = newFiles;
    for (let i = 0; i < parts.length; i++) {
        if (i === parts.length - 1) node[parts[i]].expanded = !node[parts[i]].expanded;
        else node = node[parts[i]].children;
    }
    setFiles(newFiles);
  };

  function getLang(filename) {
    const ext = filename.split(".").pop();
    if (ext === "jsx" || ext === "js") return "javascript";
    return ext;
  }

  const activeFile = openFiles.find(f => f.path === activeTab);

  const handleMenuAction = (action) => {
    if (action === "toggle-theme") {
      setTheme(theme === "dark" ? "light" : "dark");
      return;
    }
    if (action === "toggle-terminal") {
      setTerminalVisible(!terminalVisible);
      return;
    }
    if (action === "toggle-explorer") {
      setActivePanel(activePanel ? null : "explorer");
      return;
    }
    if (action === "go-welcome") {
      setActiveTab(null);
      return;
    }
    if (action === "close-active-tab" && activeTab) {
      handleCloseTab(activeTab);
      return;
    }
    if (action === "new-file") {
      handleOpenFile("src/App.jsx", { content: DEFAULT_FILES.src.children["App.jsx"].content });
    }
  };

  return (
    <div className="vscode-container" style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column", background: t.bg, color: t.text, fontFamily: "system-ui", overflow: "hidden", "--scrollbar": t.scrollbar }}>
      <MenuBar
        theme={theme}
        title={`VS Code Replica - ${activeFile ? activeFile.name : "Welcome"}`}
        onAction={handleMenuAction}
      />
      <div style={{ display: "flex", flexGrow: 1, overflow: "hidden" }}>
        <ActivityBar active={activePanel} setActive={setActivePanel} theme={theme} onThemeToggle={() => setTheme(theme === "dark" ? "light" : "dark")} />
        {activePanel && (
          <div style={{ width: 220, background: t.sidebar, borderRight: `1px solid ${t.border}`, flexShrink: 0 }}>
            {activePanel === "explorer" && <Explorer files={files} onOpenFile={handleOpenFile} onToggleFolder={handleToggleFolder} activeFile={activeTab} theme={theme} />}
            {activePanel === "search" && <div style={{ padding: 12 }}><div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginBottom: 8 }}>Search</div><input placeholder="Search" style={{ width: "100%", background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 4, padding: "4px 8px", color: t.text, fontSize: 13 }} /></div>}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, overflow: "hidden" }}>
          {openFiles.length > 0 ? (
            <>
              <EditorTabs tabs={openFiles} activeTab={activeTab} setActiveTab={setActiveTab} onClose={handleCloseTab} theme={theme} />
              <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {activeFile ? <CodeEditor file={activeFile} theme={theme} /> : <WelcomeTab theme={theme} />}
              </div>
            </>
          ) : <WelcomeTab theme={theme} />}
          <Terminal theme={theme} visible={terminalVisible} onToggle={() => setTerminalVisible(!terminalVisible)} />
        </div>
      </div>
      <div style={{ height: 22, background: t.statusBar, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", fontSize: 11, color: t.statusText }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}><GitBranch size={12} /> main</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}><CheckCircle size={12} /> 0 <AlertCircle size={12} /> 0</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {activeFile && <span>{activeFile.lang.toUpperCase()}</span>}
          <span>UTF-8</span>
          <TerminalIcon size={12} />
        </div>
      </div>
    </div>
  );
}
