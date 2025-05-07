import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './DialogueTab.css';

function DialogueTab({ textInput }) {
  const [dialogueData, setDialogueData] = useState([]);
  const [displayStates, setDisplayStates] = useState([]);
  const [error, setError] = useState('');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [repeat, setRepeat] = useState(false);
  const cache = useRef({ textInput: null, dialogueData: null });

  useEffect(() => {
    const fetchDialogue = async () => {
      if (!textInput) {
        setError('Vui lòng nhập đoạn văn ở tab Nhập văn bản');
        setDialogueData([]);
        setDisplayStates([]);
        cache.current = { textInput: null, dialogueData: null }; // Xóa cache
        sessionStorage.removeItem(`dialogue_${textInput}`); // Xóa sessionStorage
        return;
      }
      
      // Kiểm tra sessionStorage trước
      const storageKey = `dialogue_${textInput}`;
      const cachedData = sessionStorage.getItem(storageKey);
      if (cachedData) {
        const { dialogueData: cachedDialogueData } = JSON.parse(cachedData);
        setDialogueData(cachedDialogueData);
        setDisplayStates(new Array(cachedDialogueData.length).fill(0));
        cache.current = { textInput, dialogueData: cachedDialogueData }; // Cập nhật cache
        setError('');
        return;
      }
      
      // Kiểm tra cache
      if (cache.current.textInput === textInput && cache.current.dialogueData) {
        setDialogueData(cache.current.dialogueData);
        setDisplayStates(new Array(cache.current.dialogueData.length).fill(0));
        setError('');
        return;
      }

      try {
        // 1. Gọi API Gemini
        const geminiResponse = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.REACT_APP_GEMINI_API_KEY}`,
          {
            contents: [{
              parts: [{
                text: `Dựa trên đoạn văn sau, tạo một đoạn hội thoại tiếng Anh gồm đúng 20 câu về chủ đề chính của đoạn văn. Mỗi câu hội thoại phải đi kèm phần dịch tiếng Việt và phân tích chi tiết cấu trúc ngữ pháp, cách sử dụng từ, cụm từ. Định dạng phản hồi phải tuân thủ nghiêm ngặt quy tắc sau:

- Mỗi câu là một khối riêng, gồm 3 phần: câu tiếng Anh, dịch tiếng Việt, phân tích ngữ pháp.
- Các phần trong một khối được phân cách bằng dấu "---" (ba dấu gạch ngang, không có khoảng trắng thừa).
- Các khối cách nhau bằng đúng một dòng trống.
- Không bao gồm bất kỳ nội dung nào khác (giới thiệu, mô tả, tên người nói, tiêu đề, hoặc ký tự thừa).
- Mỗi phần (câu, dịch, phân tích) phải có nội dung hợp lệ, không được để trống.

Ví dụ một khối:

I love learning English.
---
Tôi yêu thích học tiếng Anh.
---
"I love" là cấu trúc chủ ngữ + động từ, thể hiện cảm xúc. "Learning English" là danh động từ làm tân ngữ.

Đoạn văn: "${textInput}"`
              }]
            }]
          },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        // 2. Kiểm tra và log phản hồi
        if (!geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          throw new Error('Phản hồi từ API Gemini không hợp lệ');
        }

        const dialogueText = geminiResponse.data.candidates[0].content.parts[0].text;
        console.log('Gemini response:', dialogueText); // Log phản hồi thô để debug

        // 3. Tách các khối câu
        const dialogueBlocks = dialogueText.split('\n\n').filter(block => block.trim());
        const parsedData = dialogueBlocks.map((block, index) => {
          const parts = block.split('---').map(part => part.trim());
          if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
            console.warn(`Invalid block ${index}:`, block); // Log khối lỗi
            return null; // Đánh dấu khối không hợp lệ
          }
          return { english: parts[0], vietnamese: parts[1], grammar: parts[2] };
        });

        // 4. Lọc dữ liệu hợp lệ và kiểm tra số lượng
        const validData = parsedData.filter(item => item !== null);
        if (validData.length < parsedData.length) {
          console.warn(`Found ${parsedData.length - validData.length} invalid blocks`);
        }
        if (validData.length === 0) {
          throw new Error('Không có khối hội thoại hợp lệ');
        }
        if (validData.length !== 20) {
          console.warn(`Expected 20 sentences, got ${validData.length}`);
        }

        setDialogueData(validData);
        setDisplayStates(new Array(validData.length).fill(0));
        cache.current = { textInput, dialogueData: validData }; // Lưu vào cache
        sessionStorage.setItem(`dialogue_${textInput}`, JSON.stringify({ dialogueData: validData })); // Lưu vào sessionStorage
        setError('');
      } catch (err) {
        console.error('Error generating dialogue:', err);
        setError(`Lỗi khi tạo hội thoại: ${err.message}`);
      }
    };
    fetchDialogue();
  }, [textInput]);

  const toggleDisplay = (index) => {
    setDisplayStates(prev => {
      const newStates = [...prev];
      newStates[index] = (newStates[index] + 1) % 3;
      return newStates;
    });
  };

  const playAudio = () => {
    if (dialogueData.length === 0) {
      setError('Không có hội thoại để phát');
      return;
    }

    // Dừng tất cả âm thanh trước khi phát
    if (window.responsiveVoice) {
      window.responsiveVoice.cancel();
    }

    const playNext = (index) => {
      if (index >= dialogueData.length) {
        if (repeat) {
          playNext(0); // Lặp lại từ đầu
        }
        return;
      }

      const item = dialogueData[index];
      const voice = index % 2 === 0 ? 'UK English Female' : 'US English Male'; // Luân phiên giọng

      window.responsiveVoice.speak(
        item.english,
        voice,
        {
          rate: playbackSpeed,
          volume: 1,
          onend: () => {
            if (repeat) {
              setTimeout(() => playNext(index + 1), 10000);
            } else {
              playNext(index + 1);
            }
          }
        }
      );
    };

    playNext(0); // Bắt đầu từ câu đầu tiên
  };

  const stopAudio = () => {
    if (window.responsiveVoice) {
      window.responsiveVoice.cancel();
    }
  };

  return (
    <div className="dialogue-container">
      {error && (
        <div className="error-message">{error}</div>
      )}
      <div className="audio-controls">
        <div className="button-group">
          <button
            className="play-dialogue-button"
            onClick={playAudio}
          >
            Phát hội thoại
          </button>
          <button
            className="stop-dialogue-button"
            onClick={stopAudio}
          >
            Dừng lại
          </button>
        </div>
        <label className="block mb-1 mt-2">Tốc độ phát:</label>
        <select
          className="select"
          value={playbackSpeed}
          onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
        >
          <option value="0.5">0.5x</option>
          <option value="1">1x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2x</option>
        </select>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={repeat}
            onChange={(e) => setRepeat(e.target.checked)}
          />
          Lặp lại
        </label>
      </div>
      <div className="dialogue-list">
        {dialogueData.map((item, index) => (
          <div
            key={index}
            className={`dialogue-item ${index % 2 === 0 ? 'dark-blue' : 'white'}`}
            onClick={() => toggleDisplay(index)}
          >
            <div className="dialogue-english">{item.english}</div>
            {displayStates[index] >= 1 && (
              <>
                <hr className="divider" />
                <div className="dialogue-vietnamese">{item.vietnamese}</div>
              </>
            )}
            {displayStates[index] === 2 && (
              <>
                <hr className="divider" />
                <div className="dialogue-grammar">{item.grammar}</div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default DialogueTab;