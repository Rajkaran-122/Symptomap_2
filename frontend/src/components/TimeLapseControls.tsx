import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import { TimeWindow, PLAYBACK_SPEEDS } from '@/types';
import { useMapStore } from '@/store/useMapStore';

export const TimeLapseControls: React.FC = () => {
  const {
    timeWindow,
    isPlaying,
    playbackSpeed,
    setTimeWindow,
    setCurrentTime,
    play,
    pause,
    setPlaybackSpeed,
  } = useMapStore();

  const [currentTime, setLocalCurrentTime] = useState(timeWindow.start);
  const animationRef = useRef<number>();
  const lastUpdateRef = useRef<number>(Date.now());

  // Calculate total duration in milliseconds
  const totalDuration = timeWindow.end.getTime() - timeWindow.start.getTime();
  const currentProgress = (currentTime.getTime() - timeWindow.start.getTime()) / totalDuration;

  // Handle play/pause
  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    } else {
      play();
    }
  };

  // Handle speed change
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
  };

  // Handle time scrubbing
  const handleTimeScrub = (progress: number) => {
    const newTime = new Date(timeWindow.start.getTime() + progress * totalDuration);
    setLocalCurrentTime(newTime);
    setCurrentTime(newTime);
  };

  // Handle skip to beginning
  const handleSkipToStart = () => {
    setLocalCurrentTime(timeWindow.start);
    setCurrentTime(timeWindow.start);
  };

  // Handle skip to end
  const handleSkipToEnd = () => {
    setLocalCurrentTime(timeWindow.end);
    setCurrentTime(timeWindow.end);
  };

  // Handle reset
  const handleReset = () => {
    pause();
    setLocalCurrentTime(timeWindow.start);
    setCurrentTime(timeWindow.start);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;

    const animate = () => {
      const now = Date.now();
      const deltaTime = now - lastUpdateRef.current;
      lastUpdateRef.current = now;

      // Calculate time step based on playback speed
      const timeStep = (deltaTime * playbackSpeed) / 1000; // Convert to seconds
      const newTime = new Date(currentTime.getTime() + timeStep * 24 * 60 * 60 * 1000); // Convert to days

      if (newTime >= timeWindow.end) {
        // Reached end, pause
        pause();
        setLocalCurrentTime(timeWindow.end);
        setCurrentTime(timeWindow.end);
      } else {
        setLocalCurrentTime(newTime);
        setCurrentTime(newTime);
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, currentTime, timeWindow, playbackSpeed, pause, setCurrentTime]);

  // Format time for display
  const formatTime = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Format duration
  const formatDuration = (days: number) => {
    if (days < 1) return `${Math.round(days * 24)}h`;
    if (days < 7) return `${Math.round(days)}d`;
    return `${Math.round(days / 7)}w`;
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Time-lapse Playback</h3>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Speed:</span>
          <select
            value={playbackSpeed}
            onChange={(e) => handleSpeedChange(Number(e.target.value))}
            className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PLAYBACK_SPEEDS.map(speed => (
              <option key={speed} value={speed}>
                {speed}x
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Time display */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-600">
          {formatTime(currentTime)}
        </div>
        <div className="text-sm text-gray-600">
          {formatDuration(totalDuration / (24 * 60 * 60 * 1000))} total
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <input
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={currentProgress}
          onChange={(e) => handleTimeScrub(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{formatTime(timeWindow.start)}</span>
          <span>{formatTime(timeWindow.end)}</span>
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex items-center justify-center space-x-4">
        <button
          onClick={handleSkipToStart}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          title="Skip to start"
        >
          <SkipBack className="w-5 h-5" />
        </button>

        <button
          onClick={handlePlayPause}
          className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6 ml-0.5" />
          )}
        </button>

        <button
          onClick={handleSkipToEnd}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          title="Skip to end"
        >
          <SkipForward className="w-5 h-5" />
        </button>

        <button
          onClick={handleReset}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          title="Reset"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* Time window controls */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Time Window</span>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                const newEnd = new Date();
                const newStart = new Date(newEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
                setTimeWindow({ start: newStart, end: newEnd, days: 7 });
              }}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              7 days
            </button>
            <button
              onClick={() => {
                const newEnd = new Date();
                const newStart = new Date(newEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
                setTimeWindow({ start: newStart, end: newEnd, days: 30 });
              }}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              30 days
            </button>
            <button
              onClick={() => {
                const newEnd = new Date();
                const newStart = new Date(newEnd.getTime() - 90 * 24 * 60 * 60 * 1000);
                setTimeWindow({ start: newStart, end: newEnd, days: 90 });
              }}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              90 days
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
};

export default TimeLapseControls;

