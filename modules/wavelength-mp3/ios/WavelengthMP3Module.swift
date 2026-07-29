import AVFoundation
import AudioToolbox
import CoreMedia
import ExpoModulesCore
import LAME

private let outputBitrateKbps: Int32 = 128
private let outputSampleRate: Int32 = 44_100
private let adtsFramesPerBatch = 256
private let adtsSampleRates: [Double] = [
  96_000,
  88_200,
  64_000,
  48_000,
  44_100,
  32_000,
  24_000,
  22_050,
  16_000,
  12_000,
  11_025,
  8_000,
  7_350,
]

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

private enum M4aExportError: LocalizedError {
  case cannotCreateOutput
  case cannotReadInput
  case invalidAacData
  case writeFailed

  var errorDescription: String? {
    switch self {
    case .cannotCreateOutput:
      return "The M4A output file could not be created."
    case .cannotReadInput:
      return "The audio file could not be opened."
    case .invalidAacData:
      return "The audio file does not contain valid AAC data."
    case .writeFailed:
      return "The AAC audio could not be written to an M4A file."
    }
  }
}

private struct AdtsFrame {
  let audioObjectType: UInt32
  let channelCount: UInt32
  let frameLength: Int
  let framesPerPacket: UInt32
  let frequencyIndex: UInt32
  let headerLength: Int
  let sampleRate: Double
}

