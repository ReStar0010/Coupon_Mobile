import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LegalTextModal from '../../modals/LegalTextModal';

const mockGet = jest.fn();

jest.mock('@/src/services/api/client', () => ({
  apiClient: {
    get: (url: string) => mockGet(url),
  },
}));

const defaultProps = {
  visible: true,
  type: 'terms' as const,
  onClose: jest.fn(),
};

describe('LegalTextModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({
      data: {
        title: 'CouPro 服務條款',
        content: '本服務條款規定您使用本服務的條件。',
      },
    });
  });

  it('does not show content when visible is false', () => {
    const { queryByText } = render(
      <LegalTextModal {...defaultProps} visible={false} />,
    );
    expect(queryByText('CouPro 服務條款')).toBeNull();
  });

  it('fetches /api/terms/ when type="terms"', async () => {
    render(<LegalTextModal {...defaultProps} />);
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/terms/');
    });
  });

  it('fetches /api/privacy-policy/ when type="privacy"', async () => {
    render(<LegalTextModal {...defaultProps} type="privacy" />);
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/privacy-policy/');
    });
  });

  it('fetches /api/content-guidelines/ when type="guidelines"', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        prohibited_content: ['違法', '暴力'],
        penalties: ['警告', '封鎖'],
        support_contact: 'support@coupro.app',
      },
    });
    render(<LegalTextModal {...defaultProps} type="guidelines" />);
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/content-guidelines/');
    });
  });

  it('renders the fetched title and body content', async () => {
    const { findByText } = render(<LegalTextModal {...defaultProps} />);
    expect(await findByText('CouPro 服務條款')).toBeTruthy();
    expect(await findByText(/本服務條款規定/)).toBeTruthy();
  });

  it('displays the close button', () => {
    const { getByText } = render(<LegalTextModal {...defaultProps} />);
    expect(getByText('關閉')).toBeTruthy();
  });

  it('pressing close button calls onClose', () => {
    const { getByText } = render(<LegalTextModal {...defaultProps} />);
    fireEvent.press(getByText('關閉'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('shows inline error when fetch fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));
    const { findByTestId } = render(<LegalTextModal {...defaultProps} />);
    const err = await findByTestId('legal-error');
    expect(err.props.children).toBe('Network error');
  });

  it('shows loading indicator before the response arrives', () => {
    mockGet.mockReturnValueOnce(new Promise(() => undefined));
    const { getByTestId } = render(<LegalTextModal {...defaultProps} />);
    expect(getByTestId('legal-loading')).toBeTruthy();
  });

  it('does not call onClose when modal is just displayed', () => {
    render(<LegalTextModal {...defaultProps} />);
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });
});
