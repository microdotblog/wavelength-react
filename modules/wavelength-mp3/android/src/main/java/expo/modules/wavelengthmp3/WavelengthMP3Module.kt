package expo.modules.wavelengthmp3

import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder

private const val BITRATE_KBPS = 128
private const val CODEC_TIMEOUT_MICROS = 10_000L
private const val DEFAULT_SAMPLE_RATE = 44_100

private class Mp3ExportException(message: String) : Exception(message)

class WavelengthMP3Module : Module() {
  override fun definition() = ModuleDefinition {
    Name("WavelengthMP3")

    AsyncFunction("exportM4aAsync") { inputUri: String, outputUri: String ->
      val inputFile = fileFromUri(inputUri)
      val outputFile = fileFromUri(outputUri)

      exportM4a(inputFile, outputFile)

      Uri.fromFile(outputFile).toString()
    }

    AsyncFunction("exportMp3Async") { inputUri: String, outputUri: String ->
      val inputFile = fileFromUri(inputUri)
      val outputFile = fileFromUri(outputUri)

      exportMp3(inputFile, outputFile)

      Uri.fromFile(outputFile).toString()
    }
  }

  private fun fileFromUri(uri: String): File {
    val parsedUri = Uri.parse(uri)
    val path = if (parsedUri.scheme == "file") parsedUri.path else null

    if (path.isNullOrBlank()) {
      throw Mp3ExportException("A local audio file is required for audio export.")
    }

    return File(path)
  }

  private fun exportM4a(inputFile: File, outputFile: File) {
    if (!inputFile.exists()) {
      throw Mp3ExportException("The audio file could not be read.")
    }

    outputFile.delete()

    val extractor = MediaExtractor()
    var muxer: MediaMuxer? = null
    var muxerStarted = false
    var didFail = false

    try {
      extractor.setDataSource(inputFile.absolutePath)
      val trackIndex = findAudioTrack(extractor)

      if (trackIndex < 0) {
        throw Mp3ExportException("The audio file does not contain an audio track.")
      }

      val inputFormat = extractor.getTrackFormat(trackIndex)
      val mimeType = inputFormat.getString(MediaFormat.KEY_MIME)

      if (mimeType != MediaFormat.MIMETYPE_AUDIO_AAC) {
        throw Mp3ExportException("The audio file is not AAC.")
      }

      extractor.selectTrack(trackIndex)

      val activeMuxer = MediaMuxer(
        outputFile.absolutePath,
        MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4,
      )
      muxer = activeMuxer

      val outputTrackIndex = activeMuxer.addTrack(inputFormat)
      activeMuxer.start()
      muxerStarted = true

      val bufferSize = if (inputFormat.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE)) {
        maxOf(inputFormat.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE), 64 * 1024)
      } else {
        64 * 1024
      }
      val buffer = ByteBuffer.allocate(bufferSize)
      val bufferInfo = MediaCodec.BufferInfo()

