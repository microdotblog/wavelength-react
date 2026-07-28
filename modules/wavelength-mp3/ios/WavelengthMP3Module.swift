import AVFoundation
import CoreMedia
import ExpoModulesCore
import LAME

private let outputBitrateKbps: Int32 = 128
private let outputSampleRate: Int32 = 44_100

private enum Mp3ExportError: LocalizedError {
  case cannotCreateEncoder
  case cannotCreateOutput
  case cannotReadInput
  case cannotStartReader
  case encodeFailed
  case missingAudioTrack

  var errorDescription: String? {
    switch self {
    case .cannotCreateEncoder:
      return "The MP3 encoder could not be initialized."
    case .cannotCreateOutput:
      return "The MP3 output file could not be created."
    case .cannotReadInput:
      return "The episode audio could not be decoded."
    case .cannotStartReader:
      return "The episode audio could not be opened."
    case .encodeFailed:
      return "The episode audio could not be encoded as MP3."
    case .missingAudioTrack:
      return "The episode does not contain an audio track."
    }
  }
}

public class WavelengthMP3Module: Module {
  public func definition() -> ModuleDefinition {
    Name("WavelengthMP3")

    AsyncFunction("exportMp3Async") { (inputUri: String, outputUri: String) -> String in
      let inputUrl = try self.fileUrl(from: inputUri)
      let outputUrl = try self.fileUrl(from: outputUri)

      try self.exportMp3(inputUrl: inputUrl, outputUrl: outputUrl)

      return outputUrl.absoluteString
    }
  }

  private func fileUrl(from uri: String) throws -> URL {
    if let url = URL(string: uri), url.isFileURL {
      return url
    }

    throw Mp3ExportError.cannotReadInput
  }

  private func exportMp3(inputUrl: URL, outputUrl: URL) throws {
    guard FileManager.default.fileExists(atPath: inputUrl.path) else {
      throw Mp3ExportError.cannotReadInput
    }

    let asset = AVURLAsset(url: inputUrl)

    guard let track = asset.tracks(withMediaType: .audio).first else {
      throw Mp3ExportError.missingAudioTrack
    }

    let outputSettings: [String: Any] = [
      AVFormatIDKey: kAudioFormatLinearPCM,
      AVLinearPCMBitDepthKey: 16,
      AVLinearPCMIsBigEndianKey: false,
      AVLinearPCMIsFloatKey: false,
      AVLinearPCMIsNonInterleaved: false,
      AVNumberOfChannelsKey: 1,
      AVSampleRateKey: outputSampleRate,
    ]
    let trackOutput = AVAssetReaderTrackOutput(track: track, outputSettings: outputSettings)
    trackOutput.alwaysCopiesSampleData = false

    let reader = try AVAssetReader(asset: asset)

    guard reader.canAdd(trackOutput) else {
      throw Mp3ExportError.cannotReadInput
    }

    reader.add(trackOutput)

    guard reader.startReading() else {
      throw Mp3ExportError.cannotStartReader
    }

    try? FileManager.default.removeItem(at: outputUrl)

    guard FileManager.default.createFile(atPath: outputUrl.path, contents: nil),
          let outputFile = fopen(outputUrl.path, "wb+") else {
      reader.cancelReading()
      throw Mp3ExportError.cannotCreateOutput
    }

    defer {
      fclose(outputFile)
    }

    guard let encoder = lame_init() else {
      reader.cancelReading()
      throw Mp3ExportError.cannotCreateEncoder
    }

    defer {
      lame_close(encoder)
    }

    lame_set_num_channels(encoder, 1)
    lame_set_in_samplerate(encoder, outputSampleRate)
    lame_set_out_samplerate(encoder, outputSampleRate)
    lame_set_mode(encoder, MONO)
    lame_set_VBR(encoder, vbr_off)
    lame_set_brate(encoder, outputBitrateKbps)
    lame_set_quality(encoder, 2)

    guard lame_init_params(encoder) >= 0 else {
      reader.cancelReading()
      throw Mp3ExportError.cannotCreateEncoder
    }

    while let sampleBuffer = trackOutput.copyNextSampleBuffer() {
      try encode(sampleBuffer: sampleBuffer, with: encoder, to: outputFile)
    }

    guard reader.status == .completed else {
      throw reader.error ?? Mp3ExportError.cannotReadInput
    }

    var flushBuffer = [UInt8](repeating: 0, count: 7_200)
    let flushCount = lame_encode_flush(
      encoder,
      &flushBuffer,
      Int32(flushBuffer.count)
    )

    guard flushCount >= 0 else {
      throw Mp3ExportError.encodeFailed
    }

    if flushCount > 0 {
      let written = fwrite(flushBuffer, 1, Int(flushCount), outputFile)

      guard written == Int(flushCount) else {
        throw Mp3ExportError.cannotCreateOutput
      }
    }

    fflush(outputFile)
    lame_mp3_tags_fid(encoder, outputFile)
  }

  private func encode(
    sampleBuffer: CMSampleBuffer,
    with encoder: OpaquePointer,
    to outputFile: UnsafeMutablePointer<FILE>
  ) throws {
    guard let blockBuffer = CMSampleBufferGetDataBuffer(sampleBuffer) else {
      throw Mp3ExportError.cannotReadInput
    }

    let byteCount = CMBlockBufferGetDataLength(blockBuffer)

    if byteCount <= 0 {
      return
    }

    let sampleCount = byteCount / MemoryLayout<Int16>.size
    var samples = [Int16](repeating: 0, count: sampleCount)
    let copyStatus = samples.withUnsafeMutableBytes { buffer in
      CMBlockBufferCopyDataBytes(
        blockBuffer,
        atOffset: 0,
        dataLength: byteCount,
        destination: buffer.baseAddress!
      )
    }

    guard copyStatus == kCMBlockBufferNoErr else {
      throw Mp3ExportError.cannotReadInput
    }

    var mp3Buffer = [UInt8](
      repeating: 0,
      count: Int(1.25 * Double(sampleCount)) + 7_200
    )
    let encodedCount = samples.withUnsafeMutableBufferPointer { sampleBuffer in
      lame_encode_buffer(
        encoder,
        sampleBuffer.baseAddress,
        sampleBuffer.baseAddress,
        Int32(sampleCount),
        &mp3Buffer,
        Int32(mp3Buffer.count)
      )
    }

    guard encodedCount >= 0 else {
      throw Mp3ExportError.encodeFailed
    }

    if encodedCount > 0 {
      let written = fwrite(mp3Buffer, 1, Int(encodedCount), outputFile)

      guard written == Int(encodedCount) else {
        throw Mp3ExportError.cannotCreateOutput
      }
    }
  }
}
