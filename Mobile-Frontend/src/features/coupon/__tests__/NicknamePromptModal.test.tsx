import React from 'react';
import { render, act } from '@testing-library/react-native';
import NicknamePromptModal from '../NicknamePromptModal';

const defaultProps = {
  visible: true,
  onSubmit: jest.fn().mockResolvedValue(undefined),
  onClose: jest.fn(),
};

describe('NicknamePromptModal keyboard avoidance', () => {
  it('lifts the sheet body by the keyboard height so the input/button stay visible', () => {
    // The input autoFocuses, so the keyboard opens over the bottom sheet.
    // A Keyboard.addListener-driven spacer (not KeyboardAvoidingView, which is
    // unreliable inside a Modal) must grow to the reported keyboard height.
    const RN = jest.requireActual('react-native');
    const listeners: Record<string, (e: { endCoordinates: { height: number } }) => void> = {};
    const removeShow = jest.fn();
    const removeHide = jest.fn();
    jest.spyOn(RN.Keyboard, 'addListener').mockImplementation((...args: unknown[]) => {
      const event = args[0] as string;
      const cb = args[1] as (e: { endCoordinates: { height: number } }) => void;
      listeners[event] = cb;
      return { remove: event === 'keyboardDidShow' ? removeShow : removeHide };
    });

    const { getByTestId, unmount } = render(<NicknamePromptModal {...defaultProps} />);

    act(() => {
      listeners.keyboardDidShow?.({ endCoordinates: { height: 320 } });
    });

    const spacer = getByTestId('nickname-keyboard-spacer');
    expect(spacer.props.style).toEqual(expect.objectContaining({ height: 320 }));
    // The input and save button remain mounted/reachable above the spacer.
    expect(getByTestId('nickname-input')).toBeTruthy();
    expect(getByTestId('nickname-save-btn')).toBeTruthy();

    // Unmounting must remove both listeners — no leaked native subscriptions.
    unmount();
    expect(removeShow).toHaveBeenCalled();
    expect(removeHide).toHaveBeenCalled();
  });

  it('collapses the spacer back to 0 when the keyboard hides', () => {
    const RN = jest.requireActual('react-native');
    const listeners: Record<string, (e?: { endCoordinates: { height: number } }) => void> = {};
    jest.spyOn(RN.Keyboard, 'addListener').mockImplementation((...args: unknown[]) => {
      const event = args[0] as string;
      const cb = args[1] as (e?: { endCoordinates: { height: number } }) => void;
      listeners[event] = cb;
      return { remove: jest.fn() };
    });

    const { getByTestId } = render(<NicknamePromptModal {...defaultProps} />);
    act(() => {
      listeners.keyboardDidShow?.({ endCoordinates: { height: 280 } });
    });
    act(() => {
      listeners.keyboardDidHide?.();
    });
    expect(getByTestId('nickname-keyboard-spacer').props.style).toEqual(
      expect.objectContaining({ height: 0 }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
