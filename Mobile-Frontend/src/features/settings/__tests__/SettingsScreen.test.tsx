import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SettingsScreen from '../SettingsScreen';

// ── Service mocks ────────────────────────────────────────────────────────────
const mockUpdateProfile = jest.fn();
const mockRefreshAuth = jest.fn();

jest.mock('@/src/services/api/profile', () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));

jest.mock('@/src/state/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'u1',
      email: 'duankayne@gmail.com',
      phone: '+886 912-345-678',
      displayName: 'CoKayne',
      avatarUrl: null,
      phoneVerified: false,
    },
    isLoading: false,
    isAuthenticated: true,
    login: jest.fn(),
    loginWithOtp: jest.fn(),
    logout: jest.fn(),
    refreshAuth: mockRefreshAuth,
  }),
}));

// expo-constants — the source of truth for app version on the settings screen.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '9.9.9' },
  },
}));

// ── Chrome mocks ─────────────────────────────────────────────────────────────
jest.mock('@/src/components/chrome/StatusBar', () => 'AppStatusBar');
jest.mock('@/src/components/chrome/TabBar', () => {
  const React = require('react');
  const { View, Pressable, Text } = require('react-native');
  return ({ activeTab, onTabPress }: { activeTab: string; onTabPress: (tab: string) => void }) =>
    React.createElement(
      View,
      { testID: 'tab-bar' },
      React.createElement(
        Pressable,
        { testID: 'tab-home', onPress: () => onTabPress('home') },
        React.createElement(Text, null, 'home'),
      ),
    );
});

// ── Modal mocks ──────────────────────────────────────────────────────────────
jest.mock('../modals/EditProfileModal', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return ({
    visible,
    name,
    email,
    phone,
    onSave,
    onClose,
  }: {
    visible: boolean;
    name: string;
    email: string;
    phone: string;
    onSave: (n: string, e: string, p: string) => void | Promise<void>;
    onClose: () => void;
  }) =>
    visible
      ? React.createElement(
          View,
          { testID: 'edit-profile-modal' },
          React.createElement(Text, { testID: 'edit-modal-name' }, name),
          React.createElement(
            Pressable,
            {
              testID: 'edit-modal-save-email',
              onPress: () => onSave(name, 'newemail@test.com', phone),
            },
            React.createElement(Text, null, '儲存信箱'),
          ),
          React.createElement(
            Pressable,
            {
              testID: 'edit-modal-save-phone',
              onPress: () => onSave(name, email, '+886 999-000-111'),
            },
            React.createElement(Text, null, '儲存電話'),
          ),
          React.createElement(
            Pressable,
            { testID: 'edit-modal-close', onPress: onClose },
            React.createElement(Text, null, '關閉'),
          ),
        )
      : null;
});

jest.mock('../modals/LogoutConfirmModal', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return ({
    visible,
    onLogout,
    onClose,
  }: {
    visible: boolean;
    onLogout: () => void;
    onClose: () => void;
  }) =>
    visible
      ? React.createElement(
          View,
          { testID: 'logout-modal' },
          React.createElement(
            Pressable,
            { testID: 'logout-confirm', onPress: onLogout },
            React.createElement(Text, null, '確定登出'),
          ),
          React.createElement(
            Pressable,
            { testID: 'logout-cancel', onPress: onClose },
            React.createElement(Text, null, '取消'),
          ),
        )
      : null;
});

jest.mock('../modals/DeleteAccountModal', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return ({
    visible,
    onClose,
    testID,
  }: {
    visible: boolean;
    onClose: () => void;
    testID?: string;
  }) =>
    visible
      ? React.createElement(
          View,
          { testID: testID ?? 'delete-modal' },
          React.createElement(
            Pressable,
            { testID: 'delete-modal-close', onPress: onClose },
            React.createElement(Text, null, '取消'),
          ),
        )
      : null;
});

jest.mock('../modals/FeedbackModal', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return ({
    visible,
    type,
    onClose,
  }: {
    visible: boolean;
    type: 'bug' | 'feature';
    onClose: () => void;
  }) =>
    visible
      ? React.createElement(
          View,
          { testID: 'feedback-modal' },
          React.createElement(Text, { testID: 'feedback-type' }, type),
          React.createElement(
            Pressable,
            { testID: 'feedback-close', onPress: onClose },
            React.createElement(Text, null, '關閉'),
          ),
        )
      : null;
});

