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

  test('downsample_waveform returns empty array for empty input', () => {
    expect(downsample_waveform([])).toEqual([]);
    expect(downsample_waveform([Number.NaN, Number.POSITIVE_INFINITY])).toEqual([]);
  });

  test('downsample_waveform passes through short sample arrays unchanged', () => {
    expect(downsample_waveform([0.2, 0.8], 4)).toEqual([0.2, 0.8]);
  });

  test('downsample_waveform keeps the peak value in each bucket', () => {
    const downsampled = downsample_waveform([0.1, 0.9, 0.2, 0.8], 2);

    expect(downsampled).toEqual([0.9, 0.8]);
  });
});
