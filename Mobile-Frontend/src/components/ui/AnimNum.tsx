import React, { useState, useEffect, useRef } from 'react';
import { Text, StyleSheet } from 'react-native';
import { fontFamilies } from '../../theme/typography';
import { colors } from '../../theme/colors';

interface AnimNumProps {
  value: number;
  color?: string;
  fontSize?: number;
}

export default function AnimNum({
  value,
  color = colors.fg,
  fontSize = 18,
}: AnimNumProps): React.JSX.Element {
  const [shown, setShown] = useState(value);
  const targetRef = useRef(value);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    targetRef.current = value;
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (shown === value) return;

    const step = value > shown ? 1 : -1;
    intervalRef.current = setInterval(() => {
      setShown((s) => {
        const next = s + step;
        if (next === targetRef.current || (step > 0 ? next >= targetRef.current : next <= targetRef.current)) {
          if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return targetRef.current;
        }
        return next;
      });
    }, 40);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [value]);

  return (
    <Text
      style={[
        styles.text,
        { color, fontSize },
      ]}
    >
      {shown}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: fontFamilies.monoSemiBold,
    fontWeight: '600',
  },
});
