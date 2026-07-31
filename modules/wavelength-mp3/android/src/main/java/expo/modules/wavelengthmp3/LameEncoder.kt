package expo.modules.wavelengthmp3

internal class LameEncoder {
  private var handle = 0L

  fun open(channels: Int, sampleRate: Int, bitrate: Int, quality: Int) {
    check(handle == 0L) {
      "The MP3 encoder is already open."
    }

    handle = nativeOpen(channels, sampleRate, bitrate, quality)
  }

  fun encode(samples: ShortArray, offset: Int, length: Int): ByteArray {
    check(handle != 0L) {
      "The MP3 encoder is not open."
    }

    return nativeEncode(handle, samples, offset, length)
  }

  fun close(): ByteArray {
    if (handle == 0L) {
      return byteArrayOf()
    }

    val activeHandle = handle
    handle = 0L

    return nativeClose(activeHandle)
  }

  private external fun nativeOpen(
    channels: Int,
    sampleRate: Int,
    bitrate: Int,
    quality: Int,
  ): Long

  private external fun nativeEncode(
    handle: Long,
    samples: ShortArray,
    offset: Int,
    length: Int,
  ): ByteArray

  private external fun nativeClose(handle: Long): ByteArray

  companion object {
    init {
      System.loadLibrary("wavelength-lame")
    }
  }
}
