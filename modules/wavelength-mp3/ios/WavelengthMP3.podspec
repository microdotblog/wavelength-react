Pod::Spec.new do |s|
  s.name           = 'WavelengthMP3'
  s.version        = '1.0.0'
  s.summary        = 'MP3 publishing support for Wavelength'
  s.description    = 'Decodes episode audio and encodes a mono MP3 with LAME.'
  s.author         = ''
  s.homepage       = 'https://wavelength.app/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'LAME-xcframework', '~> 3.100.3'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