public class WavelengthMP3Module: Module {
  public func definition() -> ModuleDefinition {
    Name("WavelengthMP3")

    AsyncFunction("exportM4aAsync") { (inputUri: String, outputUri: String) -> String in
      let inputUrl = try self.fileUrl(from: inputUri)
      let outputUrl = try self.fileUrl(from: outputUri)

      try self.exportM4a(inputUrl: inputUrl, outputUrl: outputUrl)

      return outputUrl.absoluteString
    }

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

  private func exportM4a(inputUrl: URL, outputUrl: URL) throws {
    guard FileManager.default.fileExists(atPath: inputUrl.path) else {
      throw M4aExportError.cannotReadInput
    }

    let inputData = try Data(contentsOf: inputUrl)
    let firstFrame = try parseAdtsFrame(in: inputData, at: 0)
    var audioFormat = AudioStreamBasicDescription(
      mSampleRate: firstFrame.sampleRate,
      mFormatID: kAudioFormatMPEG4AAC,
      mFormatFlags: firstFrame.audioObjectType,
      mBytesPerPacket: 0,
      mFramesPerPacket: 1_024,
      mBytesPerFrame: 0,
      mChannelsPerFrame: firstFrame.channelCount,
      mBitsPerChannel: 0,
      mReserved: 0
    )

    try? FileManager.default.removeItem(at: outputUrl)

    var outputFile: AudioFileID?
    let createStatus = AudioFileCreateWithURL(
      outputUrl as CFURL,
      kAudioFileM4AType,
      &audioFormat,
      AudioFileFlags.eraseFile,
      &outputFile
    )

    guard createStatus == noErr, let outputFile else {
      throw M4aExportError.cannotCreateOutput
    }

    defer {
      AudioFileClose(outputFile)
    }

    let magicCookie = makeAacMagicCookie(for: firstFrame)
    let cookieStatus = magicCookie.withUnsafeBytes { cookieBytes in
      AudioFileSetProperty(
        outputFile,
        kAudioFilePropertyMagicCookieData,
        UInt32(cookieBytes.count),
        cookieBytes.baseAddress!
      )
    }

    guard cookieStatus == noErr else {
      throw M4aExportError.cannotCreateOutput
    }

    var batchData = Data()
    var packetDescriptions: [AudioStreamPacketDescription] = []
    var packetIndex: Int64 = 0
    var offset = 0

    while offset < inputData.count {
      let frame = try parseAdtsFrame(in: inputData, at: offset)

      guard frame.audioObjectType == firstFrame.audioObjectType,
            frame.channelCount == firstFrame.channelCount,
            frame.frequencyIndex == firstFrame.frequencyIndex else {
        throw M4aExportError.invalidAacData
      }

      let payloadStart = offset + frame.headerLength
      let frameEnd = offset + frame.frameLength
      let payloadLength = frameEnd - payloadStart
      let packetOffset = Int64(batchData.count)

      batchData.append(inputData[payloadStart..<frameEnd])
      packetDescriptions.append(
        AudioStreamPacketDescription(
          mStartOffset: packetOffset,
          mVariableFramesInPacket: frame.framesPerPacket,
          mDataByteSize: UInt32(payloadLength)
        )
      )
      offset = frameEnd

      if packetDescriptions.count == adtsFramesPerBatch || offset == inputData.count {
        try writeAacPackets(
          batchData,
          descriptions: &packetDescriptions,
          to: outputFile,
          startingAt: packetIndex
        )
        packetIndex += Int64(packetDescriptions.count)
        batchData.removeAll(keepingCapacity: true)
        packetDescriptions.removeAll(keepingCapacity: true)
      }
    }
  }

  private func parseAdtsFrame(in data: Data, at offset: Int) throws -> AdtsFrame {
    guard offset >= 0,
          data.count - offset >= 7,
          data[offset] == 0xff,
          data[offset + 1] & 0xf0 == 0xf0 else {
      throw M4aExportError.invalidAacData
    }

    let frequencyIndex = UInt32((data[offset + 2] & 0x3c) >> 2)

    guard frequencyIndex < adtsSampleRates.count else {
      throw M4aExportError.invalidAacData
    }

    let channelCount = UInt32(
      ((data[offset + 2] & 0x01) << 2)
        | ((data[offset + 3] & 0xc0) >> 6)
    )
    let frameLength = Int(
      (UInt32(data[offset + 3] & 0x03) << 11)
        | (UInt32(data[offset + 4]) << 3)
        | (UInt32(data[offset + 5] & 0xe0) >> 5)
    )
    let headerLength = data[offset + 1] & 0x01 == 1 ? 7 : 9

    guard channelCount > 0,
          frameLength > headerLength,
          frameLength <= data.count - offset else {
      throw M4aExportError.invalidAacData
    }

    return AdtsFrame(
      audioObjectType: UInt32((data[offset + 2] & 0xc0) >> 6) + 1,
      channelCount: channelCount,
      frameLength: frameLength,
      framesPerPacket: 1_024 * (UInt32(data[offset + 6] & 0x03) + 1),
      frequencyIndex: frequencyIndex,
      headerLength: headerLength,
      sampleRate: adtsSampleRates[Int(frequencyIndex)]
    )
  }

  private func makeAacMagicCookie(for frame: AdtsFrame) -> [UInt8] {
    let bitrate = UInt32(outputBitrateKbps) * 1_000
    let audioSpecificConfig = [
      UInt8((frame.audioObjectType << 3) | (frame.frequencyIndex >> 1)),
      UInt8(((frame.frequencyIndex & 1) << 7) | (frame.channelCount << 3)),
    ]

    return [
      0x03, 0x80, 0x80, 0x80, 0x22,
      0x00, 0x00, 0x00,
      0x04, 0x80, 0x80, 0x80, 0x14,
      0x40, 0x14, 0x00, 0x18, 0x00,
      UInt8((bitrate >> 24) & 0xff),
      UInt8((bitrate >> 16) & 0xff),
      UInt8((bitrate >> 8) & 0xff),
      UInt8(bitrate & 0xff),
      UInt8((bitrate >> 24) & 0xff),
      UInt8((bitrate >> 16) & 0xff),
      UInt8((bitrate >> 8) & 0xff),
      UInt8(bitrate & 0xff),
      0x05, 0x80, 0x80, 0x80, 0x02,
      audioSpecificConfig[0], audioSpecificConfig[1],
      0x06, 0x80, 0x80, 0x80, 0x01, 0x02,
    ]
  }

  private func writeAacPackets(
    _ data: Data,
    descriptions: inout [AudioStreamPacketDescription],
    to outputFile: AudioFileID,
    startingAt packetIndex: Int64
  ) throws {
    var packetCount = UInt32(descriptions.count)
    let writeStatus = data.withUnsafeBytes { dataBytes in
      descriptions.withUnsafeMutableBufferPointer { descriptionBuffer in
        AudioFileWritePackets(
          outputFile,
          false,
          UInt32(dataBytes.count),
          descriptionBuffer.baseAddress,
          packetIndex,
          &packetCount,
          dataBytes.baseAddress!
        )
      }
    }

    guard writeStatus == noErr, packetCount == UInt32(descriptions.count) else {
      throw M4aExportError.writeFailed
    }
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