      while (true) {
        buffer.clear()
        val sampleSize = extractor.readSampleData(buffer, 0)

        if (sampleSize < 0) {
          break
        }

        bufferInfo.offset = 0
        bufferInfo.size = sampleSize
        bufferInfo.presentationTimeUs = extractor.sampleTime
        bufferInfo.flags = extractor.sampleFlags
        activeMuxer.writeSampleData(outputTrackIndex, buffer, bufferInfo)
        extractor.advance()
      }
    } catch (error: Exception) {
      didFail = true
      throw Mp3ExportException(
        error.message ?: "The audio file could not be converted to M4A.",
      )
    } finally {
      if (muxerStarted) {
        try {
          muxer?.stop()
        } catch (_: Exception) {
        }
      }

      muxer?.release()
      extractor.release()

      if (didFail) {
        outputFile.delete()
      }
    }
  }

  private fun exportMp3(inputFile: File, outputFile: File) {
    if (!inputFile.exists()) {
      throw Mp3ExportException("The episode audio could not be read.")
    }

    outputFile.delete()

    val extractor = MediaExtractor()
    var decoder: MediaCodec? = null
    var lame: LameEncoder? = null

    try {
      extractor.setDataSource(inputFile.absolutePath)
      val trackIndex = findAudioTrack(extractor)

      if (trackIndex < 0) {
        throw Mp3ExportException("The episode does not contain an audio track.")
      }

      extractor.selectTrack(trackIndex)

      val inputFormat = extractor.getTrackFormat(trackIndex)
      val mimeType = inputFormat.getString(MediaFormat.KEY_MIME)
        ?: throw Mp3ExportException("The episode audio format could not be read.")

      inputFormat.setInteger(
        MediaFormat.KEY_PCM_ENCODING,
        AudioFormat.ENCODING_PCM_16BIT,
      )

      val activeDecoder = MediaCodec.createDecoderByType(mimeType)
      decoder = activeDecoder
      activeDecoder.configure(inputFormat, null, null, 0)
      activeDecoder.start()

      FileOutputStream(outputFile).use { output ->
        val bufferInfo = MediaCodec.BufferInfo()
        var channels = inputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
        var sampleRate = inputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
        var inputEnded = false
        var outputEnded = false

        while (!outputEnded) {
          if (!inputEnded) {
            val inputIndex = activeDecoder.dequeueInputBuffer(CODEC_TIMEOUT_MICROS)

            if (inputIndex >= 0) {
              val inputBuffer = activeDecoder.getInputBuffer(inputIndex)
                ?: throw Mp3ExportException("The episode audio could not be decoded.")
              val sampleSize = extractor.readSampleData(inputBuffer, 0)

              if (sampleSize < 0) {
                activeDecoder.queueInputBuffer(
                  inputIndex,
                  0,
                  0,
                  0,
                  MediaCodec.BUFFER_FLAG_END_OF_STREAM,
                )
                inputEnded = true
              } else {
                activeDecoder.queueInputBuffer(
                  inputIndex,
                  0,
                  sampleSize,
                  extractor.sampleTime,
                  0,
                )
                extractor.advance()
              }
            }
          }

          when (val outputIndex = activeDecoder.dequeueOutputBuffer(bufferInfo, CODEC_TIMEOUT_MICROS)) {
            MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
              val outputFormat = activeDecoder.outputFormat
              channels = outputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
              sampleRate = outputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)

              if (lame != null) {
                throw Mp3ExportException("The episode audio format changed during export.")
              }
            }

            MediaCodec.INFO_TRY_AGAIN_LATER -> Unit

            else -> {
              if (outputIndex >= 0) {
                if (bufferInfo.size > 0) {
                  val outputBuffer = activeDecoder.getOutputBuffer(outputIndex)
                    ?: throw Mp3ExportException("The episode audio could not be decoded.")

                  outputBuffer.position(bufferInfo.offset)
                  outputBuffer.limit(bufferInfo.offset + bufferInfo.size)
                  val pcmBuffer = outputBuffer
                    .slice()
                    .order(ByteOrder.LITTLE_ENDIAN)
                    .asShortBuffer()
                  val interleavedSamples = ShortArray(pcmBuffer.remaining())
                  pcmBuffer.get(interleavedSamples)
                  val monoSamples = downmixToMono(interleavedSamples, channels)

                  if (lame == null) {
                    lame = LameEncoder().also {
                      it.open(1, sampleRate.takeIf { rate -> rate > 0 } ?: DEFAULT_SAMPLE_RATE, BITRATE_KBPS, 2)
                    }
                  }

                  val encoded = lame.encode(monoSamples, 0, monoSamples.size)

                  if (encoded.isNotEmpty()) {
                    output.write(encoded)
                  }
                }

                outputEnded =
                  bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
                activeDecoder.releaseOutputBuffer(outputIndex, false)
              }
            }
          }
        }

        val activeLame = lame
          ?: throw Mp3ExportException("The episode does not contain any audio samples.")
        val finalFrames = activeLame.encode(ShortArray(0), 0, 0)

        if (finalFrames.isNotEmpty()) {
          output.write(finalFrames)
        }
      }

      val tagFrame = lame?.close() ?: byteArrayOf()
      lame = null

      if (tagFrame.isNotEmpty()) {
        RandomAccessFile(outputFile, "rw").use { output ->
          output.seek(0)
          output.write(tagFrame)
        }
      }
    } catch (error: Mp3ExportException) {
      outputFile.delete()
      throw error
    } catch (error: Exception) {
      outputFile.delete()
      throw Mp3ExportException(
        error.message ?: "The episode audio could not be encoded as MP3.",
      )
    } finally {
      try {
        lame?.encode(ShortArray(0), 0, 0)
        lame?.close()
      } catch (_: Exception) {
      }

      try {
        decoder?.stop()
      } catch (_: Exception) {
      }

      decoder?.release()
      extractor.release()
    }
  }

  private fun findAudioTrack(extractor: MediaExtractor): Int {
    for (index in 0 until extractor.trackCount) {
      val mimeType = extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME)

      if (mimeType?.startsWith("audio/") == true) {
        return index
      }
    }

    return -1
  }

  private fun downmixToMono(samples: ShortArray, channelCount: Int): ShortArray {
    if (channelCount <= 1) {
      return samples
    }

    val frameCount = samples.size / channelCount
    val monoSamples = ShortArray(frameCount)

    for (frameIndex in 0 until frameCount) {
      var sum = 0L
      val frameOffset = frameIndex * channelCount

      for (channelIndex in 0 until channelCount) {
        sum += samples[frameOffset + channelIndex].toLong()
      }

      monoSamples[frameIndex] = (sum / channelCount).toShort()
    }

    return monoSamples
  }
}
