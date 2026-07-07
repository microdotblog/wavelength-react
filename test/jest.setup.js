globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('expo-file-system', () => {
  const UploadType = { MULTIPART: 1 };

  return {
    Directory: jest.fn(),
    File: jest.fn(),
    Paths: { document: 'file:///documents/' },
    UploadType,
  };
});
