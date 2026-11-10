function loadEnv(token: string) {
  let env: { mapboxConfigured: boolean; mapboxPublicToken: string } | undefined;
  jest.isolateModules(() => {
    jest.doMock('../src/constants/env.generated', () => ({ GENERATED_ENV: { ZPOT_MAPBOX_PUBLIC_TOKEN: token } }));
    env = require('../src/constants/env').ENV;
  });
  return env!;
}

describe('ENV Mapbox token parsing', () => {
  it('accepts only public pk.* tokens', () => {
    expect(loadEnv('pk.abc')).toMatchObject({ mapboxConfigured: true, mapboxPublicToken: 'pk.abc' });
    expect(loadEnv('sk.secret')).toMatchObject({ mapboxConfigured: false, mapboxPublicToken: '' });
    expect(loadEnv('').mapboxConfigured).toBe(false);
  });
});
