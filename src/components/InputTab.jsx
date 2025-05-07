import { useState, useEffect } from 'react';
import axios from 'axios';
import './InputTab.css';

function InputTab({ textInput, setTextInput }) {
  const [sentenceData, setSentenceData] = useState([]);
const [displayStates, setDisplayStates] = useState([]);
const [error, setError] = useState('');
const [playbackSpeed, setPlaybackSpeed] = useState(1);
const [repeat, setRepeat] = useState(false);
const [repeatCount, setRepeatCount] = useState(0);
const [totalCharsSpoken, setTotalCharsSpoken] = useState(0);
const [isAnalyzing, setIsAnalyzing] = useState(false);
const [isPlaying, setIsPlaying] = useState(false);
const [isCancelled, setIsCancelled] = useState(false);

useEffect(() => {
  if (!textInput) {
    setSentenceData([]);
    setDisplayStates([]);
    setError('');
    return;
  }

  const storageKey = `analysis_${textInput}`;
  const cachedData = sessionStorage.getItem(storageKey);
  if (cachedData) {
    const { sentenceData: cachedSentenceData } = JSON.parse(cachedData);
    setSentenceData(cachedSentenceData);
    setDisplayStates(new Array(cachedSentenceData.length).fill(0));
    setError('');
  }
}, [textInput]);

const analyzeText = async () => {
  if (!textInput) {
    setError('Vui lòng nhập đoạn văn!');
    setSentenceData([]);
    setDisplayStates([]);
    return;
  }

  setError('');
  setIsAnalyzing(true); // Bật trạng thái loading
  setSentenceData([]); // Xóa dữ liệu cũ
  setDisplayStates([]); // Xóa trạng thái hiển thị cũ

  try {
    // 1. Tách đoạn theo xuống dòng
    let paragraphs = textInput.split('\n').filter(p => p.trim().length > 0);
    
    // 2. Gom đoạn ngắn
    let mergedParagraphs = [];
    let tempParagraph = '';
    
    for (let i = 0; i < paragraphs.length; i++) {
      const current = paragraphs[i].trim();
      if (tempParagraph.length + current.length < 150 && mergedParagraphs.length < 8) {
        tempParagraph += (tempParagraph ? ' ' : '') + current;
      } else {
        if (tempParagraph) {
          mergedParagraphs.push(tempParagraph);
          tempParagraph = current;
        } else {
          mergedParagraphs.push(current);
        }
      }
    }
    if (tempParagraph) mergedParagraphs.push(tempParagraph);
    
    if (mergedParagraphs.length === 0) {
      setError('Không tìm thấy đoạn văn hợp lệ');
      setIsAnalyzing(false);
      return;
    }

    // 3. Gọi API với các API Key luân phiên
    const apiKeys = [
      process.env.REACT_APP_GEMINI_API_KEY_1,
      process.env.REACT_APP_GEMINI_API_KEY_2,
      process.env.REACT_APP_GEMINI_API_KEY_3
    ];
    
    let currentApiKeyIndex = 0;
    let tempResults = [];
    
    for (const paragraph of mergedParagraphs) {
      let success = false;
      let retryCount = 0;
      let result;
      
      while (!success && retryCount < apiKeys.length) {
        try {
          const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKeys[currentApiKeyIndex]}`,
            {
              contents: [{
                parts: [{
                  text: `Phân tích đoạn văn sau. Nếu có nhiều câu, phân tích từng câu riêng biệt.
                    Trả về định dạng (chú ý không gửi thêm bất cứ câu thừa, giới thiệu, mô tả, tương tác nào thêm ví dụ: đây là nội dung trả lời...), chỉ trả về đúng kết quả cần, gồm: mỗi câu gốc tiếng Anh, dịch tiếng Việt, phân tích ngữ pháp chi tiết.
                    Các phần của mỗi câu phân cách bằng "---". Giữa các câu phân cách bằng "===".
                    Trong phần phân tích ngữ pháp:
                    - Đánh dấu các cụm từ trong dấu "" cần in đậm bằng ký hiệu ** (ví dụ: **"I love"**).
                    - Cụm đầu tiên trong "" luôn được in đậm (thêm **).
                    - Các cụm "" tiếp theo: Nếu bất kỳ từ nào trong cụm trùng với bất kỳ từ nào trong các cụm "" trước đó, không thêm **; nếu không trùng, thêm **.
                    - Sau mỗi cụm được in đậm, thêm ký hiệu || để đánh dấu xuống dòng.
                    Ví dụ:
                    
                    I love learning English.
                    ---
                    Tôi yêu thích học tiếng Anh.
                    ---
                    **"I love"** là cấu trúc chủ ngữ + động từ.||**"love learning"** là cụm động từ + danh động từ.||**"new concept"** là cụm tính từ + danh từ.||
                    
                    ===
                    
                    This is a book.
                    ---
                    Đây là một quyển sách.
                    ---
                    **"This is"** là cấu trúc...||
                    
                    Đoạn văn: "${paragraph}"`
                }]
              }]
            },
            {
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );
          
          result = response.data.candidates[0].content.parts[0].text;
          success = true;
        } catch (err) {
          console.error(`Error with API Key ${currentApiKeyIndex + 1}:`, err);
          currentApiKeyIndex = (currentApiKeyIndex + 1) % apiKeys.length;
          retryCount++;
        }
      }
      
      if (!success) {
        console.error('All API Keys failed for paragraph:', paragraph);
        const errorResult = {
          english: paragraph,
          vietnamese: 'Lỗi khi dịch',
          grammar: 'Lỗi khi phân tích'
        };
        tempResults.push(errorResult);
        continue;
      }
      
      // Tách kết quả thành các câu riêng biệt
      const sentencesInParagraph = result.split('===').map(s => s.trim()).filter(s => s);

      for (const sentenceResult of sentencesInParagraph) {
        const parts = sentenceResult.split('---').map(p => p.trim());
        if (parts.length >= 3) {
          tempResults.push({
            english: parts[0],
            vietnamese: parts[1],
            grammar: parts.slice(2).join('---')
          });
        } else {
          tempResults.push({
            english: sentenceResult,
            vietnamese: 'Lỗi định dạng dịch',
            grammar: 'Lỗi định dạng phân tích'
          });
        }
      }
    }
    
    // Sau khi xử lý tất cả các đoạn văn, cập nhật UI và sessionStorage một lần
    if (tempResults.length > 0) {
      const indexedResults = tempResults.map((item, index) => ({ ...item, index }));
      setSentenceData(indexedResults);
      setDisplayStates(new Array(indexedResults.length).fill(0));
      sessionStorage.setItem(`analysis_${textInput}`, JSON.stringify({ sentenceData: indexedResults }));
    } else {
      setError('Không có kết quả phân tích hợp lệ');
    }
      } catch (err) {
        console.error('Error analyzing text:', err);
        setError('Đã xảy ra lỗi khi phân tích văn bản');
      } finally {
        setIsAnalyzing(false); // Tắt trạng thái loading
      }
    };

  const playAudio = () => {
    console.log('playAudio called, responsiveVoice available:', !!window.responsiveVoice);
    console.log('sentenceData length:', sentenceData.length);
    
    if (sentenceData.length === 0) {
      setError('Không có câu để phát');
      console.log('Error: No sentences to play');
      return;
    }

    if (window.responsiveVoice) {
      window.responsiveVoice.cancel();
    } else {
      console.warn('ResponsiveVoice không khả dụng, nhưng vẫn thử phát âm');
    }

    if (totalCharsSpoken > 50000) {
      setError('Đã vượt giới hạn ký tự phát âm. Vui lòng thử lại sau vài phút.');
      console.log('Error: Exceeded character limit');
      return;
    }

    setIsPlaying(true);

    const playNext = (index) => {
      if (index >= sentenceData.length) {
        setIsPlaying(false);
        setRepeatCount(0);
        console.log('playNext stopped: index=', index);
        return;
      }

      const item = sentenceData[index];
      if (item.english.length > 1000) {
        console.warn(`Sentence ${index} too long (${item.english.length} chars), skipping`);
        playNext(index + 1);
        return;
      }

      setTotalCharsSpoken(prev => prev + item.english.length);

      const voice = 'US English Male';
      console.log(`Playing sentence ${index}: "${item.english}" with voice ${voice}`);
      
      if (window.responsiveVoice) {
        window.responsiveVoice.speak(
          item.english,
          voice,
          {
            rate: playbackSpeed,
            volume: 1,
            onend: () => {
              console.log(`Finished playing sentence ${index}`);
              if (isPlaying && repeat && repeatCount < 3 && index >= sentenceData.length - 1) {
                setRepeatCount(prev => prev + 1);
                console.log('Repeating, count:', repeatCount + 1);
                setTimeout(() => playNext(0), 10000);
              } else {
                playNext(index + 1);
              }
            },
          }
        );
      } else {
        console.error('ResponsiveVoice không khả dụng khi gọi speak');
        setError('Không thể phát âm: Thư viện ResponsiveVoice không khả dụng.');
        setIsPlaying(false);
        setRepeatCount(0);
        return;
      }
    };

    playNext(0);
  };

  const stopAudio = () => {
    if (window.responsiveVoice) {
      window.responsiveVoice.cancel();
    }
    setIsPlaying(false);
    setIsCancelled(true); // Đặt cờ hủy
    setRepeatCount(0);
    console.log('stopAudio called');
  };

  const toggleDisplay = (index) => {
    setDisplayStates(prev => {
      const newStates = [...prev];
      newStates[index] = (newStates[index] + 1) % 3;
      return newStates;
    });
  };

  const formatGrammar = (grammar) => {
    const segments = grammar.split('||').filter(s => s.trim()); // Tách theo ký hiệu xuống dòng

    return segments.map((segment, segmentIndex) => {
      const sentences = segment.split('.').filter(s => s.trim()); // Tách câu trong đoạn
      const formattedSentences = sentences.map((sentence, sentenceIndex) => {
        let phrase = '';
        let explanation = sentence;

        // Regex để phát hiện cụm từ trong **"text"** hoặc *"text"**
        const match = sentence.match(/(?:\*\*|\*)?["']([^"']+)["'](?:\*\*|\*)?/);
        if (match) {
          phrase = match[1]; // Lấy cụm từ bên trong dấu ""
          explanation = sentence.replace(match[0], '').trim(); // Xóa cụm và ký hiệu
        }

        // Chỉ bold cụm đầu tiên trong đoạn
        const isBold = sentenceIndex === 0;

        return (
          <span key={`${segmentIndex}-${sentenceIndex}`}>
            {phrase ? (
              isBold ? (
                <><strong>"{phrase}"</strong> {explanation}</>
              ) : (
                <>"{phrase}" {explanation}</>
              )
            ) : (
              <>{sentence}</>
            )}
            {sentenceIndex < sentences.length - 1 && '.'} {/* Thêm dấu chấm giữa các câu */}
          </span>
        );
      });

      return (
        <div key={segmentIndex} className="grammar-line">
          {formattedSentences}
          <br /> {/* Xuống dòng sau mỗi đoạn */}
        </div>
      );
    });
  };

  return (
    <div className="input-container">
      {error && (
        <div className="error-message">{error}</div>
      )}
      <textarea
        className="textarea"
        rows="5"
        placeholder="Nhập đoạn văn tiếng Anh..."
        value={textInput}
        onChange={(e) => setTextInput(e.target.value)}
      />
      <button
        className="button"
        onClick={analyzeText}
        disabled={isAnalyzing}
      >
        {isAnalyzing ? 'Đang xử lý...' : 'Phân tích'}
      </button>
      <div className="audio-controls">
        <div className="button-group">
          <button
            className="play-sentence-button"
            onClick={playAudio}
          >
            Phát hội thoại
          </button>
          <button
            className="stop-sentence-button"
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
          <option value="0.8">0.8x</option>
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
      <div className="sentence-list">
        {sentenceData.map((item, index) => (
          <div
            key={index}
            className="sentence-item"
            onClick={() => toggleDisplay(index)}
          >
            <div className="sentence-english">{item.english}</div>
            {displayStates[index] >= 1 && (
              <>
                <hr className="divider" />
                <div className="sentence-vietnamese">{item.vietnamese}</div>
              </>
            )}
            {displayStates[index] === 2 && (
              <>
                <hr className="divider" />
                <div className="sentence-grammar">{formatGrammar(item.grammar)}</div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default InputTab;