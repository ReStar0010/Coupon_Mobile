import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SettingsScreen from '../SettingsScreen';

const defaultProps = {
  onNavigate: jest.fn(),
  gems: 3,
  couPoints: 128,
};

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders profile section with name and email', () => {
    const { getByTestId } = render(<SettingsScreen {...defaultProps} />);
    expect(getByTestId('profile-name')).toBeTruthy();
    expect(getByTestId('profile-email')).toBeTruthy();
  });

  it('renders notification toggle rows', () => {
    const { getByTestId } = render(<SettingsScreen {...defaultProps} />);
    expect(getByTestId('toggle-push')).toBeTruthy();
    expect(getByTestId('toggle-email')).toBeTruthy();
  });

  it('tap logout row opens logout modal', () => {
    const { getByTestId } = render(<SettingsScreen {...defaultProps} />);
    fireEvent.press(getByTestId('btn-logout'));
    expect(getByTestId('logout-modal')).toBeTruthy();
  });

  it('tap delete account row opens delete modal', () => {
    const { getByTestId } = render(<SettingsScreen {...defaultProps} />);
    fireEvent.press(getByTestId('btn-delete-account'));
    expect(getByTestId('delete-modal')).toBeTruthy();
  });

  it('tap block list opens blocked merchants modal', () => {
    const { getByTestId } = render(<SettingsScreen {...defaultProps} />);
    fireEvent.press(getByTestId('btn-blocked'));
    expect(getByTestId('blocked-modal')).toBeTruthy();
  });
});
