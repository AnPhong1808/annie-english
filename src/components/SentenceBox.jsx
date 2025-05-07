import { useState } from 'react';

function SentenceBox({ sentence, translation, grammar, audioUrl, playbackSpeed, repeat }) {
  const [isOpen, setIsOpen] = useState(false);

  const playAudio = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.playbackRate = playbackSpeed;
      audio.loop = repeat;
      audio.play().catch(err => alert('Lỗi khi phát âm thanh'));
    }
  };

  return (
    <div className="sentence-box">
      <div
        className="sentence-content"
        onClick={() => setIsOpen(!isOpen)}
      >
        {sentence}
      </div>
      {isOpen && (
        <div className="sentence-details">
          <p><strong>Dịch:</strong> {translation || 'Đang tải...'}</p>
          {audioUrl && (
            <button
              className="play-button"
              onClick={playAudio}
            >
              Phát câu
            </button>
          )}
          <button
            className="grammar-button"
            onClick={() => alert(grammar || 'Đang tải phân tích...')}
          >
            Xem phân tích ngữ pháp
          </button>
        </div>
      )}
    </div>
  );
}

export default SentenceBox;