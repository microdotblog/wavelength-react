import Toast from 'react-native-simple-toast';

export function show_toast(message) {
  Toast.showWithGravity(`${message || ''}`.trim(), Toast.SHORT, Toast.CENTER);
}
