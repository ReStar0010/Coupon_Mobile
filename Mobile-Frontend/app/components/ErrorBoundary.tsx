import React, { Component, ReactNode } from 'react';
import { View, Text, Button } from 'tamagui';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View flex={1} bg="#f5f5f5" alignItems="center" justifyContent="center" padding="$5">
          <Text fontSize={20} fontWeight="bold" color="#333333" mb="$3">
            發生錯誤
          </Text>
          <Text fontSize={14} color="#707070" textAlign="center" mb="$5">
            {this.state.error?.message || '應用程式遇到問題，請重試。'}
          </Text>
          <Button
            onPress={this.handleReset}
            bg="#FFAD31"
            color="white"
            pressStyle={{ opacity: 0.8 }}
          >
            重試
          </Button>
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
