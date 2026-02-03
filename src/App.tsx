import { useEffect, useState } from "react";
import { useAppStore } from "./store/appStore";
import { ReadingEngine } from "./lib/engine";
import { TextToSpeechManager } from "./lib/tts";
import { parseText, parsePDF, parseEPUB, tokenizeContent } from "./lib/parser";
import FocusReader from "./components/FocusReader";
import PlaybackControls from "./components/PlaybackControls";
import ImageBlockViewer from "./components/ImageBlockViewer";
import SettingsPanel from "./components/SettingsPanel";
import { ContentBlock, TextToken } from "./types";
import "./App.css";

function App() {
  const {
    playbackSettings,
    updatePlaybackSettings,
    addBook,
    setCurrentBook,
    darkMode,
  } = useAppStore();

  const [tokens, setTokens] = useState<TextToken[]>([]);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [engine, setEngine] = useState<ReadingEngine | null>(null);
  const [ttsManager] = useState(() => new TextToSpeechManager());
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTokenIndex, setCurrentTokenIndex] = useState(0);
  const [currentToken, setCurrentToken] = useState<TextToken | null>(null);
  const [currentBlock, setCurrentBlock] = useState<ContentBlock | null>(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Initialize engine when tokens/blocks change
  useEffect(() => {
    if (tokens.length === 0) return;

    const newEngine = new ReadingEngine(tokens, blocks, {
      onTokenChange: (token: TextToken | null, blockIndex: number) => {
        setCurrentToken(token);
        setCurrentBlock(blocks[blockIndex] || null);
        if (token) {
          setCurrentTokenIndex(token.originalIndex);
        }

        // TTS integration
        if (playbackSettings.enableTTS && ttsManager && token) {
          ttsManager.speak(token);
        }
      },
      onPlayStateChange: (state) => {
        setIsPlaying(state.isPlaying);
        setCurrentTokenIndex(state.currentTokenIndex);
      },
      onBlockChange: (block: ContentBlock | null, _blockIndex: number) => {
        if (block?.type === "image") {
          setShowImageViewer(true);
          newEngine.pause();
          setIsPlaying(false);
        }
      },
      onComplete: () => {
        setIsPlaying(false);
      },
    });

    newEngine.setWordsPerMinute(playbackSettings.wordsPerMinute);
    setEngine(newEngine);
  }, [tokens, blocks]);

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      let extractedBlocks: ContentBlock[] = [];

      if (extension === "epub") {
        extractedBlocks = await parseEPUB(file);
      } else if (extension === "pdf") {
        extractedBlocks = await parsePDF(file);
      } else if (extension === "txt") {
        extractedBlocks = await parseText(file);
      } else {
        alert("Unsupported file format. Please use .epub, .pdf, or .txt");
        return;
      }

      const newTokens = tokenizeContent(extractedBlocks);
      setTokens(newTokens);
      setBlocks(extractedBlocks);
      setCurrentToken(newTokens[0] || null);
      setCurrentBlock(extractedBlocks[0] || null);
      setCurrentTokenIndex(0);
      setIsPlaying(false);

      // Add book to store
      const newBook = {
        id: Math.random().toString(36).substr(2, 9),
        title: file.name.replace(/\.[^/.]+$/, ""),
        author: "Unknown",
        format: (extension === "epub" ? "epub" : extension === "pdf" ? "pdf" : "text") as "epub" | "pdf" | "text",
        filePath: file.name,
        totalWords: newTokens.length,
        userId: "local",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      addBook(newBook);
      setCurrentBook(newBook);
    } catch (error) {
      alert(`Error parsing file: ${(error as Error).message}`);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!engine) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (isPlaying) {
          engine.pause();
        } else if (currentTokenIndex === 0) {
          engine.play();
        } else {
          engine.resume();
        }
      } else if (e.code === "ArrowRight") {
        engine.seek(Math.min(currentTokenIndex + 5, tokens.length - 1));
      } else if (e.code === "ArrowLeft") {
        engine.seek(Math.max(currentTokenIndex - 5, 0));
      } else if (e.code === "Equal" || e.code === "Plus") {
        const newWpm = Math.min(playbackSettings.wordsPerMinute + 10, 1000);
        updatePlaybackSettings({ wordsPerMinute: newWpm });
        engine.setWordsPerMinute(newWpm);
      } else if (e.code === "Minus") {
        const newWpm = Math.max(playbackSettings.wordsPerMinute - 10, 50);
        updatePlaybackSettings({ wordsPerMinute: newWpm });
        engine.setWordsPerMinute(newWpm);
      } else if (e.ctrlKey && e.code === "KeyS") {
        e.preventDefault();
        setShowSettings(!showSettings);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [engine, isPlaying, currentTokenIndex, tokens.length, playbackSettings.wordsPerMinute, showSettings]);

  return (
    <div className={`app ${darkMode ? "dark" : "light"}`}>
      <header className="app-header">
        <h1>Readable</h1>
        <div className="header-controls">
          <button
            className="icon-button"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings (Ctrl+S)"
          >
            ⚙️
          </button>
        </div>
      </header>

      {tokens.length === 0 ? (
        <div className="upload-container">
          <div className="upload-box">
            <h2>📚 Upload Your Book</h2>
            <p>Supports EPUB, PDF, and TXT formats</p>
            <input
              type="file"
              accept=".epub,.pdf,.txt"
              onChange={handleFileUpload}
              id="file-input"
            />
            <label htmlFor="file-input" className="upload-label">
              Choose File
            </label>
          </div>
        </div>
      ) : (
        <>
          <FocusReader
            currentToken={currentToken}
            currentBlock={currentBlock}
            playbackState={{ isPlaying, currentTokenIndex, wordsPerMinute: playbackSettings.wordsPerMinute, isPaused: !isPlaying, currentBlock }}
            onImageBlockReached={(block) => {
              setCurrentBlock(block);
              setShowImageViewer(true);
            }}
          />

          <PlaybackControls
            state={{ isPlaying, currentTokenIndex, wordsPerMinute: playbackSettings.wordsPerMinute, isPaused: !isPlaying, currentBlock }}
            onPlay={() => engine?.play()}
            onPause={() => engine?.pause()}
            onResume={() => engine?.resume()}
            onStop={() => engine?.stop()}
            onWPMChange={(wpm) => {
              updatePlaybackSettings({ wordsPerMinute: wpm });
              engine?.setWordsPerMinute(wpm);
            }}
            onSeek={(index) => engine?.seek(index)}
            totalTokens={tokens.length}
            enableTTS={playbackSettings.enableTTS}
            onTTSToggle={(enabled) => {
              updatePlaybackSettings({ enableTTS: enabled });
            }}
          />

          <ImageBlockViewer
            block={currentBlock}
            isVisible={showImageViewer && currentBlock?.type === "image"}
            onResume={() => {
              setShowImageViewer(false);
              engine?.resume();
            }}
            duration={5000}
          />
        </>
      )}

      {showSettings && (
        <SettingsPanel
          settings={playbackSettings}
          onSettingsChange={(updates) => {
            updatePlaybackSettings(updates);
            if (updates.wordsPerMinute && engine) {
              engine.setWordsPerMinute(updates.wordsPerMinute);
            }
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
