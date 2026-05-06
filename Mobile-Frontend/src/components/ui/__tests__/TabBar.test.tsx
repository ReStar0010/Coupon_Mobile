import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TabBar from '../../chrome/TabBar';

describe('TabBar', () => {
  it('renders all 4 tabs', () => {
    const { getByText } = render(
      <TabBar activeTab="home" onTabPress={() => {}} />
    );
    expect(getByText('CouPro')).toBeTruthy();
    expect(getByText('CouMap')).toBeTruthy();
    expect(getByText('Spinner')).toBeTruthy();
    expect(getByText('Settings')).toBeTruthy();
  });

  it('calls onTabPress with correct tab when home is pressed', () => {
    const onTabPress = jest.fn();
    const { getByTestId } = render(
      <TabBar activeTab="map" onTabPress={onTabPress} />
    );
    fireEvent.press(getByTestId('tab-home'));
    expect(onTabPress).toHaveBeenCalledWith('home');
  });

  it('calls onTabPress with correct tab when map is pressed', () => {
    const onTabPress = jest.fn();
    const { getByTestId } = render(
      <TabBar activeTab="home" onTabPress={onTabPress} />
    );
    fireEvent.press(getByTestId('tab-map'));
    expect(onTabPress).toHaveBeenCalledWith('map');
  });

  it('calls onTabPress with correct tab when spinner is pressed', () => {
    const onTabPress = jest.fn();
    const { getByTestId } = render(
      <TabBar activeTab="home" onTabPress={onTabPress} />
    );
    fireEvent.press(getByTestId('tab-spinner'));
    expect(onTabPress).toHaveBeenCalledWith('spinner');
  });

  it('calls onTabPress with correct tab when settings is pressed', () => {
    const onTabPress = jest.fn();
    const { getByTestId } = render(
      <TabBar activeTab="home" onTabPress={onTabPress} />
    );
    fireEvent.press(getByTestId('tab-settings'));
    expect(onTabPress).toHaveBeenCalledWith('settings');
  });

  it('highlights home tab when active', () => {
    const { getByTestId } = render(
      <TabBar activeTab="home" onTabPress={() => {}} />
    );
    expect(getByTestId('tab-home-active')).toBeTruthy();
  });

  it('highlights map tab when active', () => {
    const { getByTestId } = render(
      <TabBar activeTab="map" onTabPress={() => {}} />
    );
    expect(getByTestId('tab-map-active')).toBeTruthy();
  });
});
