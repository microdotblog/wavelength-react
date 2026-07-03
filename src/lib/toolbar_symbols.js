export const TOOLBAR_SYMBOLS = {
  bold: {
    android_label: 'B',
    ios: 'bold',
  },
  checkmark: {
    android_label: '✓',
    ios: 'checkmark.circle.fill',
  },
  italic: {
    android_label: 'I',
    ios: 'italic',
  },
  link: {
    android_label: '🔗',
    ios: 'link',
    multicolor: true,
  },
  pause: {
    android_icon: 'pause',
    ios: 'pause.fill',
  },
  play: {
    android_icon: 'play-arrow',
    android_size_adjustment: 2,
    android_style: {
      marginLeft: 1,
    },
    ios: 'play.fill',
  },
  quote: {
    android_label: '❝',
    ios: 'quote.bubble',
  },
  settings: {
    android_image: require('../../assets/icons/toolbar/settings.png'),
    ios: 'gearshape',
    multicolor: true,
  },
  trash: {
    android_label: 'Del',
    ios: 'trash',
  },
  waveform: {
    android_label: '〰',
    ios: 'waveform',
    multicolor: true,
  },
  xmark: {
    android_label: '×',
    ios: 'xmark',
  },
};