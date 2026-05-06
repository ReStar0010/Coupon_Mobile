import React from 'react';
import { render } from '@testing-library/react-native';
import GemPips from '../GemPips';

describe('GemPips', () => {
  it('renders without error', () => {
    const { toJSON } = render(<GemPips count={5} filled={3} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders all 5 pips', () => {
    const { getAllByTestId } = render(<GemPips count={5} filled={3} />);
    const pips = getAllByTestId(/gem-pip/);
    expect(pips).toHaveLength(5);
  });

  it('renders correct number of filled pips', () => {
    const { getAllByTestId } = render(<GemPips count={5} filled={2} />);
    const filled = getAllByTestId('gem-pip-filled');
    expect(filled).toHaveLength(2);
  });

  it('renders correct number of empty pips', () => {
    const { getAllByTestId } = render(<GemPips count={5} filled={2} />);
    const empty = getAllByTestId('gem-pip-empty');
    expect(empty).toHaveLength(3);
  });

  it('renders all filled when filled equals count', () => {
    const { getAllByTestId } = render(<GemPips count={5} filled={5} />);
    const filled = getAllByTestId('gem-pip-filled');
    expect(filled).toHaveLength(5);
  });

  it('renders all empty when filled is 0', () => {
    const { getAllByTestId } = render(<GemPips count={5} filled={0} />);
    const empty = getAllByTestId('gem-pip-empty');
    expect(empty).toHaveLength(5);
  });
});
