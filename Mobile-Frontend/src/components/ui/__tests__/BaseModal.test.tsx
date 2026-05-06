import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import BaseModal from '../../modals/BaseModal';

describe('BaseModal', () => {
  it('renders children when visible', () => {
    const { getByText } = render(
      <BaseModal visible={true} onClose={() => {}}>
        <Text>Modal Content</Text>
      </BaseModal>
    );
    expect(getByText('Modal Content')).toBeTruthy();
  });

  it('does not render children when not visible', () => {
    const { queryByText } = render(
      <BaseModal visible={false} onClose={() => {}}>
        <Text>Modal Content</Text>
      </BaseModal>
    );
    expect(queryByText('Modal Content')).toBeNull();
  });

  it('renders title when provided', () => {
    const { getByText } = render(
      <BaseModal visible={true} onClose={() => {}} title="Test Modal">
        <Text>Content</Text>
      </BaseModal>
    );
    expect(getByText('Test Modal')).toBeTruthy();
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <BaseModal visible={true} onClose={onClose}>
        <Text>Content</Text>
      </BaseModal>
    );
    fireEvent.press(getByTestId('modal-close-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is accessible with accessibilityViewIsModal', () => {
    const { getByTestId } = render(
      <BaseModal visible={true} onClose={() => {}}>
        <Text>Content</Text>
      </BaseModal>
    );
    const modal = getByTestId('base-modal');
    expect(modal.props.accessibilityViewIsModal).toBe(true);
  });
});
