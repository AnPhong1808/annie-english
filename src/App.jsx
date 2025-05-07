import { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import InputTab from './components/InputTab';
import DialogueTab from './components/DialogueTab';
import './App.css';

function App() {
  const [telegramReady, setTelegramReady] = useState(false);
  const [textInput, setTextInput] = useState(''); // Thêm state để quản lý textInput
  const [dialogueCache, setDialogueCache] = useState({ textInput: null, dialogueData: null }); // Cache for DialogueTab
  const location = useLocation();

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      setTelegramReady(true);
      console.log('Telegram Web App initialized');
    } else {
      console.warn('Telegram Web App SDK not loaded');
    }
  }, []);

  return (
    <div className="app-container">
      {telegramReady ? (
        <>
          <nav className="nav-bar custom-nav">
            <Link
              to="/"
              className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
            >
              Nhập văn bản
            </Link>
            <Link
              to="/dialogue"
              className={`nav-link ${location.pathname === '/dialogue' ? 'active' : ''}`}
            >
              Hội thoại
            </Link>
          </nav>
          <Routes>
            <Route path="/" element={<InputTab />} />
            <Route path="/dialogue" element={<DialogueTab textInput={textInput} dialogueCache={dialogueCache} setDialogueCache={setDialogueCache} />}/>
          </Routes>
        </>
      ) : (
        <div className="error-message">Đang tải Telegram Web App...</div>
      )}
    </div>
  );
}

export default App;