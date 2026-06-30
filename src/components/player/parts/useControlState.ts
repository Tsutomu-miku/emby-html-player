import { useEffect, useState } from 'react'
import type { PlayerControl } from '../backends/control'

interface UseControlStateParams {
  video: HTMLVideoElement | null
  control?: PlayerControl
  playbackRate: number
  onPlaybackRateChange: (rate: number) => void
}

export function useControlState(params: UseControlStateParams) {
  const { video, control, playbackRate, onPlaybackRateChange } = params
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPaused, setIsPaused] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(document.fullscreenElement !== null)
  const [isPip, setIsPip] = useState(video ? document.pictureInPictureElement === video : false)
  const canPip = typeof document !== 'undefined' && !!document.pictureInPictureEnabled

  useEffect(() => {
    if (control) {
      setCurrent(control.currentTime)
      setDuration(control.duration)
      setIsPaused(control.paused)
      setIsMuted(control.muted)
      setVolume(control.volume)
      return
    }
    if (!video) return
    const setCurrentIfChanged = (value: number) => setCurrent((cur) => cur === value ? cur : value)
    const setDurationIfChanged = (value: number) => setDuration((cur) => cur === value ? cur : value)
    const onTime = () => setCurrentIfChanged(video.currentTime || 0)
    const onLoaded = () => setDurationIfChanged(video.duration || 0)
    const onPlay = () => setIsPaused((paused) => paused === false ? paused : false)
    const onPause = () => setIsPaused((paused) => paused === true ? paused : true)
    const onVol = () => {
      setIsMuted((muted) => muted === video.muted ? muted : video.muted)
      setVolume((value) => value === video.volume ? value : video.volume)
    }
    const onRate = () => {
      if (video.playbackRate !== playbackRate) onPlaybackRateChange(video.playbackRate)
    }
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('durationchange', onLoaded)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('volumechange', onVol)
    video.addEventListener('ratechange', onRate)
    onVol()
    onLoaded()
    setIsPaused((paused) => paused === video.paused ? paused : video.paused)
    return () => {
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('durationchange', onLoaded)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('volumechange', onVol)
      video.removeEventListener('ratechange', onRate)
    }
  }, [video, control, playbackRate, onPlaybackRateChange])

  useEffect(() => {
    const onFs = () => setIsFullscreen(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  useEffect(() => {
    if (control || !video) return
    const onPip = () => setIsPip(document.pictureInPictureElement === video)
    video.addEventListener('enterpictureinpicture', onPip)
    video.addEventListener('leavepictureinpicture', onPip)
    return () => {
      video.removeEventListener('enterpictureinpicture', onPip)
      video.removeEventListener('leavepictureinpicture', onPip)
    }
  }, [video, control])

  return { current, duration, isPaused, isMuted, volume, isFullscreen, isPip, canPip }
}
