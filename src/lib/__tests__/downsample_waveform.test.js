const {
  downsample_waveform,
  upsample_waveform_levels,
  WAVEFORM_SAMPLE_COUNT,
} = require('../downsample_waveform');

describe('downsample_waveform', () => {
  test('WAVEFORM_SAMPLE_COUNT is high enough for smooth playback', () => {
    expect(WAVEFORM_SAMPLE_COUNT).toBeGreaterThanOrEqual(96);
  });

  test('upsample_waveform_levels interpolates between stored peaks', () => {
    const upsampled = upsample_waveform_levels([0, 1], 5);

    expect(upsampled).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  test('upsample_waveform_levels downscales when target is smaller', () => {
    const upsampled = upsample_waveform_levels([0, 0.2, 0.8, 1], 2);

    expect(upsampled).toEqual([0.2, 1]);
  });
});
