import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, RotateCcw,
  Repeat, Languages
} from 'lucide-react';
import { Subtitle } from '@/lib/api-client';

export interface VideoPlayerRef {
  seek: (time: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
}

interface VideoPlayerProps {
  videoUrl: string;
  subtitles: Subtitle[];
  subtitlesCn?: Subtitle[];
  currentSubtitle: Subtitle | null;
  onTimeUpdate: (time: number) => void;
  onSubtitleClick: (subtitle: Subtitle) => void;
  showTranslation?: boolean;
  onToggleTranslation?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(({
  videoUrl,
  subtitles,
  subtitlesCn,
  currentSubtitle,
  onTimeUpdate,
  onSubtitleClick,
  showTranslation = true,
  onToggleTranslation,
  onPlay,
  onPause
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);

  useImperativeHandle(ref, () => ({
    seek: (time: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
        setCurrentTime(time);
      }
    },
    play: () => {
      videoRef.current?.play();
    },
    pause: () => {
      videoRef.current?.pause();
    },
    togglePlay: () => {
      togglePlay();
    }
  }));

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      onTimeUpdate(time);

      // Handle loop
      if (isLooping && loopStart !== null && loopEnd !== null) {
        if (time >= loopEnd) {
          videoRef.current.currentTime = loopStart;
          // Optionally play if paused?
          if (!isPlaying) {
            // videoRef.current.play(); // Usually keep current state
          }
        }
      }
    }
  }, [onTimeUpdate, isLooping, loopStart, loopEnd, isPlaying]);

  const seek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const skipBack = () => {
    if (currentSubtitle) {
      seek(currentSubtitle.start);
    } else {
      seek(Math.max(0, currentTime - 5));
    }
  };

  const skipForward = () => {
    const nextSub = subtitles.find(s => s.start > currentTime);
    if (nextSub) {
      seek(nextSub.start);
    } else {
      seek(Math.min(duration, currentTime + 5));
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const handlePlaybackRateChange = (value: string) => {
    const rate = parseFloat(value);
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const setLoopForCurrentSubtitle = () => {
    if (currentSubtitle) {
      setLoopStart(currentSubtitle.start);
      // Add a small buffer to end or use exact? Usually end is exact.
      setLoopEnd(currentSubtitle.end);
      setIsLooping(true);
    }
  };

  const clearLoop = () => {
    setIsLooping(false);
    setLoopStart(null);
    setLoopEnd(null);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentTranslation = () => {
    if (!showTranslation || !subtitlesCn || !currentSubtitle) return null;
    return subtitlesCn.find(s =>
      Math.abs(s.start - currentSubtitle.start) < 0.5
    );
  };

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      // Restore playback rate if changed externally or on load
      video.playbackRate = playbackRate;

      const handleLoadedMetadata = () => setDuration(video.duration);
      const handlePlay = () => {
        console.log('[VideoPlayer] play event fired');
        setIsPlaying(true);
        onPlay?.();
      };
      const handlePause = () => {
        console.log('[VideoPlayer] pause event fired');
        setIsPlaying(false);
        onPause?.();
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);

      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
      };
    }
  }, [handleTimeUpdate, playbackRate, onPlay, onPause]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Video */}
      <div className="relative bg-black flex-1 flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain"
          onClick={togglePlay}
          playsInline={true}
          webkit-playsinline="true"
          x5-playsinline="true"
          x-webkit-airplay="allow"
          controls={false}
          preload="metadata"
        />

        {/* Subtitle Overlay */}

      </div>

      {/* Controls */}
      <div className="bg-card border-t p-3 space-y-2">
        {/* Progress Bar */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-10 text-right">{formatTime(currentTime)}</span>
          <Slider
            value={[currentTime]}
            max={duration}
            step={0.1}
            onValueChange={(value) => seek(value[0])}
            className="flex-1 cursor-pointer"
          />
          <span className="text-xs text-muted-foreground w-10">{formatTime(duration)}</span>
        </div>

        {/* Control Buttons Row */}
        <div className="flex items-center justify-between">

          {/* Left: Playback Controls */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={skipBack} title="上一句 Previous">
              <SkipBack className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={togglePlay} className="h-10 w-10" title={isPlaying ? "暂停 Pause" : "播放 Play"}>
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={skipForward} title="下一句 Next">
              <SkipForward className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => currentSubtitle && seek(currentSubtitle.start)}
              title="重播本句 Replay"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>

          {/* Right: Tools (Speed, Loop, Lang, Volume) */}
          <div className="flex items-center gap-2">

            {/* Speed Dropdown */}
            <Select value={playbackRate.toString()} onValueChange={handlePlaybackRateChange}>
              <SelectTrigger className="h-8 w-[70px] text-xs">
                <SelectValue placeholder="速度" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">0.5x</SelectItem>
                <SelectItem value="0.75">0.75x</SelectItem>
                <SelectItem value="1">1.0x</SelectItem>
                <SelectItem value="1.25">1.25x</SelectItem>
                <SelectItem value="1.5">1.5x</SelectItem>
                <SelectItem value="2">2.0x</SelectItem>
              </SelectContent>
            </Select>

            {/* Loop Toggle */}
            <Button
              variant={isLooping ? "secondary" : "ghost"}
              size="sm"
              onClick={isLooping ? clearLoop : setLoopForCurrentSubtitle}
              className={`h-8 px-2 text-xs ${isLooping ? 'text-primary font-bold' : ''}`}
              title="单句循环 Loop Sentence"
            >
              <Repeat className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">{isLooping ? '循环中' : 'AB'}</span>
            </Button>

            {/* Language Toggle */}
            {onToggleTranslation && (
              <Button
                variant={showTranslation ? "secondary" : "ghost"}
                size="sm"
                onClick={onToggleTranslation}
                className="h-8 px-2 text-xs"
                title="切换字幕语言 Toggle Language"
              >
                <Languages className="w-3.5 h-3.5 mr-1" />
                <span className="hidden sm:inline">{showTranslation ? '中英' : '英文'}</span>
              </Button>
            )}

            {/* Volume */}
            <div className="flex items-center gap-1 group">
              <Button variant="ghost" size="icon" onClick={toggleMute} className="h-8 w-8">
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              <div className="w-0 overflow-hidden group-hover:w-20 transition-all duration-300">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.1}
                  onValueChange={handleVolumeChange}
                  className="w-16"
                />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';