jest.mock('../modals/BlockedMerchantsModal', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return ({ visible, onClose }: { visible: boolean; onClose: () => void }) =>
    visible
      ? React.createElement(
          View,
          { testID: 'blocked-modal' },
          React.createElement(
            Pressable,
            { testID: 'blocked-modal-close', onPress: onClose },
            React.createElement(Text, null, '完成'),
          ),
        )
      : null;
});

jest.mock('../modals/VerifyModal', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return ({
    visible,
    field,
    onClose,
  }: {
    visible: boolean;
    field: 'email' | 'phone';
    currentVal: string;
    onClose: () => void;
  }) =>
    visible
      ? React.createElement(
          View,
          { testID: 'verify-modal' },
          React.createElement(Text, { testID: 'verify-field' }, field),
          React.createElement(
            Pressable,
            { testID: 'verify-close', onPress: onClose },
            React.createElement(Text, null, '關閉'),
          ),
        )
      : null;
});

jest.mock('../modals/LegalTextModal', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return ({
    visible,
    type,
    onClose,
  }: {
    visible: boolean;
    type: 'terms' | 'privacy';
    onClose: () => void;
  }) =>
    visible
      ? React.createElement(
          View,
          { testID: 'legal-modal' },
          React.createElement(Text, { testID: 'legal-type' }, type),
          React.createElement(
            Pressable,
            { testID: 'legal-close', onPress: onClose },
            React.createElement(Text, null, '關閉'),
          ),
        )
      : null;
});

// ── Default props ─────────────────────────────────────────────────────────────
const defaultProps = {
  onNavigate: jest.fn(),
  gems: 3,
  couPoints: 128,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateProfile.mockResolvedValue(undefined);
  mockRefreshAuth.mockResolvedValue(undefined);
});

// ── Test suites ───────────────────────────────────────────────────────────────

describe('SettingsScreen — profile section', () => {
  it('renders profile section with name and email', () => {
    const { getByTestId } = render(<SettingsScreen {...defaultProps} />);
    expect(getByTestId('profile-name')).toBeTruthy();
    expect(getByTestId('profile-email')).toBeTruthy();
  });

  it('profile name comes from useAuth().user.displayName', () => {
    const { getByTestId } = render(<SettingsScreen {...defaultProps} />);
    expect(getByTestId('profile-name').props.children).toBe('CoKayne');
  });

  it('profile email comes from useAuth().user.email', () => {
    const { getByTestId } = render(<SettingsScreen {...defaultProps} />);
    expect(getByTestId('profile-email').props.children).toBe('duankayne@gmail.com');
  });

  it('couPoints and gems are displayed in profile card', () => {
    const { getByText } = render(<SettingsScreen {...defaultProps} gems={7} couPoints={256} />);
    expect(getByText('256 pt')).toBeTruthy();
    expect(getByText('7 💎')).toBeTruthy();
  });
});

describe('SettingsScreen — edit profile modal', () => {
  it('edit button opens EditProfileModal', () => {
    const { getByText, queryByTestId } = render(<SettingsScreen {...defaultProps} />);
    expect(queryByTestId('edit-profile-modal')).toBeNull();
    fireEvent.press(getByText('編輯'));
    expect(queryByTestId('edit-profile-modal')).toBeTruthy();
  });

  it('EditProfileModal receives current profile name', () => {
    const { getByText, getByTestId } = render(<SettingsScreen {...defaultProps} />);
    fireEvent.press(getByText('編輯'));
    expect(getByTestId('edit-modal-name').props.children).toBe('CoKayne');
  });

  it('closing EditProfileModal via onClose hides it', () => {
    const { getByText, getByTestId, queryByTestId } = render(<SettingsScreen {...defaultProps} />);
    fireEvent.press(getByText('編輯'));
    fireEvent.press(getByTestId('edit-modal-close'));
    expect(queryByTestId('edit-profile-modal')).toBeNull();
  });

  it('saving calls updateProfile with display name', async () => {
    const { getByText, getByTestId } = render(<SettingsScreen {...defaultProps} />);
    fireEvent.press(getByText('編輯'));
    fireEvent.press(getByTestId('edit-modal-save-email'));
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({ displayName: 'CoKayne' });
    });
  });

  it('saving with changed email opens VerifyModal for email', async () => {
    const { getByText, getByTestId, findByTestId } = render(
      <SettingsScreen {...defaultProps} />,
    );
    fireEvent.press(getByText('編輯'));
    fireEvent.press(getByTestId('edit-modal-save-email'));
    const verifyModal = await findByTestId('verify-modal');
    expect(verifyModal).toBeTruthy();
    expect(getByTestId('verify-field').props.children).toBe('email');
  });

  it('saving with changed phone opens VerifyModal for phone', async () => {
    const { getByText, getByTestId, findByTestId } = render(
      <SettingsScreen {...defaultProps} />,
    );
    fireEvent.press(getByText('編輯'));
    fireEvent.press(getByTestId('edit-modal-save-phone'));
    const verifyModal = await findByTestId('verify-modal');
    expect(verifyModal).toBeTruthy();
    expect(getByTestId('verify-field').props.children).toBe('phone');
  });
});

