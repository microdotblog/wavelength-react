cmake_minimum_required(VERSION 3.22.1)

project(wavelength_lame LANGUAGES C)

set(LAME_DIR "${CMAKE_CURRENT_SOURCE_DIR}/lame")
set(LAME_SOURCE_DIR "${LAME_DIR}/libmp3lame")

add_library(
  wavelength-lame
  SHARED
  wavelength_lame_jni.c
  "${LAME_SOURCE_DIR}/lame.c"
  "${LAME_SOURCE_DIR}/util.c"
  "${LAME_SOURCE_DIR}/psymodel.c"
  "${LAME_SOURCE_DIR}/fft.c"
  "${LAME_SOURCE_DIR}/tables.c"
  "${LAME_SOURCE_DIR}/encoder.c"
  "${LAME_SOURCE_DIR}/newmdct.c"
  "${LAME_SOURCE_DIR}/quantize_pvt.c"
  "${LAME_SOURCE_DIR}/reservoir.c"
  "${LAME_SOURCE_DIR}/bitstream.c"
  "${LAME_SOURCE_DIR}/VbrTag.c"
  "${LAME_SOURCE_DIR}/version.c"
  "${LAME_SOURCE_DIR}/takehiro.c"
  "${LAME_SOURCE_DIR}/quantize.c"
  "${LAME_SOURCE_DIR}/vbrquantize.c"
  "${LAME_SOURCE_DIR}/gain_analysis.c"
  "${LAME_SOURCE_DIR}/id3tag.c"
  "${LAME_SOURCE_DIR}/set_get.c"
  "${LAME_SOURCE_DIR}/presets.c"
)

target_include_directories(
  wavelength-lame
  PRIVATE
  "${CMAKE_CURRENT_SOURCE_DIR}"
  "${LAME_DIR}"
  "${LAME_DIR}/include"
  "${LAME_SOURCE_DIR}"
)

target_compile_definitions(
  wavelength-lame
  PRIVATE
  HAVE_CONFIG_H
  STDC_HEADERS
  HAVE_MEMCPY
  HAVE_STRCHR
)

target_link_options(
  wavelength-lame
  PRIVATE
  "-Wl,-z,max-page-size=16384"
  "-Wl,-z,common-page-size=16384"
)

find_library(LOG_LIBRARY log)
find_library(MATH_LIBRARY m)

target_link_libraries(
  wavelength-lame
  "${LOG_LIBRARY}"
  "${MATH_LIBRARY}"
)
