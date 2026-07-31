#include <jni.h>
#include <stdint.h>
#include <stdlib.h>

#include <lame.h>

static void throw_runtime_exception(JNIEnv *env, const char *message) {
  jclass exception_class = (*env)->FindClass(env, "java/lang/RuntimeException");

  if (exception_class != NULL) {
    (*env)->ThrowNew(env, exception_class, message);
  }
}

static jbyteArray make_byte_array(
  JNIEnv *env,
  const unsigned char *bytes,
  int length
) {
  jbyteArray result = (*env)->NewByteArray(env, length);

  if (result != NULL && length > 0) {
    (*env)->SetByteArrayRegion(
      env,
      result,
      0,
      length,
      (const jbyte *)bytes
    );
  }

  return result;
}

JNIEXPORT jlong JNICALL
Java_expo_modules_wavelengthmp3_LameEncoder_nativeOpen(
  JNIEnv *env,
  jobject instance,
  jint channels,
  jint sample_rate,
  jint bitrate,
  jint quality
) {
  (void)instance;

  lame_t encoder = lame_init();

  if (encoder == NULL) {
    throw_runtime_exception(env, "The MP3 encoder could not be initialized.");
    return 0;
  }

  lame_set_num_channels(encoder, channels);
  lame_set_mode(encoder, channels == 1 ? MONO : STEREO);
  lame_set_in_samplerate(encoder, sample_rate);
  lame_set_VBR(encoder, vbr_off);
  lame_set_brate(encoder, bitrate);
  lame_set_quality(encoder, quality);

  if (lame_init_params(encoder) != 0) {
    lame_close(encoder);
    throw_runtime_exception(env, "The MP3 encoder settings are invalid.");
    return 0;
  }

  return (jlong)(intptr_t)encoder;
}

JNIEXPORT jbyteArray JNICALL
Java_expo_modules_wavelengthmp3_LameEncoder_nativeEncode(
  JNIEnv *env,
  jobject instance,
  jlong handle,
  jshortArray input,
  jint offset,
  jint length
) {
  (void)instance;

  lame_t encoder = (lame_t)(intptr_t)handle;

  if (encoder == NULL) {
    throw_runtime_exception(env, "The MP3 encoder is not open.");
    return NULL;
  }

  if (offset < 0 || length < 0 ||
      offset + length > (*env)->GetArrayLength(env, input)) {
    throw_runtime_exception(env, "The MP3 input buffer is invalid.");
    return NULL;
  }

  int channels = lame_get_num_channels(encoder);
  int sample_count = channels > 0 ? length / channels : 0;
  int output_capacity = (sample_count * 5 / 4) + 7200;
  unsigned char *output = malloc((size_t)output_capacity);

  if (output == NULL) {
    throw_runtime_exception(env, "The MP3 output buffer could not be created.");
    return NULL;
  }

  int encoded_length;

  if (length == 0) {
    encoded_length = lame_encode_flush(
      encoder,
      output,
      output_capacity
    );
  } else {
    jshort *samples = (*env)->GetShortArrayElements(env, input, NULL);

    if (samples == NULL) {
      free(output);
      return NULL;
    }

    if (channels == 1) {
      encoded_length = lame_encode_buffer(
        encoder,
        samples + offset,
        samples + offset,
        sample_count,
        output,
        output_capacity
      );
    } else {
      encoded_length = lame_encode_buffer_interleaved(
        encoder,
        samples + offset,
        sample_count,
        output,
        output_capacity
      );
    }

    (*env)->ReleaseShortArrayElements(env, input, samples, JNI_ABORT);
  }

  if (encoded_length < 0) {
    free(output);
    throw_runtime_exception(env, "The MP3 audio could not be encoded.");
    return NULL;
  }

  jbyteArray result = make_byte_array(env, output, encoded_length);
  free(output);

  return result;
}

JNIEXPORT jbyteArray JNICALL
Java_expo_modules_wavelengthmp3_LameEncoder_nativeClose(
  JNIEnv *env,
  jobject instance,
  jlong handle
) {
  (void)instance;

  lame_t encoder = (lame_t)(intptr_t)handle;

  if (encoder == NULL) {
    return (*env)->NewByteArray(env, 0);
  }

  int output_capacity = 7200;
  unsigned char *output = malloc((size_t)output_capacity);

  if (output == NULL) {
    lame_close(encoder);
    throw_runtime_exception(env, "The MP3 tag buffer could not be created.");
    return NULL;
  }

  int output_length = lame_get_lametag_frame(
    encoder,
    output,
    output_capacity
  );
  lame_close(encoder);

  if (output_length < 0 || output_length > output_capacity) {
    free(output);
    throw_runtime_exception(env, "The MP3 tag could not be written.");
    return NULL;
  }

  jbyteArray result = make_byte_array(env, output, output_length);
  free(output);

  return result;
}