describe('SettingsScreen — logout modal', () => {
  it('tap logout row opens logout modal', () => {
    const { getByTestId } = render(<SettingsScreen {...defaultProps} />);
    fireEvent.press(getByTestId('btn-logout'));
    expect(getByTestId('logout-modal')).toBeTruthy();
  });

  it('cancelling logout modal closes it', () => {
    const { getByTestId, queryByTestId } = render(<SettingsScreen {...defaultProps} />);
    fireEvent.press(getByTestId('btn-logout'));
    fireEvent.press(getByTestId('logout-cancel'));
    expect(queryByTestId('logout-modal')).toBeNull();
  });

  it('confirming logout calls onNavigate with "home"', () => {
    const onNavigate = jest.fn();
    const { getByTestId } = render(<SettingsScreen {...defaultProps} onNavigate={onNavigate} />);
    fireEvent.press(getByTestId('btn-logout'));
    fireEvent.press(getByTestId('logout-confirm'));
    expect(onNavigate).toHaveBeenCalledWith('home');
  });

  it('confirming logout closes the modal', () => {
    const onNavigate = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <SettingsScreen {...defaultProps} onNavigate={onNavigate} />,
    );
    fireEvent.press(getByTestId('btn-logout'));
    fireEvent.press(getByTestId('logout-confirm'));
    expect(queryByTestId('logout-modal')).toBeNull();
  });
});

describe('SettingsScreen — delete account modal', () => {
  it('tap delete account row opens delete modal', () => {
    const { getByTestId } = render(<SettingsScreen {...defaultProps} />);
    fireEvent.press(getByTestId('btn-delete-account'));
    expect(getByTestId('delete-modal')).toBeTruthy();
  });

  it('closing delete modal via onClose hides it', () => {
    const { getByTestId, queryByTestId } = render(<SettingsScreen {...defaultProps} />);
    fireEvent.press(getByTestId('btn-delete-account'));
    fireEvent.press(getByTestId('delete-modal-close'));
    expect(queryByTestId('delete-modal')).toBeNull();
  });
});

describe('SettingsScreen — blocked merchants modal', () => {
  it('tap block list opens blocked merchants modal', () => {
    const { getByTestId } = render(<SettingsScreen {...defaultProps} />);
    fireEvent.press(getByTestId('btn-blocked'));
    expect(getByTestId('blocked-modal')).toBeTruthy();
  });

  it('closing blocked modal via onClose hides it', () => {
    const { getByTestId, queryByTestId } = render(<SettingsScreen {...defaultProps} />);
    fireEvent.press(getByTestId('btn-blocked'));
    fireEvent.press(getByTestId('blocked-modal-close'));
    expect(queryByTestId('blocked-modal')).toBeNull();
  });
});

describe('SettingsScreen — feedback modal', () => {
  it('tap bug report opens FeedbackModal with type "bug"', () => {
    const { getByText, getByTestId } = render(<SettingsScreen {...defaultProps} />);
    fireEvent.press(getByText('🐞 回報問題'));
    expect(getByTestId('feedback-modal')).toBeTruthy();
    expect(getByTestId('feedback-type').props.children).toBe('bug');
  });

  it('tap feature suggestion opens FeedbackModal with type "feature"', () => {
    const { getByText, getByTestId } = render(<SettingsScreen {...defaultProps} />);
    fireEvent.press(getByText('💡 功能建議'));
    expect(getByTestId('feedback-modal')).toBeTruthy();
    expect(getByTestId('feedback-type').props.children).toBe('feature');
  });

  it('closing feedback modal hides it', () => {
    const { getByText, getByTestId, queryByTestId } = render(<SettingsScreen {...defaultProps} />);
    fireEvent.press(getByText('🐞 回報問題'));
    fireEvent.press(getByTestId('feedback-close'));
    expect(queryByTestId('feedback-modal')).toBeNull();
  });
});

