import type { SharePreset } from '../../../shared/types'

interface ChromeMediaConstraints extends MediaTrackConstraints {
  mandatory: {
    chromeMediaSource: 'desktop'
    chromeMediaSourceId: string
    maxWidth: number
    maxHeight: number
    maxFrameRate: number
  }
}

export async function captureSource(
  sourceId: string,
  preset: SharePreset,
  includeAudio: boolean
): Promise<MediaStream> {
  const videoConstraints: ChromeMediaConstraints = {
    mandatory: {
      chromeMediaSource: 'desktop',
      chromeMediaSourceId: sourceId,
      maxWidth: preset.width,
      maxHeight: preset.height,
      maxFrameRate: preset.frameRate
    }
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: includeAudio
      ? ({
          mandatory: {
            chromeMediaSource: 'desktop'
          }
        } as unknown as MediaTrackConstraints)
      : false,
    video: videoConstraints as unknown as MediaTrackConstraints
  })

  return stream
}
