/**
 * EULA API Service
 * UGC Compliance (Apple Guideline 1.2) - User Story 3
 *
 * Handles EULA acceptance flow for merchants before first content upload.
 */

import { fetchAPI, parseResponse } from '../utils/api';

// ============================================
// TypeScript Interfaces
// ============================================

export interface EULAStatus {
  has_accepted: boolean;
  accepted_version: string | null;
  current_version: string;
  needs_acceptance: boolean;
  accepted_at: string | null;
}

export interface EULAAcceptRequest {
  version: string;
  agreed: boolean;
}

export interface EULAAcceptResponse {
  id: number;
  version: string;
  accepted_at: string;
  message: string;
}

export interface EULAContent {
  version: string;
  title: string;
  content: string;
  content_guidelines: string;
  penalties: string;
  last_updated: string;
}

// ============================================
// API Functions
// ============================================

/**
 * Get EULA acceptance status for current merchant
 */
export async function getEULAStatus(): Promise<EULAStatus> {
  const response = await fetchAPI('/merchant/eula/status/', {
    method: 'GET',
  });
  return parseResponse(response);
}

/**
 * Accept EULA for current merchant
 */
export async function acceptEULA(data: EULAAcceptRequest): Promise<EULAAcceptResponse> {
  const response = await fetchAPI('/merchant/eula/accept/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return parseResponse(response);
}

/**
 * Get EULA content and guidelines
 */
export async function getEULAContent(): Promise<EULAContent> {
  const response = await fetchAPI('/merchant/eula/content/', {
    method: 'GET',
  });
  return parseResponse(response);
}

/**
 * Check if merchant needs to accept EULA before uploading
 * Helper function that wraps getEULAStatus
 */
export async function needsEULAAcceptance(): Promise<boolean> {
  try {
    const status = await getEULAStatus();
    return status.needs_acceptance;
  } catch (error) {
    console.error('Failed to check EULA status:', error);
    // Assume EULA is needed if check fails (safer default)
    return true;
  }
}