describe('SettingsScreen — verify modal', () => {
  it('verify phone modal opens via phone row verify button', () => {
    const { getByText, getByTestId } = render(<SettingsScreen {...defaultProps} />);
    fireEvent.press(getByText('驗證'));
    expect(getByTestId('verify-modal')).toBeTruthy();
    expect(getByTestId('verify-field').props.children).toBe('phone');
  });

  it('closing VerifyModal for phone hides it and refreshes auth', () => {
    const { getByText, getByTestId, queryByTestId } = render(<SettingsScreen {...defaultProps} />);
    fireEvent.press(getByText('驗證'));
    fireEvent.press(getByTestId('verify-close'));
    expect(queryByTestId('verify-modal')).toBeNull();
    expect(mockRefreshAuth).toHaveBeenCalled();
  });
});

describe('SettingsScreen — legal modals', () => {
  it('pressing terms (first 閱讀) opens LegalTextModal with type "terms"', () => {
    const { getAllByText, getByTestId } = render(<SettingsScreen {...defaultProps} />);
    fireEvent.press(getAllByText('閱讀')[0]);
    expect(getByTestId('legal-modal')).toBeTruthy();
    expect(getByTestId('legal-type').props.children).toBe('terms');
  });

  it('pressing privacy (second 閱讀) opens LegalTextModal with type "privacy"', () => {
    const { getAllByText, getByTestId } = render(<SettingsScreen {...defaultProps} />);
    fireEvent.press(getAllByText('閱讀')[1]);
    expect(getByTestId('legal-modal')).toBeTruthy();
    expect(getByTestId('legal-type').props.children).toBe('privacy');
  });

  it('closing terms legal modal hides it', () => {
    const { getAllByText, getByTestId, queryByTestId } = render(
      <SettingsScreen {...defaultProps} />,
    );
    fireEvent.press(getAllByText('閱讀')[0]);
    fireEvent.press(getByTestId('legal-close'));
    expect(queryByTestId('legal-modal')).toBeNull();
  });

  it('closing privacy legal modal hides it', () => {
    const { getAllByText, getByTestId, queryByTestId } = render(
      <SettingsScreen {...defaultProps} />,
    );
    fireEvent.press(getAllByText('閱讀')[1]);
    fireEvent.press(getByTestId('legal-close'));
    expect(queryByTestId('legal-modal')).toBeNull();
  });
});

describe('SettingsScreen — back navigation', () => {
  it('back arrow calls onNavigate("home")', () => {
    const onNavigate = jest.fn();
    const { getByText } = render(<SettingsScreen {...defaultProps} onNavigate={onNavigate} />);
    fireEvent.press(getByText('←'));
    expect(onNavigate).toHaveBeenCalledWith('home');
  });
});

describe('SettingsScreen — no modal shown initially', () => {
  it('no modal is visible on initial render', () => {
    const { queryByTestId } = render(<SettingsScreen {...defaultProps} />);
    expect(queryByTestId('edit-profile-modal')).toBeNull();
    expect(queryByTestId('logout-modal')).toBeNull();
    expect(queryByTestId('delete-modal')).toBeNull();
    expect(queryByTestId('feedback-modal')).toBeNull();
    expect(queryByTestId('blocked-modal')).toBeNull();
    expect(queryByTestId('verify-modal')).toBeNull();
    expect(queryByTestId('legal-modal')).toBeNull();
  });
});

describe('SettingsScreen — version label', () => {
  it('renders the version from app.json (via expo-constants), not a hardcoded value', () => {
    // The hardcoded "v1.0.0-beta" drifted out of sync with app.json. Anchor
    // the displayed version to Constants.expoConfig.version so a release
    // bump in app.json automatically reflects on the settings screen.
    const { getByText } = render(<SettingsScreen {...defaultProps} />);
    expect(getByText('v9.9.9')).toBeTruthy();
  });
});
