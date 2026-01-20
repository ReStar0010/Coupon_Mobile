import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { CameraView, CameraType, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { qrClaimAPI } from '../utils/authAPI';

const { width } = Dimensions.get('window');

export default function QRClaimScanner() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScannedTime, setLastScannedTime] = useState<number>(0);
  const [isDisabled, setIsDisabled] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  // Use ref to track if a claim is currently being processed
  const isProcessingRef = useRef<boolean>(false);

  // Request camera permission on mount
  useEffect(() => {
    if (permission && !permission.granted && !permission.canAskAgain) {
      // Permission denied permanently
      setError('需要相機權限才能掃描 QR Code，請在設定中開啟相機權限');
    } else if (permission && !permission.granted) {
      requestPermission();
    } else if (permission?.granted) {
      setIsScanning(true);
    }
  }, [permission, requestPermission]);

  const handleBarCodeScanned = useCallback(async ({ type, data }: BarcodeScanningResult) => {
    // Check if already processing a claim - use ref for immediate check without state delay
    if (isProcessingRef.current || !isScanning || isDisabled || isLoading) {
      return;
    }
    
    // T030: Duplicate-scan prevention - prevent processing same QR code multiple times within 2 seconds
    const now = Date.now();
    if (now - lastScannedTime < 2000) {
      return;
    }
    
    // Immediately set processing flag to prevent any concurrent calls
    isProcessingRef.current = true;
    setLastScannedTime(now);
    
    setIsScanning(false);
    setIsDisabled(true);
    setIsLoading(true);
    setError(null);
    
    try {
      // T032: Parse QR code JSON
      let qrData: { template_id?: number; session_token?: string };
      try {
        qrData = JSON.parse(data);
      } catch (parseError) {
        setError('無效的 QR Code 格式，請掃描正確的優惠券 QR Code');
        setIsLoading(false);
        setIsDisabled(false);
        return;
      }
      
      // T032: Validate required fields
      if (!qrData.template_id || !qrData.session_token) {
        setError('QR Code 缺少必要資訊');
        setIsLoading(false);
        setIsDisabled(false);
        return;
      }
      
      // Validate types
      if (typeof qrData.template_id !== 'number' || typeof qrData.session_token !== 'string' || qrData.session_token.trim() === '') {
        setError('QR Code 缺少必要資訊');
        setIsLoading(false);
        setIsDisabled(false);
        return;
      }
      
      // T033: Call claim API with retry logic
      const result = await qrClaimAPI.claimCouponViaQR(qrData.template_id, qrData.session_token);
      
      // T034: Show success message and navigate back
      Alert.alert(
        '獲得優惠券',
        `成功領取優惠券：${result.coupon_name}`,
        [
          {
            text: '確定',
            onPress: () => {
              router.back();
            },
          },
        ],
        { cancelable: false }
      );
    } catch (err: any) {
      console.error('QR claim error:', err);
      
      // T035: Handle specific error messages
      const errorMessage = err?.response?.data?.error || err?.message || '領取失敗';
      let displayMessage = errorMessage;
      
      if (errorMessage.includes('expired') || errorMessage.includes('過期') || errorMessage.includes('invalid')) {
        displayMessage = 'QR Code 已過期，請商家重新生成';
      } else if (errorMessage.includes('out of stock') || errorMessage.includes('已領取完畢')) {
        displayMessage = '優惠券已領取完畢';
      } else if (errorMessage.includes('expired template') || errorMessage.includes('已過期')) {
        displayMessage = '優惠券已過期';
      } else if (errorMessage.includes('network') || errorMessage.includes('連線')) {
        displayMessage = '無法連線，請檢查網路後重試';
      } else if (errorMessage.includes('retry') || errorMessage.includes('重試')) {
        displayMessage = '網路連線失敗，正在重試...';
      }
      
      setError(displayMessage);
      setIsDisabled(false);
    } finally {
      setIsLoading(false);
      // Reset processing flag after request completes (success or error)
      isProcessingRef.current = false;
    }
  }, [isScanning, isDisabled, isLoading, lastScannedTime, router]);

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleRequestPermission = useCallback(async () => {
    const result = await requestPermission();
    if (result.granted) {
      setIsScanning(true);
      setError(null);
    }
  }, [requestPermission]);

  const handleOpenSettings = useCallback(() => {
    Alert.alert(
      '需要相機權限',
      '請在設定中開啟相機權限以使用 QR Code 掃描功能',
      [
        { text: '取消', style: 'cancel' },
        { text: '前往設定', onPress: () => {
          // On iOS, this will open Settings app
          // On Android, you might need to use Linking.openSettings()
          // For now, just show the alert
        }},
      ]
    );
  }, []);

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <ArrowLeft size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>掃描 QR Code 領取優惠券</Text>
        </View>
        
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>
            需要相機權限才能掃描 QR Code，請在設定中開啟相機權限
          </Text>
          {permission.canAskAgain ? (
            <TouchableOpacity onPress={handleRequestPermission} style={styles.permissionButton}>
              <Text style={styles.permissionButtonText}>授予權限</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleOpenSettings} style={styles.permissionButton}>
              <Text style={styles.permissionButtonText}>前往設定</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>掃描 QR Code 領取優惠券</Text>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          onBarcodeScanned={isScanning && !isDisabled ? handleBarCodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        />
        
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>處理中...</Text>
          </View>
        )}
        
        {error && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={() => {
                setError(null);
                setIsDisabled(false);
                setIsScanning(true);
                isProcessingRef.current = false; // Reset processing flag on retry
              }}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>重試</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          將 QR Code 對準掃描框
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#ffad31',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  footerText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#ffad31',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
