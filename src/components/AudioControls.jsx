function AudioControls({ playbackSpeed, setPlaybackSpeed, repeat, setRepeat, playAllAudio, hasAudio }) {
    return (
      <div className="audio-controls">
        <label className="block mb-1">Tốc độ phát:</label>
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
        {hasAudio && (
          <button
            className="button"
            onClick={playAllAudio}
          >
            Phát toàn bộ
          </button>
        )}
      </div>
    );
  }
  
  export default AudioControls;