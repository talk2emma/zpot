import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import Mapbox from '@rnmapbox/maps';
import '../src/i18n';
import { ZpotMap } from '../src/components/maps/ZpotMap';
import { ALL_LAYERS } from '../src/components/maps/types';

jest.mock('../src/constants/env', () => ({ ENV: { mapStyleUrl: 'mapbox://styles/mapbox/streets-v12',
  mapboxPublicToken: 'pk.test-token', mapboxConfigured: true, showDevTools: false } }));
const mockEnv: { mapboxConfigured: boolean } = require('../src/constants/env').ENV;

const baseProps = {
  styleUrl: 'mapbox://styles/mapbox/streets-v12', center: { latitude: 38.71, longitude: -9.14 }, features: [],
  layers: ALL_LAYERS, selectedId: null, markerLabel: () => '', onSelect: () => undefined, testID: 'map',
};
const NOT_CONFIGURED = /isn’t configured in this build/;

afterEach(() => { mockEnv.mapboxConfigured = true; });

describe('ZpotMap (Mapbox)', () => {
  it('with a public token renders Mapbox, sets the token and disables telemetry', async () => {
    await render(<ZpotMap {...baseProps} />);
    expect(screen.queryByText(NOT_CONFIGURED)).toBeNull();
    expect(Mapbox.setAccessToken).toHaveBeenCalledWith('pk.test-token');
    expect(Mapbox.setTelemetryEnabled).toHaveBeenCalledWith(false);
  });

  it('without a token reports the map unavailable once instead of rendering a blank map', async () => {
    mockEnv.mapboxConfigured = false;
    const onMapError = jest.fn();
    const r = await render(<ZpotMap {...baseProps} onMapError={() => onMapError()} />);
    expect(screen.getByText(NOT_CONFIGURED)).toBeTruthy();
    await r.rerender(<ZpotMap {...baseProps} onMapError={() => onMapError()} />);
    expect(onMapError).toHaveBeenCalledTimes(1);
  });
});

describe('MapboxMapView idle handling (render-loop guard)', () => {
  const idle = (w: number) => ({ properties: { center: [-9.14, 38.71], zoom: 15, heading: 0, pitch: 0,
    bounds: { sw: [w, 38.70], ne: [w + 0.02, 38.72] } }, gestures: { isGestureActive: false } });

  it('ignores repeated onMapIdle events for an unchanged camera and forwards real moves', async () => {
    const mocked = require('@rnmapbox/maps');
    const Orig = mocked.MapView;
    let mapProps: { onMapIdle: (s: unknown) => void } | undefined;
    mocked.MapView = (p: { onMapIdle: (s: unknown) => void }) => { mapProps = p; return <Orig {...p} />; };
    const onRegionChange = jest.fn();
    try {
      await render(<ZpotMap {...baseProps} onRegionChange={onRegionChange} />);
      await act(async () => { for (let i = 0; i < 5; i++) mapProps!.onMapIdle(idle(-9.15)); });
      expect(onRegionChange).toHaveBeenCalledTimes(1);
      await act(async () => { mapProps!.onMapIdle(idle(-9.10)); });
    } finally { mocked.MapView = Orig; }
    expect(onRegionChange).toHaveBeenCalledTimes(2);
  });
});
