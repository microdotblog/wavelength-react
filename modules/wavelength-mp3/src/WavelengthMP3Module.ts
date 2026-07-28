import { NativeModule, requireNativeModule } from 'expo';

declare class WavelengthMP3Module extends NativeModule<{}> {
  exportMp3Async(inputUri: string, outputUri: string): Promise<string>;
}

export default requireNativeModule<WavelengthMP3Module>('WavelengthMP3');
