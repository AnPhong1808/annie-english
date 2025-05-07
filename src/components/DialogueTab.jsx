import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './DialogueTab.css';

function DialogueTab({ textInput }) {
  const [dialogueData, setDialogueData] = useState([]);
  const [displayStates, setDisplayStates] = useState([]);
  const [error, setError] = useState('');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [repeat, setRepeat] = useState(false);
  const [role, setRole] = useState('Speaker 1');
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [currentPracticeIndex, setCurrentPracticeIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const cache = useRef({ textInput: null, dialogueData: null });
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    const fetchDialogue = async () => {
      if (!textInput) {
        setError('Vui lòng nhập đoạn văn ở tab Nhập văn bản');
        setDialogueData([]);
        setDisplayStates([]);
        cache.current = { textInput: null, dialogueData: null };
        sessionStorage.removeItem(`dialogue_${textInput}`);
        return;
      }

      const storageKey = `dialogue_${textInput}`;
      const cachedData = sessionStorage.getItem(storageKey);
      if (cachedData) {
        const { dialogueData: cachedDialogueData } = JSON.parse(cachedData);
        setDialogueData(cachedDialogueData);
        setDisplayStates(new Array(cachedDialogueData.length).fill(0));
        cache.current = { textInput, dialogueData: cachedDialogueData };
        setError('');
        return;
      }

      if (cache.current.textInput === textInput && cache.current.dialogueData) {
        setDialogueData(cache.current.dialogueData);
        setDisplayStates(new Array(cache.current.dialogueData.length).fill(0));
        setError('');
        return;
      }

      try {
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

        if (!geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          throw new Error('Phản hồi từ API Gemini không hợp lệ');
        }

        const dialogueText = geminiResponse.data.candidates[0].content.parts[0].text;
        const dialogueBlocks = dialogueText.split('\n\n').filter(block => block.trim());
        const parsedData = dialogueBlocks.map((block, index) => {
          const parts = block.split('---').map(part => part.trim());
          if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
            console.warn(`Invalid block ${index}:`, block);
            return null;
          }
          return { english: parts[0], vietnamese: parts[1], grammar: parts[2] };
        });

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
        cache.current = { textInput, dialogueData: validData };
        sessionStorage.setItem(`dialogue_${textInput}`, JSON.stringify({ dialogueData: validData }));
        setError('');
      } catch (err) {
        console.error('Error generating dialogue:', err);
        setError(`Lỗi khi tạo hội thoại: ${err.message}`);
      }
    };
    fetchDialogue();
  }, [textInput]);

  const toggleDisplay = (index) => {
    if (isPracticeMode) return;
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

    if (window.responsiveVoice) {
      window.responsiveVoice.cancel();
    }

    const playNext = (index) => {
      if (index >= dialogueData.length) {
        if (repeat) {
          playNext(0);
        }
        return;
      }

      const item = dialogueData[index];
      const voice = index % 2 === 0 ? 'UK English Female' : 'US English Male';

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

    playNext(0);
  };

  const stopAudio = () => {
    if (window.responsiveVoice) {
      window.responsiveVoice.cancel();
    }
  };

  const startPracticeMode = () => {
    setIsPracticeMode(true);
    setCurrentPracticeIndex(0);
    setDisplayStates(new Array(dialogueData.length).fill(0));
    if (dialogueData.length > 0 && !isUserRole(0)) {
      playPracticeSentence(0);
    }
  };

  const isUserRole = (index) => {
    return role === (index % 2 === 0 ? 'Speaker 1' : 'Speaker 2');
  };

  const playPracticeSentence = (index) => {
    if (index >= dialogueData.length) {
      setIsPracticeMode(false);
      return;
    }

    if (window.responsiveVoice) {
      window.responsiveVoice.cancel();
    }

    const item = dialogueData[index];
    const voice = index % 2 === 0 ? 'UK English Female' : 'US English Male';

    window.responsiveVoice.speak(
      item.english,
      voice,
      {
        rate: playbackSpeed,
        volume: 1,
        onend: () => {
          setCurrentPracticeIndex(index + 1);
        }
      }
    );
  };

  const handleNextAfterRecording = () => {
    if (currentPracticeIndex >= dialogueData.length) {
      setIsPracticeMode(false);
      return;
    }

    setCurrentPracticeIndex(currentPracticeIndex + 1);
    if (currentPracticeIndex + 1 < dialogueData.length && !isUserRole(currentPracticeIndex + 1)) {
      playPracticeSentence(currentPracticeIndex + 1);
    }
  };

  const checkMicrophonePermission = async () => {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
      if (permissionStatus.state === 'granted') {
        return true;
      } else if (permissionStatus.state === 'prompt') {
        return false;
      } else {
        throw new Error('Quyền truy cập micro bị từ chối. Vui lòng kiểm tra cài đặt trình duyệt.');
      }
    } catch (err) {
      throw new Error('Không thể kiểm tra quyền micro: ' + err.message);
    }
  };

  const checkAvailableDevices = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
      stream.getTracks().forEach(track => track.stop());
      if (audioInputDevices.length === 0) {
        throw new Error('Không tìm thấy micro. Vui lòng kiểm tra kết nối thiết bị âm thanh hoặc cài đặt hệ thống.');
      }
      return true;
    } catch (err) {
      throw new Error('Lỗi khi kiểm tra thiết bị: ' + err.message);
    }
  };

  const startRecording = async () => {
    try {
      const hasPermission = await checkMicrophonePermission();
      if (!hasPermission) {
        console.log('Yêu cầu quyền truy cập micro');
      }
      await checkAvailableDevices();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const storageKey = `dialogue_${textInput}`;
        const cachedData = sessionStorage.getItem(storageKey);
        if (cachedData) {
          const updatedData = JSON.parse(cachedData);
          updatedData.recordings = updatedData.recordings || {};
          updatedData.recordings[currentPracticeIndex - 1] = URL.createObjectURL(audioBlob);
          sessionStorage.setItem(storageKey, JSON.stringify(updatedData));
        }
        handleNextAfterRecording();
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError(
        err.message.includes('thiết bị')
          ? 'Không tìm thấy micro. Vui lòng kiểm tra kết nối thiết bị âm thanh hoặc cài đặt hệ thống.'
          : err.message.includes('quyền')
          ? 'Không thể truy cập micro. Vui lòng cấp quyền micro trong cài đặt trình duyệt và đảm bảo trang web chạy trên https.'
          : 'Lỗi khi truy cập micro: ' + err.message
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="dialogue-container">
      {error && (
        <div className="error-message">{error}</div>
      )}
      <div className="audio-controls">
        <button
          className="practice-button"
          onClick={startPracticeMode}
        >
          Luyện giao tiếp
        </button>
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
        <label className="block mb-1 mt-2">Chọn vai:</label>
        <select
          className="select"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="Speaker 1">Speaker 1</option>
          <option value="Speaker 2">Speaker 2</option>
        </select>
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
        {dialogueData.map((item, index) => {
          const isCurrentUserRole = isUserRole(index);
          const shouldShow = !isPracticeMode || index <= currentPracticeIndex;

          return shouldShow && (
            <div
              key={index}
              className={`dialogue-item ${index % 2 === 0 ? 'dark-blue' : 'white'} ${isPracticeMode && isCurrentUserRole ? 'user-hint' : ''}`}
              onClick={() => toggleDisplay(index)}
            >
              <div className="dialogue-english">{item.english}</div>
              {!isPracticeMode && displayStates[index] >= 1 && (
                <>
                  <hr className="divider" />
                  <div className="dialogue-vietnamese">{item.vietnamese}</div>
                </>
              )}
              {!isPracticeMode && displayStates[index] === 2 && (
                <>
                  <hr className="divider" />
                  <div className="dialogue-grammar">{item.grammar}</div>
                </>
              )}
              {isPracticeMode && isCurrentUserRole && index === currentPracticeIndex && (
                <div className="recording-controls">
                  <button
                    className={`record-button ${isRecording ? 'recording' : ''}`}
                    onClick={isRecording ? stopRecording : startRecording}
                  >
                    {isRecording ? 'Dừng ghi âm' : 'Ghi âm'}
                  </button>
                  <button
                    className="next-button"
                    onClick={handleNextAfterRecording}
                  >
                    Tiếp theo
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DialogueTab;