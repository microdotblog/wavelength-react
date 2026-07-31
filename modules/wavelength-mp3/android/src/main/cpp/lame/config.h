/*
 * Android configuration for LAME 3.100.
 * Added for Wavelength on 2026-07-30.
 */

#ifndef WAVELENGTH_LAME_CONFIG_H
#define WAVELENGTH_LAME_CONFIG_H

#include <stdint.h>

#ifndef HAVE_IEEE754_FLOAT32_T
typedef float ieee754_float32_t;
#endif

#ifndef HAVE_IEEE754_FLOAT64_T
typedef double ieee754_float64_t;
#endif

#ifndef HAVE_IEEE854_FLOAT80_T
typedef long double ieee854_float80_t;
#endif

#endif
